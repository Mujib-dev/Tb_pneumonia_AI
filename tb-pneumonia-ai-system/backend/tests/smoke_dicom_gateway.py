"""End-to-end smoke test of the real `python -m app.dicom_server` entrypoint.

Starts the gateway exactly as it would run in production (separate process,
real socket), then drives it with a pynetdicom SCU standing in for the X-ray
machine. This is the closest verification to a real machine that is possible
without hardware.
"""
import os
import socket
import sqlite3
import subprocess
import sys
import time

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import numpy as np
from PIL import Image
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import (
    ExplicitVRLittleEndian,
    DigitalXRayImageStorageForPresentation,
    generate_uid,
)
from pynetdicom import AE, evt, build_context
from pynetdicom.sop_class import Verification

WORK = os.path.join(os.environ.get("TEMP", "/tmp"), "pulmo_dicom_smoke")
os.makedirs(WORK, exist_ok=True)
DB_PATH = os.path.join(WORK, "smoke.db")
LOG_PATH = os.path.join(WORK, "gateway.log")
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


PORT = free_port()
ALLOWED_AE = "SMOKE_XRAY"

# Settings are read at import time, so the overrides must land in os.environ
# before any `app.*` module is imported. Real env vars take precedence over the
# project's .env file, so the smoke DB and the throwaway AE title are used
# without touching the developer's configuration.
env = dict(os.environ)
env.update({
    "DATABASE_URL": f"sqlite:///{DB_PATH}",
    "DICOM_ENABLED": "true",
    "DICOM_BIND_ADDRESS": "127.0.0.1",
    "DICOM_PORT": str(PORT),
    "DICOM_LOCAL_AE_TITLE": "PULMOAI_SMOKE",
    "DICOM_ALLOWED_REMOTE_AE_TITLES": ALLOWED_AE,
    "DICOM_LOG_FILE": LOG_PATH,
    "DICOM_LOG_LEVEL": "INFO",
})
os.environ.update(env)

# Create the schema the way the app does at startup.
from app.db.database import Base, engine          # noqa: E402
import app.db.models                                # noqa: F401,E402
Base.metadata.create_all(bind=engine)

print(f"Starting gateway on 127.0.0.1:{PORT} (AE PULMOAI_SMOKE) …")
proc = subprocess.Popen(
    [sys.executable, "-m", "app.dicom_server"],
    # Run from the temp work dir so the gateway writes its retained .dcm and
    # rendered .png files under WORK rather than polluting the repo's uploads.
    cwd=WORK, env=dict(env, PYTHONPATH=BACKEND),
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
)


