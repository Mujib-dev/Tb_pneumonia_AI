import os

import pytest
from fastapi import HTTPException

import app.api.routes as routes
from app.db import models

UUID = "b2671aba-60ce-41f3-8476-87c3b24d516d"


@pytest.fixture()
def media(tmp_path, monkeypatch):
    """Isolate upload roots on disk, mirroring production's relative paths."""
    monkeypatch.chdir(tmp_path)
    radiology = os.path.join("uploads", "radiology")
    os.makedirs(radiology)
    monkeypatch.setattr(routes, "UPLOAD_DIR", "uploads")
    monkeypatch.setattr(routes, "RADIOLOGY_DIR", radiology)
    return radiology


def _write(radiology, name, payload=b"\xff\xd8\xff\xe0-fake"):
    path = os.path.join(radiology, name)
    with open(path, "wb") as handle:
        handle.write(payload)
    return path


def _prediction(db, doctor, image_path, result="TB"):
    row = models.Prediction(
        user_id=None,
        doctor_id=doctor.id,
        image_path=image_path,
        result=result,
        confidence=0.91,
        all_scores="{}",
    )
    db.add(row)
    db.commit()
    return row


def _as(monkeypatch, user_id, role):
    monkeypatch.setattr(
        routes, "get_current_user_from_token", lambda token: {"id": user_id, "role": role}
    )


def test_original_cxr_is_served(media, db_session, doctor, monkeypatch):
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    _prediction(db_session, doctor, original)
    _as(monkeypatch, doctor.id, "doctor")

    response = routes.get_radiology_image(filename=f"{UUID}.png", token="t", db=db_session)

    assert response.path == original
    assert response.media_type == "image/png"


def test_gradcam_heatmap_is_served(media, db_session, doctor, monkeypatch):
    """Regression: the heatmap is a sibling file, never Prediction.image_path."""
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    heatmap = _write(media, f"{UUID}_gradcam.jpg")
    _prediction(db_session, doctor, original)
    _as(monkeypatch, doctor.id, "doctor")

    response = routes.get_radiology_image(filename=f"{UUID}_gradcam.jpg", token="t", db=db_session)

    assert response.path == heatmap
    assert response.media_type == "image/jpeg"


def test_gradcam_served_for_jpg_original(media, db_session, doctor, monkeypatch):
    original = _write(media, f"{UUID}.jpg")
    heatmap = _write(media, f"{UUID}_gradcam.jpg")
    _prediction(db_session, doctor, original)
    _as(monkeypatch, doctor.id, "doctor")

    response = routes.get_radiology_image(filename=f"{UUID}_gradcam.jpg", token="t", db=db_session)

    assert response.path == heatmap


def test_heatmap_hidden_from_other_doctor(media, db_session, doctor, monkeypatch):
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    _write(media, f"{UUID}_gradcam.jpg")
    _prediction(db_session, doctor, original)

    other = models.User(
        name="Dr Other", phone="03009999999", cnic="9999999999999",
        hashed_password="x", role="doctor",
    )
    db_session.add(other)
    db_session.commit()
    _as(monkeypatch, other.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        routes.get_radiology_image(filename=f"{UUID}_gradcam.jpg", token="t", db=db_session)

    assert exc.value.status_code == 404


def test_machine_study_visible_to_any_doctor(media, db_session, doctor, monkeypatch):
    """A study pushed by the X-ray machine is unattributed until review.

    It has neither a patient nor a doctor owner, so without special handling
    the review inbox could not show the radiograph the doctor must judge.
    """
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    machine_row = models.Prediction(
        user_id=None, doctor_id=None, image_path=original,
        result="TB", confidence=0.88, all_scores="{}",
    )
    db_session.add(machine_row)
    db_session.commit()

    other = models.User(
        name="Dr Other", phone="03009999999", cnic="9999999999999",
        hashed_password="x", role="doctor",
    )
    db_session.add(other)
    db_session.commit()
    _as(monkeypatch, other.id, "doctor")

    response = routes.get_radiology_image(filename=f"{UUID}.png", token="t", db=db_session)
    assert response.path == original


def test_machine_study_hidden_from_patients(media, db_session, doctor, monkeypatch):
    """Unattributed studies stay clinician-only; a patient must not see them."""
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    machine_row = models.Prediction(
        user_id=None, doctor_id=None, image_path=original,
        result="TB", confidence=0.88, all_scores="{}",
    )
    db_session.add(machine_row)
    db_session.commit()

    patient = models.User(
        name="Patient", phone="03001112222", cnic="2222222222222",
        hashed_password="x", role="patient",
    )
    db_session.add(patient)
    db_session.commit()
    _as(monkeypatch, patient.id, "patient")

    with pytest.raises(HTTPException) as exc:
        routes.get_radiology_image(filename=f"{UUID}.png", token="t", db=db_session)

    assert exc.value.status_code == 404


def test_missing_heatmap_file_is_404(media, db_session, doctor, monkeypatch):
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    _prediction(db_session, doctor, original)
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        routes.get_radiology_image(filename=f"{UUID}_gradcam.jpg", token="t", db=db_session)

    assert exc.value.status_code == 404


@pytest.mark.parametrize("bad", ["../secret.jpg", "sub/dir.jpg"])
def test_rejects_non_basename(media, db_session, doctor, monkeypatch, bad):
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        routes.get_radiology_image(filename=bad, token="t", db=db_session)

    assert exc.value.status_code in (400, 404)


def test_requires_token(media, db_session, doctor, monkeypatch):
    _as(monkeypatch, doctor.id, "doctor")

    with pytest.raises(HTTPException) as exc:
        routes.get_radiology_image(filename=f"{UUID}.png", token=None, db=db_session)

    assert exc.value.status_code == 401


def test_delete_removes_image_and_gradcam(media, db_session, doctor, monkeypatch):
    """Deleting a record must not leave the Grad-CAM overlay orphaned on disk."""
    original = _write(media, f"{UUID}.png", b"\x89PNG\r\n\x1a\n-fake")
    heatmap = _write(media, f"{UUID}_gradcam.jpg")
    row = _prediction(db_session, doctor, original)
    prediction_id = row.id
    _as(monkeypatch, doctor.id, "doctor")

    routes.delete_prediction(prediction_id=prediction_id, token="t", db=db_session)

    assert not os.path.exists(original)
    assert not os.path.exists(heatmap)
    assert db_session.query(models.Prediction).filter(
        models.Prediction.id == prediction_id
    ).first() is None
