"""DICOM (.dcm) upload support for the CAD screening pipeline.

Two things have to hold for a DICOM study to be clinically equivalent to a PNG
upload: the study must render to the same pixels a radiologist's lightbox shows,
and the resulting model input tensor must be produced by the *same* `preprocess`
transform the trained DenseNet-121 weights were fitted with.
"""
import asyncio
import os

import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

import app.api.routes as routes
from app.db import models
from app.services import dicom as dicom_service
from app.services.dicom import (
    DICOM_EXTENSIONS,
    DicomError,
    dicom_to_pil,
    dicom_to_png,
    is_dicom_extension,
    looks_like_dicom_bytes,
)

ROWS = COLS = 256
UUID = "b2671aba-60ce-41f3-8476-87c3b24d516d"


# --- fixtures ---------------------------------------------------------------

def _write_dicom(path, *, rows=ROWS, cols=COLS, bits=16, photometric="MONOCHROME2",
                 intercept=-1024.0, center=1500, width=2000, seed=7):
    """Write a minimal but valid single-frame CXR-style DICOM study."""
    rng = np.random.default_rng(seed)
    # Scale to the full range the declared bit depth can actually hold, so an
    # 8-bit study is not corrupted by uint8 wrap-around.
    peak = 255 if bits == 8 else 4095
    stored = (rng.random((rows, cols)) * peak)
    stored = stored.astype(np.uint8 if bits == 8 else np.uint16)

    ds = Dataset()
    ds.file_meta = FileMetaDataset()
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds.file_meta.MediaStorageSOPClassUID = generate_uid()
    ds.file_meta.MediaStorageSOPInstanceUID = generate_uid()
    ds.SOPClassUID = ds.file_meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = ds.file_meta.MediaStorageSOPInstanceUID
    ds.Modality = "CR"
    ds.Rows, ds.Columns = rows, cols
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = photometric
    ds.BitsAllocated = bits
    ds.BitsStored = bits
    ds.HighBit = bits - 1
    ds.PixelRepresentation = 0
    ds.NumberOfFrames = 1
    if intercept is not None:
        ds.RescaleSlope, ds.RescaleIntercept = 1.0, intercept
    if center is not None:
        ds.WindowCenter, ds.WindowWidth = center, width
    ds.PixelData = stored.tobytes()
    ds.save_as(path, enforce_file_format=True)
    return path


class _Upload:
    """Minimal stand-in for FastAPI's UploadFile."""

    def __init__(self, filename, payload):
        self.filename = filename
        self._payload = payload

    async def read(self):
        return self._payload


@pytest.fixture()
def radiology(tmp_path, monkeypatch):
    """Isolate the upload root on disk, mirroring production's relative paths."""
    monkeypatch.chdir(tmp_path)
    path = os.path.join("uploads", "radiology")
    os.makedirs(path)
    monkeypatch.setattr(routes, "UPLOAD_DIR", "uploads")
    monkeypatch.setattr(routes, "RADIOLOGY_DIR", path)
    return path


@pytest.fixture()
def offline_cad(monkeypatch):
    """Stub the CXR gate and the model so route tests never need model weights."""
    monkeypatch.setattr(routes, "validate_chest_xray", lambda path: (True, "Valid Chest X-ray"))
    monkeypatch.setattr(routes, "is_model_connected", lambda: True)
    monkeypatch.setattr(
        routes, "predict_image", lambda path: ("TB", 0.91, {"Normal": 0.04, "Pneumonia": 0.05, "TB": 0.91}, None)
    )


def _as(monkeypatch, user_id, role):
    monkeypatch.setattr(
        routes, "get_current_user_from_token", lambda token: {"id": user_id, "role": role}
    )


def _run_predict(file, db, user, monkeypatch, patient_identifier=None):
    _as(monkeypatch, user.id, "doctor")
    return asyncio.run(
        routes.predict(file=file, patient_identifier=patient_identifier, token="t", db=db)
    )


def _dicom_payload(tmp_path, name="study.dcm"):
    """Return the bytes of a valid DICOM study, staged outside the upload dir."""
    path = _write_dicom(str(tmp_path / name))
    with open(path, "rb") as handle:
        return handle.read()


# --- extension / sniffing helpers ------------------------------------------

@pytest.mark.parametrize("ext", ["dcm", "DCM", "dicom", ".dic", "ima"])
def test_dicom_extensions_recognised(ext):
    assert is_dicom_extension(ext)


@pytest.mark.parametrize("ext", ["jpg", "jpeg", "png", "", None, "pdf"])
def test_raster_and_unknown_extensions_rejected(ext):
    assert not is_dicom_extension(ext)


def test_accepted_cxr_extensions_include_raster_and_dicom():
    """The upload gate must stay a superset of the original PNG/JPEG set."""
    for ext in ("jpg", "jpeg", "png"):
        assert ext in routes.ACCEPTED_CXR_EXTENSIONS
    for ext in DICOM_EXTENSIONS:
        assert ext in routes.ACCEPTED_CXR_EXTENSIONS


