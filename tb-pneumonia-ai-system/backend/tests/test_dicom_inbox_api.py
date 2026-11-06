import os

import pytest
from fastapi import HTTPException

import app.api.dicom_routes as dicom_routes
from app.db import models

UUID = "9f1c0d5e-9a4b-4f1e-9a3d-2b7c6d5e4f30"


@pytest.fixture()
def media(tmp_path, monkeypatch):
    """Isolate the radiology root, mirroring production's relative paths."""
    monkeypatch.chdir(tmp_path)
    radiology = os.path.join("uploads", "radiology")
    os.makedirs(radiology, exist_ok=True)
    monkeypatch.setattr(dicom_routes, "RADIOLOGY_DIR", radiology)
    return radiology


def _as(monkeypatch, user_id, role):
    monkeypatch.setattr(
        dicom_routes, "get_current_user_from_token",
        lambda token: {"id": user_id, "role": role},
    )


@pytest.fixture()
def patient(db_session):
    row = models.User(
        name="Ali Patient", phone="03009998877", cnic="1234567890123",
        hashed_password="x", role="patient",
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


def _machine_study(db, *, status="analysed", image_path=None, with_prediction=True):
    prediction = None
    if with_prediction:
        prediction = models.Prediction(
            user_id=None, doctor_id=None, image_path=image_path,
            result="TB", confidence=0.87, all_scores='{"TB": 0.87}',
        )
        db.add(prediction)
        db.flush()

    study = models.DicomStudy(
        patient_id=None,
        prediction_id=prediction.id if prediction else None,
        study_instance_uid="1.2.3.4",
        sop_instance_uid="1.2.3.4.5",
        source_ae_title="XRAY01",
        modality="DX",
        dicom_patient_id="HOSP-77",
        dicom_patient_name="MACHINE^PATIENT",
        image_path=image_path,
        source_dicom_path=None,
        status=status,
        result=prediction.result if prediction else None,
        confidence=prediction.confidence if prediction else None,
        rejection_reason=None if status == "analysed" else "not_a_chest_xray",
    )
    db.add(study)
    db.commit()
    db.refresh(study)
    return study


# --------------------------------------------------------------------------
# Access control
# --------------------------------------------------------------------------

def test_patient_cannot_read_the_inbox(db_session, doctor, monkeypatch):
    patient = models.User(
        name="Nosy", phone="03005554444", cnic="9999999999999",
        hashed_password="x", role="patient",
    )
    db_session.add(patient)
    db_session.commit()
    _as(monkeypatch, patient.id, "patient")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.list_pending_studies(token="t", db=db_session)

    assert exc.value.status_code == 403


def test_doctor_can_read_the_inbox(db_session, doctor, monkeypatch):
    _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    rows = dicom_routes.list_pending_studies(token="t", db=db_session)

    assert len(rows) == 1
    assert rows[0]["status"] == "analysed"
    assert rows[0]["result"] == "TB"
    assert rows[0]["source_ae_title"] == "XRAY01"


def test_gateway_status_never_claims_machine_verified(db_session, doctor, monkeypatch):
    _as(monkeypatch, doctor.id, "doctor")

    status = dicom_routes.dicom_gateway_status(token="t", db=db_session)

    assert status["machine_integration_verified"] is False
    assert status["local_ae_title"]
    assert status["port"] == 11112


# --------------------------------------------------------------------------
# Listing
# --------------------------------------------------------------------------

def test_inbox_hides_already_attached_studies(db_session, doctor, patient, monkeypatch):
    study = _machine_study(db_session)
    study.patient_id = patient.id
    db_session.commit()
    _as(monkeypatch, doctor.id, "doctor")

    assert dicom_routes.list_pending_studies(token="t", db=db_session) == []


def test_rejection_reason_gets_a_readable_label(db_session, doctor, monkeypatch):
    _machine_study(db_session, status="rejected", with_prediction=False)
    _as(monkeypatch, doctor.id, "doctor")

    row = dicom_routes.list_pending_studies(token="t", db=db_session)[0]

    assert row["status"] == "rejected"
    assert row["rejection_label"] == "Not a chest radiograph"


def test_dicom_files_are_not_served_over_http(db_session, doctor, monkeypatch):
    """Only rendered PNGs are servable; the original .dcm must not be exposed."""
    _machine_study(db_session, status="rejected", with_prediction=False)
    _as(monkeypatch, doctor.id, "doctor")

    row = dicom_routes.list_pending_studies(token="t", db=db_session)[0]

    assert row["image_url"] is None
    assert row["heatmap_url"] is None


# --------------------------------------------------------------------------
# Attaching
# --------------------------------------------------------------------------

def test_attach_links_study_and_prediction(db_session, doctor, patient, monkeypatch):
    db_session.add(models.DoctorPatient(doctor_id=doctor.id, patient_id=patient.id))
    db_session.commit()
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    result = dicom_routes.attach_study_to_patient(
        study.id, {"patient_identifier": "0300 9998877"}, token="t", db=db_session
    )

    assert patient.name in result["message"]
    db_session.refresh(study)
    assert study.patient_id == patient.id
    prediction = db_session.query(models.Prediction).filter(
        models.Prediction.id == study.prediction_id
    ).one()
    assert prediction.user_id == patient.id


def test_attach_accepts_cnic(db_session, doctor, patient, monkeypatch):
    db_session.add(models.DoctorPatient(doctor_id=doctor.id, patient_id=patient.id))
    db_session.commit()
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    dicom_routes.attach_study_to_patient(
        study.id, {"patient_identifier": "12345-6789012-3"}, token="t", db=db_session
    )

    db_session.refresh(study)
    assert study.patient_id == patient.id


def test_attach_rejects_unknown_patient(db_session, doctor, monkeypatch):
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.attach_study_to_patient(
            study.id, {"patient_identifier": "03007776666"}, token="t", db=db_session
        )

    assert exc.value.status_code == 404
    db_session.refresh(study)
    assert study.patient_id is None, "a failed attach must not partially link"


def test_attach_requires_linked_patient(db_session, doctor, patient, monkeypatch):
    """A doctor may only attach a patient already in their own registry."""
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.attach_study_to_patient(
            study.id, {"patient_identifier": patient.phone}, token="t", db=db_session
        )

    assert exc.value.status_code == 403


def test_attach_rejected_study(db_session, doctor, patient, monkeypatch):
    db_session.add(models.DoctorPatient(doctor_id=doctor.id, patient_id=patient.id))
    db_session.commit()
    study = _machine_study(db_session, status="rejected", with_prediction=False)
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.attach_study_to_patient(
            study.id, {"patient_identifier": patient.phone}, token="t", db=db_session
        )

    assert exc.value.status_code == 400


def test_attach_twice_is_rejected(db_session, doctor, patient, monkeypatch):
    db_session.add(models.DoctorPatient(doctor_id=doctor.id, patient_id=patient.id))
    db_session.commit()
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    dicom_routes.attach_study_to_patient(
        study.id, {"patient_identifier": patient.phone}, token="t", db=db_session
    )
    with pytest.raises(HTTPException) as exc:
        dicom_routes.attach_study_to_patient(
            study.id, {"patient_identifier": patient.phone}, token="t", db=db_session
        )

    assert exc.value.status_code == 400


def test_attach_requires_identifier(db_session, doctor, monkeypatch):
    study = _machine_study(db_session)
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.attach_study_to_patient(study.id, {}, token="t", db=db_session)

    assert exc.value.status_code == 400


# --------------------------------------------------------------------------
# Discarding
# --------------------------------------------------------------------------

def test_discard_removes_files_and_row(media, db_session, doctor, monkeypatch):
    image = os.path.join(media, f"{UUID}.png")
    heatmap = os.path.join(media, f"{UUID}_gradcam.jpg")
    original = os.path.join(media, f"{UUID}.dcm")
    for path in (image, heatmap, original):
        with open(path, "wb") as handle:
            handle.write(b"data")

    study = _machine_study(db_session, image_path=image)
    study.source_dicom_path = original
    db_session.commit()
    _as(monkeypatch, doctor.id, "doctor")

    dicom_routes.discard_pending_study(study.id, token="t", db=db_session)

    assert not os.path.exists(image)
    assert not os.path.exists(heatmap)
    assert not os.path.exists(original)
    assert db_session.query(models.DicomStudy).filter(
        models.DicomStudy.id == study.id
    ).first() is None


def test_discard_refuses_attached_study(db_session, doctor, patient, monkeypatch):
    study = _machine_study(db_session)
    study.patient_id = patient.id
    db_session.commit()
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        dicom_routes.discard_pending_study(study.id, token="t", db=db_session)

    assert exc.value.status_code == 400
    assert db_session.query(models.DicomStudy).filter(
        models.DicomStudy.id == study.id
    ).first() is not None
