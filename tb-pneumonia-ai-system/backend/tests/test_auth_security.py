import io

import pytest

from app.api.auth_utils import get_password_hash
from app.db import models


def _png_bytes():
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00"
        b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _register_form(role, access_code=None):
    fields = {
        "name": "Test Person",
        "phone": "03001234567",
        "cnic": "1234512345671",
        "password": "secret123",
        "role": role,
    }
    if access_code:
        fields["access_code"] = access_code
    return {
        "data": fields,
        "files": {"profile_pic": ("pic.png", io.BytesIO(_png_bytes()), "image/png")},
    }


def _create_patient(db_session, phone="03001234567", cnic="1234512345671"):
    user = models.User(
        name="Test Person",
        phone=phone,
        cnic=cnic,
        hashed_password=get_password_hash("secret123"),
        role="patient",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_registration_cannot_escalate_to_admin(client, db_session):
    response = client.post("/api/auth/register", **_register_form("admin"))

    assert response.status_code == 403
    assert "registered by their attending doctor" in response.json()["detail"]


def test_registration_rejects_unknown_role(client, db_session):
    response = client.post("/api/auth/register", **_register_form("superuser"))

    assert response.status_code == 403


def test_patient_self_registration_is_rejected(client, db_session):
    response = client.post("/api/auth/register", **_register_form("patient"))

    assert response.status_code == 403
    assert db_session.query(models.User).filter(models.User.phone == "03001234567").first() is None


def test_doctor_registration_requires_access_code(client, db_session):
    response = client.post("/api/auth/register", **_register_form("doctor"))

    assert response.status_code == 400
    assert "Authorization Code" in response.json()["detail"]


def test_doctor_registration_with_valid_code_succeeds(client, db_session):
    response = client.post("/api/auth/register", **_register_form("doctor", access_code="TESTDOCTORKEY"))

    assert response.status_code == 200


def test_reset_password_requires_current_password(client, db_session):
    _create_patient(db_session)

    response = client.post(
        "/api/auth/reset-password",
        json={"identifier": "03001234567", "new_password": "brandnew1"},
    )

    assert response.status_code == 400
    assert "Current password" in response.json()["detail"]


def test_reset_password_rejects_wrong_current_password(client, db_session):
    _create_patient(db_session)

    response = client.post(
        "/api/auth/reset-password",
        json={
            "identifier": "03001234567",
            "current_password": "wrongpass",
            "new_password": "brandnew1",
        },
    )

    assert response.status_code == 401


def test_reset_password_succeeds_with_current_password(client, db_session):
    _create_patient(db_session)

    response = client.post(
        "/api/auth/reset-password",
        json={
            "identifier": "03001234567",
            "current_password": "secret123",
            "new_password": "brandnew1",
        },
    )

    assert response.status_code == 200

    user = db_session.query(models.User).filter(models.User.phone == "03001234567").first()
    from app.api.auth_utils import verify_password

    assert verify_password("brandnew1", user.hashed_password)


def test_radiology_media_requires_authentication(client, db_session, tmp_path, monkeypatch):
    from app.api import routes

    image_file = tmp_path / "xray.png"
    image_file.write_bytes(_png_bytes())
    monkeypatch.setattr(routes, "_is_safe_media_path", lambda p: True)

    prediction = models.Prediction(
        user_id=None,
        doctor_id=None,
        image_path=str(image_file),
        result="Normal",
        confidence=0.9,
    )
    db_session.add(prediction)
    db_session.commit()

    unauthenticated = client.get("/api/media/radiology/xray.png")
    assert unauthenticated.status_code == 401

    bogus = client.get("/api/media/radiology/xray.png?token=not-a-real-jwt")
    assert bogus.status_code == 401


def test_doctor_cannot_delete_another_doctors_prediction(client, db_session):
    from app.api.auth_utils import create_access_token

    owner = models.User(
        name="Dr Owner",
        phone="03000000001",
        cnic="1111111111111",
        hashed_password=get_password_hash("secret123"),
        role="doctor",
    )
    other = models.User(
        name="Dr Other",
        phone="03000000002",
        cnic="2222222222222",
        hashed_password=get_password_hash("secret123"),
        role="doctor",
    )
    db_session.add_all([owner, other])
    db_session.commit()

    prediction = models.Prediction(
        user_id=None, doctor_id=owner.id, image_path="uploads/radiology/x.png", result="TB", confidence=0.5
    )
    db_session.add(prediction)
    db_session.commit()

    token = create_access_token({"sub": other.phone, "role": "doctor", "id": other.id})
    response = client.delete(
        f"/api/doctor/delete-prediction/{prediction.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_patient_cannot_see_another_patients_screening(client, db_session, tmp_path, monkeypatch):
    from app.api import routes
    from app.api.auth_utils import create_access_token

    monkeypatch.setattr(routes, "_is_safe_media_path", lambda p: True)

    owner = models.User(
        name="Patient A",
        phone="03000000003",
        cnic="3333333333333",
        hashed_password=get_password_hash("secret123"),
        role="patient",
    )
    other = models.User(
        name="Patient B",
        phone="03000000004",
        cnic="4444444444444",
        hashed_password=get_password_hash("secret123"),
        role="patient",
    )
    db_session.add_all([owner, other])
    db_session.commit()

    image_file = tmp_path / "b.png"
    image_file.write_bytes(_png_bytes())

    prediction = models.Prediction(
        user_id=owner.id, doctor_id=None, image_path=str(image_file), result="Normal", confidence=0.8
    )
    db_session.add(prediction)
    db_session.commit()

    token = create_access_token({"sub": other.phone, "role": "patient", "id": other.id})
    response = client.get(f"/api/media/radiology/b.png?token={token}")

    assert response.status_code == 404


def test_patient_can_view_own_screening(client, db_session, tmp_path, monkeypatch):
    from app.api import routes
    from app.api.auth_utils import create_access_token

    monkeypatch.setattr(routes, "_is_safe_media_path", lambda p: True)

    patient = models.User(
        name="Patient A",
        phone="03000000005",
        cnic="5555555555555",
        hashed_password=get_password_hash("secret123"),
        role="patient",
    )
    db_session.add(patient)
    db_session.commit()

    image_file = tmp_path / "own.png"
    image_file.write_bytes(_png_bytes())

    prediction = models.Prediction(
        user_id=patient.id, doctor_id=None, image_path=str(image_file), result="Normal", confidence=0.8
    )
    db_session.add(prediction)
    db_session.commit()

    token = create_access_token({"sub": patient.phone, "role": "patient", "id": patient.id})
    response = client.get(f"/api/media/radiology/own.png?token={token}")

    assert response.status_code == 200
    assert response.content == _png_bytes()


def test_media_route_rejects_path_traversal(client, db_session):
    from app.api.auth_utils import create_access_token

    patient = models.User(
        name="Patient C",
        phone="03000000006",
        cnic="6666666666666",
        hashed_password=get_password_hash("secret123"),
        role="patient",
    )
    db_session.add(patient)
    db_session.commit()

    token = create_access_token({"sub": patient.phone, "role": "patient", "id": patient.id})
    response = client.get(
        f"/api/media/radiology/..%2F..%2F.env?token={token}"
    )

    assert response.status_code in (400, 404)


def _token_for(user):
    from app.api.auth_utils import create_access_token

    return create_access_token({"sub": user.phone, "role": user.role, "id": user.id})


def _make_user(db_session, role, phone, cnic, name="Role Probe"):
    user = models.User(
        name=name,
        phone=phone,
        cnic=cnic,
        hashed_password=get_password_hash("secret123"),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_admin_cannot_read_doctor_dashboard(client, db_session):
    """The doctor dashboard exposes only doctor-gated actions, so it must be doctor-only.

    Admins were previously admitted and then received 403 from search-patient,
    register-patient, link/unlink/update-patient and payments.
    """
    admin = _make_user(db_session, "admin", "03007777777", "1777777777777")

    response = client.get(
        "/api/doctor/dashboard",
        headers={"Authorization": f"Bearer {_token_for(admin)}"},
    )

    assert response.status_code == 403


def test_doctor_can_read_doctor_dashboard(client, db_session, doctor):
    response = client.get(
        "/api/doctor/dashboard",
        headers={"Authorization": f"Bearer {_token_for(doctor)}"},
    )

    assert response.status_code == 200
    assert "patients" in response.json()
    assert "records" in response.json()


def test_patient_cannot_read_doctor_dashboard(client, db_session):
    patient = _make_user(db_session, "patient", "03006666666", "1666666666666")

    response = client.get(
        "/api/doctor/dashboard",
        headers={"Authorization": f"Bearer {_token_for(patient)}"},
    )

    assert response.status_code == 403


def test_doctor_dashboard_and_its_actions_share_one_role(client, db_session, doctor):
    """Guards must agree, otherwise the UI renders controls that always fail."""
    admin = _make_user(db_session, "admin", "03005555555", "1555555555555")
    admin_headers = {"Authorization": f"Bearer {_token_for(admin)}"}

    gated = [
        "/api/doctor/dashboard",
        "/api/doctor/search-patient?identifier=1560504022119",
        "/api/doctor/payments",
    ]
    for path in gated:
        assert client.get(path, headers=admin_headers).status_code == 403, path

    doctor_headers = {"Authorization": f"Bearer {_token_for(doctor)}"}
    for path in gated:
        assert client.get(path, headers=doctor_headers).status_code == 200, path

# --- public queue must not disclose patient identity -----------------------------

def _doctor_with_patients(db_session, client):
    """A doctor with two booked patients on a fixed date, returned as (doctor, date)."""
    from app.api.auth_utils import create_access_token

    doctor = models.User(
        name="Dr Queue",
        phone="03001230001",
        cnic="9000123000011",
        hashed_password=get_password_hash("secret123"),
        role="doctor",
    )
    patients = [
        models.User(
            name=name,
            phone=f"0300123000{i}",
            cnic=f"90001230001{i}1",
            hashed_password=get_password_hash("secret123"),
            role="patient",
        )
        for i, name in enumerate(("Ayesha Siddiqui", "Bilal"), start=2)
    ]
    db_session.add(doctor)
    db_session.add_all(patients)
    db_session.commit()
    date = "2026-03-04"
    for token, patient in enumerate(patients, start=1):
        db_session.add(
            models.Appointment(
                doctor_id=doctor.id,
                patient_id=patient.id,
                booking_date=date,
                token_number=token,
                status="pending",
                fee_charged=1500,
            )
        )
    db_session.commit()
    return doctor, date


def test_public_queue_masks_patient_names(client, db_session):
    doctor, date = _doctor_with_patients(db_session, client)

    response = client.get(
        f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}"
    )

    assert response.status_code == 200, "public queue should stay reachable"
    body = response.text
    assert "Ayesha" not in body, "full patient name leaked to an anonymous caller"
    assert "Siddiqui" not in body
    assert "Bilal" not in body
    assert "A. S." in body and "B." in body


def test_public_queue_withholds_fees(client, db_session):
    doctor, date = _doctor_with_patients(db_session, client)

    response = client.get(
        f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}"
    )

    assert response.status_code == 200
    assert "fee_charged" not in response.json()[0]


def test_public_queue_still_returns_token_and_status(client, db_session):
    """Masking must not break the waiting-room display."""
    doctor, date = _doctor_with_patients(db_session, client)

    record = client.get(
        f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}"
    ).json()[0]

    assert record["token_number"] == 1
    assert record["status"] == "pending"
    assert record["id"] > 0