def test_preamble_sniffing():
    assert looks_like_dicom_bytes(b"\x00" * 128 + b"DICM" + b"trailing")
    assert not looks_like_dicom_bytes(b"\x89PNG\r\n\x1a\n")
    assert not looks_like_dicom_bytes(b"")
    assert not looks_like_dicom_bytes(b"DICM")


# --- pixel conversion -------------------------------------------------------

def test_dicom_renders_rgb_image(tmp_path):
    image = dicom_to_pil(_write_dicom(str(tmp_path / "a.dcm")))

    assert image.size == (COLS, ROWS)
    assert image.mode == "RGB"


def test_16_bit_study_scales_into_display_range(tmp_path):
    """A 16-bit detector value range must be windowed, not clipped to black."""
    image = dicom_to_pil(_write_dicom(str(tmp_path / "wide.dcm"), bits=16))

    assert image.mode == "RGB"
    assert image.convert("L").getextrema()[1] > 0


def test_8_bit_study_is_passed_through_unscaled(tmp_path):
    image = dicom_to_pil(
        _write_dicom(str(tmp_path / "narrow.dcm"), bits=8, intercept=0.0, center=128, width=256)
    )

    low, high = image.convert("L").getextrema()
    assert low < high
    assert high > 200, "an 8-bit display-range study should keep full tonal range"


def test_study_without_windowing_still_renders(tmp_path):
    """Scout/localiser images often carry no Window Center/Width at all."""
    image = dicom_to_pil(_write_dicom(str(tmp_path / "nowrap.dcm"), center=None, width=None))

    low, high = image.convert("L").getextrema()
    assert high > 0
    assert high > low


def test_monochrome1_is_inverted(tmp_path):
    """MONOCHROME1 stores white as 0 and must display inverted."""
    mono2 = dicom_to_pil(_write_dicom(str(tmp_path / "m2.dcm"), seed=3)).convert("L")
    mono1 = dicom_to_pil(
        _write_dicom(str(tmp_path / "m1.dcm"), photometric="MONOCHROME1", seed=3)
    ).convert("L")

    a = np.asarray(mono2, dtype=np.int16)
    b = np.asarray(mono1, dtype=np.int16)

    assert np.array_equal(a, 255 - b)


def test_multiframe_series_uses_first_frame(tmp_path):
    path = _write_dicom(str(tmp_path / "series.dcm"))
    # Rewrite as a 2-frame series sharing one pixel array length.
    ds = dicom_service._read_dataset(path)
    frame = ds.pixel_array
    ds.NumberOfFrames = 2
    ds.PixelData = frame.tobytes() + frame.tobytes()
    ds.save_as(path, enforce_file_format=True)

    assert dicom_to_pil(path).size == (COLS, ROWS)


def test_dicom_to_png_writes_a_real_png(tmp_path):
    source = _write_dicom(str(tmp_path / "a.dcm"))
    png = dicom_to_png(source, str(tmp_path / "out" / "a.png"))

    assert os.path.isfile(png)
    with Image.open(png) as saved:
        assert saved.format == "PNG"
        assert saved.size == (COLS, ROWS)
        assert saved.mode == "RGB"


def test_corrupt_dicom_raises_dicom_error(tmp_path):
    bad = tmp_path / "broken.dcm"
    bad.write_bytes(b"this is not a dicom study" * 8)

    with pytest.raises(DicomError):
        dicom_to_pil(str(bad))


def test_undicom_payload_raises_dicom_error(tmp_path):
    """A PNG renamed to .dcm must not silently decode."""
    png = tmp_path / "fake.dcm"
    Image.new("RGB", (COLS, ROWS), (12, 12, 12)).save(png, format="PNG")

    with pytest.raises(DicomError):
        dicom_to_pil(str(png))


# --- the contract that matters: identical model input ----------------------

def test_dicom_tensor_matches_equivalent_png(tmp_path):
    """A DICOM study must produce the exact tensor a PNG of it would.

    This is what lets the existing (unmodified) `preprocess` transform and the
    existing trained weights serve DICOM uploads without retraining.
    """
    from app.services.predict import preprocess

    source = _write_dicom(str(tmp_path / "a.dcm"))
    dicom_tensor = preprocess(dicom_to_pil(source))

    rendered = tmp_path / "a.png"
    dicom_to_pil(source).save(rendered, format="PNG")
    png_tensor = preprocess(Image.open(rendered).convert("RGB"))

    assert dicom_tensor.shape == (3, 224, 224)
    assert torch_equal(dicom_tensor, png_tensor)


def torch_equal(a, b):
    import torch

    return bool(torch.equal(a, b))


# --- route behaviour --------------------------------------------------------

