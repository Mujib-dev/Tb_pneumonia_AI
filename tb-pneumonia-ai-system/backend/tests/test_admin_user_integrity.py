"""Admin user-management integrity.

`/doctor/search-patient` matches a digits-only query against BOTH the `cnic` and
`phone` columns and returns the first hit, so a duplicate identity silently makes
the directory point at the wrong patient. These tests pin the uniqueness rule that
prevents an admin edit from creating one.
"""

import json
import pytest

from app.api.auth_utils import create_access_token, get_password_hash
from app.db import models


def _user(db_session, role, phone, cnic, name="Test Person", profile_pic=None):
    user = models.User(
        name=name,
        phone=phone,
        cnic=cnic,
        hashed_password=get_password_hash("secret123"),
        role=role,
        profile_pic=profile_pic,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth(user):
    token = create_access_token({"sub": user.phone, "role": user.role, "id": user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin(db_session):
    return _user(db_session, "admin", "03009999999", "1999999999999", name="Site Admin")


@pytest.fixture()
def patient_a(db_session):
    return _user(db_session, "patient", "03001234567", "1234512345671", name="Patient A")


@pytest.fixture()
def patient_b(db_session):
    return _user(db_session, "patient", "03111234567", "1234512345672", name="Patient B")


def test_duplicate_cnic_is_rejected(client, db_session, admin, patient_a, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"cnic": patient_a.cnic},
        headers=_auth(admin),
    )

    assert response.status_code == 409
    assert "Patient A" in response.json()["detail"]
    db_session.refresh(patient_b)
    assert patient_b.cnic == "1234512345672", "rejected edit must not be persisted"


def test_duplicate_phone_is_rejected(client, db_session, admin, patient_a, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"phone": patient_a.phone},
        headers=_auth(admin),
    )

    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


def test_phone_cannot_reuse_another_users_cnic(client, admin, patient_a, patient_b):
    """Cross-column collision: search matches cnic OR phone, so this is ambiguous too."""
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"phone": patient_a.cnic},
        headers=_auth(admin),
    )

    assert response.status_code == 409


def test_cnic_cannot_reuse_another_users_phone(client, admin, patient_a, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"cnic": patient_a.phone},
        headers=_auth(admin),
    )

    assert response.status_code == 409


def test_formatted_duplicate_is_still_detected(client, db_session, admin, patient_b):
    """A legacy "+92 348 1974606" row must not be able to hide behind its formatting."""
    legacy = _user(db_session, "patient", "+92 348 1974606", "1234512345673", name="Legacy Row")

    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"cnic": "923481974606"},
        headers=_auth(admin),
    )

    assert response.status_code == 409
    assert "Legacy Row" in response.json()["detail"]


def test_saving_unchanged_identity_is_allowed(client, db_session, admin, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"name": "Renamed", "cnic": patient_b.cnic, "phone": patient_b.phone},
        headers=_auth(admin),
    )

    assert response.status_code == 200
    db_session.refresh(patient_b)
    assert patient_b.name == "Renamed"


def test_unique_identity_is_accepted_and_normalised(client, db_session, admin, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"cnic": "35202-0284635", "phone": "0311-1234567"},
        headers=_auth(admin),
    )

    assert response.status_code == 200
    db_session.refresh(patient_b)
    assert patient_b.cnic == "352020284635"
    assert patient_b.phone == "03111234567"


def test_name_only_edit_skips_identity_checks(client, db_session, admin, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"name": "Just A Rename"},
        headers=_auth(admin),
    )

    assert response.status_code == 200
    db_session.refresh(patient_b)
    assert patient_b.name == "Just A Rename"


def test_blank_identity_is_not_treated_as_duplicate(client, db_session, admin, patient_a, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"phone": ""},
        headers=_auth(admin),
    )

    assert response.status_code == 200


def test_non_admin_cannot_edit_user_details(client, patient_b):
    response = client.put(
        f"/api/admin/users/{patient_b.id}/details",
        json={"cnic": "9999999999999"},
        headers=_auth(patient_b),
    )

    assert response.status_code == 403


def test_delete_user_with_profile_picture_succeeds(client, db_session, admin, tmp_path):
    """Regression: the cleanup branch referenced `os` without importing it."""
    pic = tmp_path / "avatar.png"
    pic.write_bytes(b"\x89PNG\r\n\x1a\n")
    target = _user(
        db_session, "patient", "03221234567", "1234512345679",
        name="Has Avatar", profile_pic=str(pic),
    )

    response = client.delete(f"/api/admin/users/{target.id}", headers=_auth(admin))

    assert response.status_code == 200
    assert not pic.exists(), "profile picture should be removed from disk"
    assert db_session.query(models.User).filter(models.User.id == target.id).first() is None

# --- contact settings validation -------------------------------------------------
# The public Contact/Footer pages build mailto:, tel: and wa.me/ links straight from
# these settings, so a malformed value silently breaks the direct-contact channels.

