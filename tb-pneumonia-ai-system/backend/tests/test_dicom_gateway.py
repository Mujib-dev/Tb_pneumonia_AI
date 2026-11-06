"""End-to-end tests for the DICOM C-STORE gateway.

These stand in for the hospital X-ray machine with a pynetdicom SCU, so the
association, negotiation and ingest pipeline are exercised for real. They do not
prove compatibility with any physical modality; that check still has to be done
on site.
"""
import os
import sys
import threading
import time

import pytest
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import (
    ExplicitVRLittleEndian,
    DigitalXRayImageStorageForPresentation,
    generate_uid,
)
from pynetdicom import AE, evt, build_context
from pynetdicom.sop_class import Verification
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings                     # noqa: E402
from app.db.database import Base                          # noqa: E402
from app.db import models                                # noqa: E402
from app.dicom_server import handle_c_store              # noqa: E402
from app.services import dicom_ingest                     # noqa: E402


def build_cxr_dataset(
    tmp_path,
    *,
    sop_class=DigitalXRayImageStorageForPresentation,
    patient_id="TEST-001",
):
    """Create a small but genuinely valid DICOM radiograph on disk."""
    from PIL import Image
    import numpy as np

    # A 512x512 grayscale chest-radiograph-like frame, big enough and square
    # enough for the image validator to accept it.
    rng = np.random.default_rng(42)
    arr = rng.integers(0, 255, size=(512, 512), dtype=np.uint8)
    # Give it a brighter midline and darker lung fields so it is not pure noise.
    arr[:, 200:312] = 235
    arr[140:400, 60:190] = 35
    arr[140:400, 322:452] = 35
    Image.fromarray(arr, mode="L").save(tmp_path / "source.png")

    ds = Dataset()
    ds.file_meta = FileMetaDataset()
    ds.file_meta.MediaStorageSOPClassUID = sop_class
    ds.file_meta.MediaStorageSOPInstanceUID = generate_uid()
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds.file_meta.ImplementationClassUID = generate_uid()
    ds.file_meta.ImplementationVersionName = "PYTEST_1"

    ds.SOPClassUID = sop_class
    ds.SOPInstanceUID = ds.file_meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.Modality = "DX"
    ds.Manufacturer = "Simulated Modality"
    ds.PatientName = "TEST^PATIENT"
    ds.PatientID = patient_id
    ds.PatientBirthDate = "19700101"
    ds.PatientSex = "O"
    ds.StudyDate = "20260101"
    ds.StudyDescription = "CHEST PORTABLE"
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.SamplesPerPixel = 1
    ds.Rows = 512
    ds.Columns = 512
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.WindowCenter = 128
    ds.WindowWidth = 256
    ds.PixelData = arr.tobytes()

    path = tmp_path / "instance.dcm"
    try:
        ds.save_as(str(path), enforce_file_format=True)
    except TypeError:
        ds.save_as(str(path), write_like_original=False)
    return str(path), ds


@pytest.fixture
def db(tmp_path, monkeypatch):
    """An isolated SQLite database, so tests never touch Postgres.

    A file (not `:memory:`) is required because the C-STORE association is
    served on a worker thread, and SQLite in-memory databases are per-connection.
    The working directory is also isolated so the ingest pipeline's relative
    `uploads/radiology` storage never lands in the repo.
    """
    monkeypatch.chdir(tmp_path)
    engine = create_engine(
        f"sqlite:///{tmp_path / 'gateway.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    yield session, engine
    session.close()


def _patch_pipeline(monkeypatch, *, result="Normal", confidence=0.91, valid=True, model=True):
    """Stub the model/validator so tests do not load DenseNet-121.

    `dicom_ingest` binds `validate_chest_xray` and `dicom_to_png` at import
    time, so those names must be patched on the ingest module itself, not on
    their defining modules. `predict_image`/`is_model_connected` are resolved
    lazily inside the function, so patching the defining module is correct.
    """
    scores = {result: confidence, "Pneumonia": round(1 - confidence, 4)}
    if "TB" not in scores:
        scores["TB"] = 0.0

    def fake_predict(path):
        return result, confidence, scores, None

    def fake_validate(path):
        return (valid, "ok" if valid else "not a chest x-ray")

    def fake_to_png(src, dst):
        # Real conversion is already covered elsewhere; here just materialise a
        # PNG so downstream file handling is exercised for real.
        from PIL import Image
        import numpy as np
        Image.fromarray(np.full((512, 512), 128, dtype=np.uint8), mode="L").save(dst)
        return dst

    monkeypatch.setattr(dicom_ingest, "validate_chest_xray", fake_validate)
    monkeypatch.setattr(dicom_ingest, "dicom_to_png", fake_to_png)

    import app.services.predict as predict_mod
    monkeypatch.setattr(predict_mod, "is_model_connected", lambda: model)
    monkeypatch.setattr(predict_mod, "predict_image", fake_predict)
    return scores


def _free_port() -> int:
    """Reserve an ephemeral port, then release it for the listener to bind."""
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _port_is_listening(port: int) -> bool:
    import socket

    deadline = time.time() + 5
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.25)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.05)
    return False