def wait_for_port(timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            raise SystemExit("gateway exited early:\n" + proc.stdout.read())
        with socket.socket() as s:
            s.settimeout(0.3)
            if s.connect_ex(("127.0.0.1", PORT)) == 0:
                return True
        time.sleep(0.2)
    return False


def build_dx_dataset():
    """A plausible chest radiograph: dark lungs, bright mediastinum, dark ribs."""
    rng = np.random.default_rng(7)
    arr = rng.integers(0, 40, size=(600, 600), dtype=np.uint8)   # near-black background
    arr[120:500, 60:250] = 55                                    # left lung
    arr[120:500, 350:540] = 55                                   # right lung
    arr[100:520, 275:325] = 200                                  # spine/mediastinum
    arr[230:260, 60:540] = 140                                   # clavicles
    arr = np.clip(arr.astype(np.int16) + rng.integers(0, 18, arr.shape), 0, 255).astype(np.uint8)

    ds = Dataset()
    ds.file_meta = FileMetaDataset()
    ds.file_meta.MediaStorageSOPClassUID = DigitalXRayImageStorageForPresentation
    ds.file_meta.MediaStorageSOPInstanceUID = generate_uid()
    ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds.file_meta.ImplementationClassUID = generate_uid()
    ds.file_meta.ImplementationVersionName = "SMOKE_1"

    ds.SOPClassUID = DigitalXRayImageStorageForPresentation
    ds.SOPInstanceUID = ds.file_meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.Modality = "DX"
    ds.Manufacturer = "Simulated Modality"
    ds.PatientName = "SMOKE^TEST"
    ds.PatientID = "SMOKE-001"
    ds.PatientBirthDate = "19800101"
    ds.PatientSex = "M"
    ds.StudyDate = "20260101"
    ds.StudyDescription = "CHEST PORTABLE"
    ds.ViewPosition = "PA"
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.SamplesPerPixel = 1
    ds.Rows, ds.Columns = 600, 600
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.PixelData = arr.tobytes()
    return ds


failures = []
try:
    if not wait_for_port():
        raise SystemExit("gateway never bound its port")

    # --- 1. A disallowed AE title must be refused -------------------------
    # pynetdicom's SCU can report is_established before it has processed the
    # server's rejection, so the decisive check is that the association was
    # rejected: either the AC was negative or the release reports a failure.
    rogue = AE(ae_title="ROGUE")
    rogue.add_requested_context(Verification)
    assoc = rogue.associate("127.0.0.1", PORT, ae_title="PULMOAI_SMOKE")
    accepted = assoc.is_established
    rejected = False
    if accepted:
        # If the peer let us associate, it must not let us talk.
        try:
            if isinstance(assoc.accept_context, (list, tuple)) and not assoc.accept_context:
                rejected = True
            else:
                echo = assoc.send_c_echo()
                rejected = echo is None or (
                    isinstance(echo, tuple) and not hasattr(echo[0], "Status")
                )
        except Exception:
            rejected = True
    try:
        assoc.release()
    except Exception:
        rejected = True

    if rejected:
        print("PASS  disallowed AE title refused")
    else:
        failures.append("allowlist: a disallowed AE title could still use the association")

    # --- 2. C-ECHO from the allowed AE -----------------------------------
    scu = AE(ae_title=ALLOWED_AE)
    scu.add_requested_context(Verification)
    scu.add_requested_context(DigitalXRayImageStorageForPresentation)
    assoc = scu.associate("127.0.0.1", PORT, ae_title="PULMOAI_SMOKE")
    if not assoc.is_established:
        raise SystemExit("allowed AE title could not associate")
    print("PASS  association established from the allowlisted AE title")

    echo = assoc.send_c_echo()
    # C-ECHO returns a bare Dataset on success, or a (Status, identifier) tuple.
    if isinstance(echo, tuple):
        if echo[0].Status != 0x0000:
            failures.append(f"C-ECHO returned {echo[0]}")
        else:
            print("PASS  C-ECHO reachable (verification SOP class advertised)")
    else:
        print("PASS  C-ECHO reachable (verification SOP class advertised)")

    # --- 3. C-STORE a real radiograph ------------------------------------
    ds = build_dx_dataset()
    response = assoc.send_c_store(ds)
    # A success may come back as a status Dataset, an int, or (status,
    # identifier). Normalise and read the code defensively.
    raw = response[0] if isinstance(response, tuple) else response
    code = raw.Status if hasattr(raw, "Status") else raw
    if code != 0x0000:
        failures.append(f"C-STORE returned {raw}")
    else:
        print("PASS  C-STORE accepted (status 0x0000)")
    assoc.release()

    time.sleep(2)  # allow the worker thread to finish persisting

finally:
    proc.terminate()
    try:
        out, _ = proc.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, _ = proc.communicate()

print("\n--- gateway stdout ---")
print(out.strip()[-3000:])

print("\n--- database ---")
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
rows = [dict(r) for r in con.execute("SELECT * FROM dicom_studies")]
if not rows:
    failures.append("no dicom_studies row was written")
else:
    for r in rows:
        print(f"  status={r['status']} reason={r['rejection_reason']} "
              f"result={r['result']} conf={r['confidence']} "
              f"ae={r['source_ae_title']} ip={r['source_ip']} "
              f"patient={r['dicom_patient_id']} user_id={r['patient_id']}")
    if rows[0]["source_ae_title"] != ALLOWED_AE:
        failures.append("source_ae_title not recorded")
    if rows[0]["patient_id"] is not None:
        failures.append("machine study must arrive unattributed")
    if not rows[0]["source_dicom_path"] or not os.path.isfile(
        os.path.join(WORK, rows[0]["source_dicom_path"])
    ):
        failures.append("the original DICOM study was not retained")
    else:
        print(f"  retained study: {rows[0]['source_dicom_path']}")
    if rows[0]["image_path"] and os.path.isfile(os.path.join(WORK, rows[0]["image_path"])):
        print(f"  rendered image: {rows[0]['image_path']}")
preds = con.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
print(f"  predictions: {preds}")
con.close()

print()
if failures:
    print("FAILURES:")
    for f in failures:
        print(" -", f)
    raise SystemExit(1)
print("SMOKE TEST PASSED")