def test_contact_settings_reject_malformed_whatsapp(client, admin):
    response = client.put(
        "/api/admin/settings/contact",
        json={"contact_whatsapp": json.dumps(["not a number"])},
        headers=_auth(admin),
    )

    assert response.status_code == 422
    assert "contact_whatsapp" in response.json()["detail"]


def test_contact_settings_reject_malformed_email(client, admin):
    response = client.put(
        "/api/admin/settings/contact",
        json={"contact_email": json.dumps(["missing-at-sign.example.com"])},
        headers=_auth(admin),
    )

    assert response.status_code == 422
    assert "contact_email" in response.json()["detail"]


def test_contact_settings_rejection_persists_nothing(client, db_session, admin):
    """A rejected payload must not partially apply."""
    good_address = "Khwaza khela swat"

    response = client.put(
        "/api/admin/settings/contact",
        json={
            "contact_address": good_address,
            "contact_whatsapp": json.dumps(["nope"]),
        },
        headers=_auth(admin),
    )

    assert response.status_code == 422
    stored = (
        db_session.query(models.SiteSettings)
        .filter(models.SiteSettings.setting_key == "contact_address")
        .first()
    )
    assert stored is None or stored.setting_value != good_address


def test_contact_settings_accept_wellformed_values(client, db_session, admin):
    response = client.put(
        "/api/admin/settings/contact",
        json={
            "contact_email": json.dumps(["mujiburrahman.dev@gmail.com"]),
            "contact_phone": json.dumps(["+92 3481974606"]),
            "contact_whatsapp": json.dumps(["+923481974606"]),
        },
        headers=_auth(admin),
    )

    assert response.status_code == 200
    stored = {
        s.setting_key: s.setting_value
        for s in db_session.query(models.SiteSettings).all()
    }
    assert stored["contact_whatsapp"] == json.dumps(["+923481974606"])
    assert stored["contact_phone"] == json.dumps(["+92 3481974606"])

# --- clinical oversight ---------------------------------------------------------

def test_admin_can_list_predictions(client, db_session, admin, patient_a):
    db_session.add(
        models.Prediction(
            user_id=patient_a.id,
            doctor_id=admin.id,
            image_path=None,
            result="Pneumonia",
            confidence=0.91,
        )
    )
    db_session.commit()

    response = client.get("/api/admin/predictions", headers=_auth(admin))

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["records"][0]["result"] == "Pneumonia"
    assert body["records"][0]["patient_name"] == patient_a.name


def test_admin_can_delete_prediction_and_its_files(client, db_session, admin, patient_a, tmp_path):
    image = tmp_path / "scan.jpg"
    image.write_bytes(b"jpeg-bytes")
    gradcam = tmp_path / "scan_gradcam.jpg"
    gradcam.write_bytes(b"overlay-bytes")

    prediction = models.Prediction(
        user_id=patient_a.id,
        doctor_id=admin.id,
        image_path=str(image),
        result="TB",
        confidence=0.88,
    )
    db_session.add(prediction)
    db_session.commit()
    prediction_id = prediction.id

    response = client.delete(f"/api/admin/predictions/{prediction_id}", headers=_auth(admin))

    assert response.status_code == 200
    assert db_session.query(models.Prediction).filter_by(id=prediction_id).first() is None
    assert not image.exists(), "radiograph left on disk"
    assert not gradcam.exists(), "Grad-CAM overlay left on disk"


def test_deleting_prediction_404s_for_unknown_id(client, admin):
    response = client.delete("/api/admin/predictions/999999", headers=_auth(admin))

    assert response.status_code == 404


def test_admin_can_list_and_delete_appointments(client, db_session, admin, patient_a):
    appointment = models.Appointment(
        doctor_id=admin.id,
        patient_id=patient_a.id,
        booking_date="2026-01-05",
        token_number=1,
        status="pending",
    )
    db_session.add(appointment)
    db_session.commit()
    appointment_id = appointment.id

    listing = client.get("/api/admin/appointments", headers=_auth(admin))
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["records"][0]["patient_name"] == patient_a.name

    removed = client.delete(f"/api/admin/appointments/{appointment_id}", headers=_auth(admin))
    assert removed.status_code == 200
    assert db_session.query(models.Appointment).filter_by(id=appointment_id).first() is None


def test_non_admin_cannot_reach_clinical_oversight(client, db_session, patient_a):
    """Oversight must not become a way for a doctor to delete other doctors' work."""
    doctor = _user(db_session, "doctor", "03007777777", "1777777777777", name="Doctor One")
    for method, path in [
        ("get", "/api/admin/predictions"),
        ("get", "/api/admin/appointments"),
        ("delete", "/api/admin/predictions/1"),
        ("delete", "/api/admin/appointments/1"),
    ]:
        response = getattr(client, method)(path, headers=_auth(doctor))
        assert response.status_code == 403, path