class _FakeAssoc:
    def __init__(self, ae_title, address):
        self.requestor = type("R", (), {"ae_title": ae_title, "address": address})()


class _FakeEvent:
    """Minimal stand-in for a pynetdicom C-STORE event."""

    def __init__(self, dataset, ae_title="MODALITY", address="127.0.0.1"):
        self.dataset = dataset
        self.assoc = _FakeAssoc(ae_title, address)


# --------------------------------------------------------------------------
# Allowlist enforcement
# --------------------------------------------------------------------------

def test_allowlist_permits_everything_when_unset():
    from app.dicom_server import is_allowed_ae_title, is_allowed_remote_ip

    assert is_allowed_remote_ip("10.0.0.5") is True
    assert is_allowed_ae_title("ANY_AE") is True


def test_ip_allowlist_blocks_unlisted(monkeypatch):
    from app import dicom_server

    # The helpers read the raw CSV setting; the list properties are derived.
    monkeypatch.setattr(dicom_server.settings, "DICOM_ALLOWED_REMOTE_IPS", "10.1.0.0/16")
    assert dicom_server.is_allowed_remote_ip("10.1.2.3") is True
    assert dicom_server.is_allowed_remote_ip("192.168.5.5") is False
    # A malformed entry must never widen access.
    assert dicom_server.is_allowed_remote_ip("not-an-ip") is False


def test_ae_allowlist_blocks_unlisted(monkeypatch):
    from app import dicom_server

    monkeypatch.setattr(
        dicom_server.settings, "DICOM_ALLOWED_REMOTE_AE_TITLES", "XRAY01, XRAY02"
    )
    assert dicom_server.is_allowed_ae_title("XRAY01") is True
    assert dicom_server.is_allowed_ae_title("XRAY02") is True
    assert dicom_server.is_allowed_ae_title("ROGUE") is False


# --------------------------------------------------------------------------
# Ingest pipeline
# --------------------------------------------------------------------------