def test_signed_in_callers_get_full_patient_names(client, db_session):
    """The booking page is behind a login, so it must render real names."""
    doctor, date = _doctor_with_patients(db_session, client)
    patient = _make_user(db_session, "patient", "03007777777", "1777777777777")
    path = f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}"

    response = client.get(
        path, headers={"Authorization": f"Bearer {_token_for(patient)}"}
    )

    assert response.status_code == 200
    names = [record["patient_name"] for record in response.json()]
    assert names == ["Ayesha Siddiqui", "Bilal"]


def test_signed_in_queue_still_withholds_fees(client, db_session):
    """Widening the name must not drag the fee back into the response."""
    doctor, date = _doctor_with_patients(db_session, client)
    patient = _make_user(db_session, "patient", "03008888888", "1888888888888")

    response = client.get(
        f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}",
        headers={"Authorization": f"Bearer {_token_for(patient)}"},
    )

    assert response.status_code == 200
    assert "fee_charged" not in response.json()[0]


def test_bad_token_falls_back_to_masking_instead_of_401(client, db_session):
    """The route stays public, so a stale session degrades rather than breaks."""
    doctor, date = _doctor_with_patients(db_session, client)

    response = client.get(
        f"/api/appointments/doctor-queue-public?doctor_id={doctor.id}&date={date}",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 200
    body = response.text
    assert "Ayesha" not in body and "Bilal" not in body
    assert "A. S." in body and "B." in body