def test_dicom_upload_is_accepted_and_stored_as_png(radiology, db_session, doctor, monkeypatch, offline_cad, tmp_path):
    body = _run_predict(_Upload("chest.dcm", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)

    assert body["result"] == "TB"
    assert body["confidence"] == 0.91
    assert body["source_format"] == "DICOM"
    # Stored path is a PNG so the media route, validator and Grad-CAM are unchanged.
    assert body["image_path"].endswith(".png")
    assert body["image_url"].startswith("api/media/radiology/")
    assert os.path.isfile(body["image_path"])
    # The original study is retained for the clinical record, sharing one stem.
    stem = os.path.splitext(os.path.basename(body["image_path"]))[0]
    assert os.path.isfile(os.path.join(radiology, f"{stem}.dcm"))


def test_dicom_upload_stores_prediction_against_doctor(radiology, db_session, doctor, monkeypatch, offline_cad, tmp_path):
    body = _run_predict(_Upload("chest.dcm", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)

    row = db_session.query(models.Prediction).filter(models.Prediction.id == body["id"]).first()
    assert row is not None
    assert row.doctor_id == doctor.id
    assert row.image_path == body["image_path"]
    assert row.result == "TB"


def test_extensionless_dicom_is_sniffed_and_accepted(radiology, db_session, doctor, monkeypatch, offline_cad, tmp_path):
    """PACS exports often drop the extension; the preamble must still route it."""
    body = _run_predict(_Upload("IM0001", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)

    assert body["source_format"] == "DICOM"
    assert body["image_path"].endswith(".png")


def test_png_upload_is_unchanged(radiology, db_session, doctor, monkeypatch, offline_cad):
    """Regression: the original PNG path must behave exactly as before."""
    payload = Image.new("RGB", (COLS, ROWS), (30, 30, 30))
    import io

    buffer = io.BytesIO()
    payload.save(buffer, format="PNG")

    body = _run_predict(_Upload("scan.png", buffer.getvalue()), db_session, doctor, monkeypatch)

    assert body["image_path"].endswith(".png")
    assert body["source_format"] == "PNG"
    assert body["image_url"].startswith("api/media/radiology/")
    # No stray .dcm sibling is created for a raster upload.
    assert [f for f in os.listdir(radiology) if f.endswith(".dcm")] == []


def test_unsupported_extension_still_rejected(radiology, db_session, doctor, monkeypatch, offline_cad):
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.predict(file=_Upload("scan.pdf", b"%PDF-1.4"), patient_identifier=None,
                                   token="t", db=db_session))

    assert exc.value.status_code == 400
    assert "DICOM" in exc.value.detail


def test_corrupt_dicom_returns_400_and_leaves_nothing_behind(radiology, db_session, doctor, monkeypatch, offline_cad):
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.predict(file=_Upload("broken.dcm", b"not a dicom" * 40),
                                   patient_identifier=None, token="t", db=db_session))

    assert exc.value.status_code == 400
    assert os.listdir(radiology) == []


def test_empty_and_oversized_uploads_rejected_before_writing(radiology, db_session, doctor, monkeypatch, offline_cad):
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as empty:
        asyncio.run(routes.predict(file=_Upload("a.dcm", b""), patient_identifier=None,
                                   token="t", db=db_session))
    assert empty.value.status_code == 400

    oversized = b"\x00" * (routes.MAX_UPLOAD_BYTES + 1)
    with pytest.raises(HTTPException) as big:
        asyncio.run(routes.predict(file=_Upload("a.dcm", oversized), patient_identifier=None,
                                   token="t", db=db_session))
    assert big.value.status_code == 413
    assert os.listdir(radiology) == []


def test_rejected_cxr_cleans_up_dicom_and_png(radiology, db_session, doctor, monkeypatch, tmp_path):
    """A DICOM that fails the CXR gate must not leave either artefact on disk."""
    monkeypatch.setattr(routes, "validate_chest_xray", lambda path: (False, "Not a chest X-ray"))
    monkeypatch.setattr(routes, "is_model_connected", lambda: True)

    with pytest.raises(HTTPException) as exc:
        _run_predict(_Upload("chest.dcm", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)

    assert exc.value.status_code == 400
    assert os.listdir(radiology) == []


# --- deletion ---------------------------------------------------------------

def test_delete_removes_rendered_png_gradcam_and_dcm(radiology, db_session, doctor, monkeypatch, offline_cad, tmp_path):
    body = _run_predict(_Upload("chest.dcm", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)
    stem = os.path.splitext(os.path.basename(body["image_path"]))[0]
    with open(os.path.join(radiology, f"{stem}_gradcam.jpg"), "wb") as handle:
        handle.write(b"\xff\xd8\xff\xe0-fake")
    _as(monkeypatch, doctor.id, "doctor")

    routes.delete_prediction(prediction_id=body["id"], token="t", db=db_session)

    assert os.listdir(radiology) == []


def test_admin_delete_removes_dicom_sibling(radiology, db_session, doctor, monkeypatch, offline_cad, tmp_path):
    import app.api.admin as admin_api

    body = _run_predict(_Upload("chest.dcm", _dicom_payload(tmp_path)), db_session, doctor, monkeypatch)
    stem = os.path.splitext(os.path.basename(body["image_path"]))[0]
    assert os.path.isfile(os.path.join(radiology, f"{stem}.dcm"))

    admin_api._discard_prediction_files(body["image_path"])

    assert os.listdir(radiology) == []