def test_ingest_analyses_and_records_study(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    summary = dicom_ingest.ingest_dataset(
        ds, session,
        source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )

    assert summary["status"] == "analysed"
    assert summary["result"] == "Normal"
    assert summary["confidence"] == pytest.approx(0.91)

    row = session.query(models.DicomStudy).one()
    assert row.status == "analysed"
    assert row.patient_id is None, "machine studies must arrive unattributed"
    assert row.source_ae_title == "XRAY01"
    assert row.dicom_patient_id == "TEST-001"
    assert row.source_dicom_path and os.path.isfile(row.source_dicom_path)

    pred = session.query(models.Prediction).one()
    assert pred.user_id is None
    assert pred.result == "Normal"


def test_ingest_rejects_non_cxr_but_keeps_record(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch, valid=False)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    summary = dicom_ingest.ingest_dataset(
        ds, session,
        source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )

    assert summary["status"] == "rejected"
    assert summary["reason"] == "not_a_chest_xray"

    row = session.query(models.DicomStudy).one()
    assert row.rejection_reason == "not_a_chest_xray"
    # The original study is retained for audit, the useless render is not kept.
    assert row.image_path is None
    assert os.path.isfile(row.source_dicom_path)
    assert session.query(models.Prediction).count() == 0


def test_ingest_rejects_unsupported_sop_class(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch)
    src, ds = build_cxr_dataset(tmp_path, sop_class="1.2.840.10008.5.1.4.1.1.66.1")
    ds.filename = src

    summary = dicom_ingest.ingest_dataset(
        ds, session,
        source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )

    assert summary["reason"] == "unsupported_sop_class"
    assert session.query(models.Prediction).count() == 0


def test_ingest_queues_when_model_offline(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch, model=False)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    summary = dicom_ingest.ingest_dataset(
        ds, session,
        source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )

    assert summary["status"] == "pending"
    assert summary["reason"] == "model_offline"
    assert session.query(models.DicomStudy).one().status == "pending"


def test_ingest_duplicate_sop_instance_is_idempotent(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    dicom_ingest.ingest_dataset(
        ds, session, source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )
    # A modality that retries after a timeout re-sends the same instance.
    second = dicom_ingest.ingest_dataset(
        ds, session, source_ae_title="XRAY01", source_ip="127.0.0.1",
        storage_dir=str(tmp_path / "radiology"),
    )

    assert session.query(models.DicomStudy).count() == 1


# --------------------------------------------------------------------------
# C-STORE handler
# --------------------------------------------------------------------------

def test_handler_returns_success_and_analyses(db, tmp_path, monkeypatch):
    session, _ = db
    _patch_pipeline(monkeypatch)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    class _DB:
        """The handler opens its own session; reuse the test's."""
        def close(self):
            pass

    monkeypatch.setattr("app.dicom_server.SessionLocal", lambda: session)

    status = handle_c_store(_FakeEvent(ds))
    assert status == 0x0000
    assert session.query(models.DicomStudy).one().status == "analysed"


def test_handler_refuses_disallowed_ip(db, tmp_path, monkeypatch):
    from app import dicom_server

    session, _ = db
    src, ds = build_cxr_dataset(tmp_path)
    monkeypatch.setattr(dicom_server.settings, "DICOM_ALLOWED_REMOTE_IPS", "10.9.9.9")

    status = dicom_server.handle_c_store(_FakeEvent(ds, address="192.168.1.1"))
    assert status == 0xA700
    assert session.query(models.DicomStudy).count() == 0


def test_handler_refuses_disallowed_ae_title(db, tmp_path, monkeypatch):
    from app import dicom_server

    session, _ = db
    src, ds = build_cxr_dataset(tmp_path)
    monkeypatch.setattr(
        dicom_server.settings, "DICOM_ALLOWED_REMOTE_AE_TITLES", "XRAY01"
    )

    status = dicom_server.handle_c_store(_FakeEvent(ds, ae_title="ROGUE"))
    assert status == 0xA700
    assert session.query(models.DicomStudy).count() == 0


# --------------------------------------------------------------------------
# Resource limits
# --------------------------------------------------------------------------

def test_instance_count_cap_is_enforced(db, tmp_path, monkeypatch):
    from app import dicom_server

    session, _ = db
    _patch_pipeline(monkeypatch)
    monkeypatch.setattr(dicom_server, "SessionLocal", lambda: session)
    monkeypatch.setattr(dicom_server.settings, "DICOM_MAX_INSTANCES_PER_ASSOCIATION", 1)

    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src
    event = _FakeEvent(ds)

    dicom_server._active_associations.clear()
    try:
        # Simulate one instance already accepted on this association.
        with dicom_server._associations_lock:
            dicom_server._active_associations[id(event.assoc)] = (event.assoc, 1)

        assert dicom_server._record_instance(event.assoc) is False, (
            "a second instance must be blocked once the cap of 1 is reached"
        )

        status = dicom_server.handle_c_store(event)
        assert status == 0xA700
        assert session.query(models.DicomStudy).count() == 0
    finally:
        dicom_server._active_associations.clear()


def test_association_cap_rejects_new_association(monkeypatch):
    from app import dicom_server

    monkeypatch.setattr(dicom_server.settings, "DICOM_MAX_ASSOCIATIONS", 2)
    dicom_server._active_associations.clear()
    first, second = _FakeEvent(None), _FakeEvent(None)
    aborted = []
    try:
        with dicom_server._associations_lock:
            dicom_server._active_associations[id(first.assoc)] = (first.assoc, 0)
            dicom_server._active_associations[id(second.assoc)] = (second.assoc, 0)

        def _track_abort():
            aborted.append(True)
            return None

        event = _FakeEvent(None)
        event.assoc.abort = _track_abort  # EVT_ESTABLISHED is a notification
        dicom_server._on_established(event)  # event: refusal must abort, not return 0xA700

        assert aborted == [True], "over the cap must be refused by aborting the association"
        assert len(dicom_server._active_associations) == 2, (
            "a refused association must not be added to the active set"
        )
    finally:
        dicom_server._active_associations.clear()


def test_association_released_frees_capacity(monkeypatch):
    from app import dicom_server

    monkeypatch.setattr(dicom_server.settings, "DICOM_MAX_ASSOCIATIONS", 1)
    dicom_server._active_associations.clear()
    event = _FakeEvent(None, ae_title="XRAY01")
    try:
        assert dicom_server._on_established(event) is None, "under the cap must be accepted"
        assert len(dicom_server._active_associations) == 1

        dicom_server._on_released(event)
        assert len(dicom_server._active_associations) == 0
    finally:
        dicom_server._active_associations.clear()


def test_allowlist_aborts_the_association(monkeypatch):
    """EVT_ESTABLISHED is a notification event in pynetdicom 2.x.

    Its return value is discarded, so a disallowed peer is refused by aborting
    the association rather than by returning a status code.
    """
    from app import dicom_server

    monkeypatch.setattr(dicom_server.settings, "DICOM_ALLOWED_REMOTE_AE_TITLES", "XRAY01")
    aborted = []

    def _track_abort():
        aborted.append(True)

    event = _FakeEvent(None, ae_title="ROGUE")
    event.assoc.abort = _track_abort
    with dicom_server._associations_lock:
        dicom_server._active_associations.clear()

    dicom_server._on_established(event)

    assert aborted == [True], "a rogue AE title must have its association aborted"
    assert dicom_server._active_associations == {}, "a refused peer must not be counted"


def test_oversized_instance_is_refused(db, tmp_path, monkeypatch):
    from app import dicom_server

    session, _ = db
    _patch_pipeline(monkeypatch)
    monkeypatch.setattr(dicom_server, "SessionLocal", lambda: session)
    monkeypatch.setattr(dicom_server.settings, "DICOM_MAX_INSTANCE_BYTES", 1024)

    src, ds = build_cxr_dataset(tmp_path)
    assert dicom_server._decoded_size_bytes(ds) > 1024, "fixture must exceed the cap to be meaningful"

    status = dicom_server.handle_c_store(_FakeEvent(ds))
    assert status == 0xA700
    assert session.query(models.DicomStudy).count() == 0, "an oversized instance must not be stored"


# --------------------------------------------------------------------------
# Real association over a socket (the "simulator")
# --------------------------------------------------------------------------

def test_c_store_over_a_real_association(db, tmp_path, monkeypatch):
    """Negotiate and send over TCP with a pynetdicom SCU.

    This is the closest thing to the real machine available without hardware:
    a real socket, real presentation-context negotiation and a real C-STORE.
    """
    session, _ = db
    _patch_pipeline(monkeypatch)
    src, ds = build_cxr_dataset(tmp_path)
    ds.filename = src

    monkeypatch.setattr("app.dicom_server.SessionLocal", lambda: session)

    from pynetdicom import AE as ServerAE

    server_ae = ServerAE(ae_title="PULMOAI_TEST")
    server_ae.add_supported_context(DigitalXRayImageStorageForPresentation)
    server_ae.add_supported_context(Verification)

    # Bind a free port so the test never collides with a real gateway.
    TEST_PORT = _free_port()
    server_ae.start_server(
        ("127.0.0.1", TEST_PORT), block=False,
        evt_handlers=[(evt.EVT_C_STORE, handle_c_store)],
    )
    try:
        port = TEST_PORT
        assert _port_is_listening(port), "server did not start"

        scu = AE(ae_title="SIMULATED_XRAY")
        scu.add_requested_context(DigitalXRayImageStorageForPresentation)
        assoc = scu.associate("127.0.0.1", port, ae_title="PULMOAI_TEST")

        assert assoc.is_established, "association was refused"
        response = assoc.send_c_store(ds)
        assoc.release()

        # pynetdicom 2.x returns (status, identifier) when a response identifier
        # is set, and a bare status otherwise.
        status = response[0] if isinstance(response, tuple) else response
        assert status.Status == 0x0000
        row = session.query(models.DicomStudy).one()
        assert row.status == "analysed"
        assert row.source_ae_title == "SIMULATED_XRAY"
    finally:
        server_ae.shutdown()
