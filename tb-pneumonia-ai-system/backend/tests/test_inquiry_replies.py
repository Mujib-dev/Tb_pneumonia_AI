import pytest
from datetime import datetime, timedelta

from app.api.auth_utils import create_access_token, get_password_hash
from app.db import models


def _user(db, role, phone, cnic, name="Test Person"):
    user = models.User(
        name=name,
        phone=phone,
        cnic=cnic,
        hashed_password=get_password_hash("secret123"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token(user):
    return create_access_token({"sub": user.phone, "role": user.role, "id": user.id})


def _auth(user):
    return {"Authorization": f"Bearer {_token(user)}"}


@pytest.fixture()
def patient(db_session):
    return _user(db_session, "patient", "03001111111", "1111111111111", name="Asha Patient")


@pytest.fixture()
def other_patient(db_session):
    return _user(db_session, "patient", "03002222222", "2222222222222", name="Other Patient")


def _submit(client, headers=None, name="Asha Patient", whatsapp="03001111111", doctor_id=None):
    payload = {
        "name": name,
        "email": "asha@example.com",
        "whatsapp": whatsapp,
        "subject": "Persistent cough",
        "message": "I have had a cough for two weeks.",
        "doctor_id": doctor_id,
    }
    if headers is None:
        return client.post("/api/contact/submit", json=payload)
    return client.post("/api/contact/submit", json=payload, headers=headers)


def test_signed_in_patient_inquiry_is_linked_to_the_account(client, db_session, patient):
    response = _submit(client, _auth(patient))

    assert response.status_code == 200
    assert response.json()["is_from_account"] is True
    stored = db_session.query(models.ContactMessage).one()
    assert stored.sender_user_id == patient.id


def test_guest_inquiry_is_not_linked_to_any_account(client, db_session):
    response = _submit(client)

    assert response.status_code == 200
    assert response.json()["is_from_account"] is False
    stored = db_session.query(models.ContactMessage).one()
    assert stored.sender_user_id is None


def test_doctor_can_reply_to_an_account_inquiry(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)

    msg_id = db_session.query(models.ContactMessage).one().id
    response = client.post(
        f"/api/doctor/messages/{msg_id}/reply",
        json={"body": "Please book a chest X-ray."},
        headers=_auth(doctor),
    )

    assert response.status_code == 200
    assert response.json()["body"] == "Please book a chest X-ray."
    assert db_session.query(models.MessageReply).count() == 1


def test_reply_marks_the_inquiry_as_read(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id

    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"}, headers=_auth(doctor))

    assert db_session.query(models.ContactMessage).one().is_read == 1


def test_guest_inquiry_cannot_be_answered_in_app(client, db_session, doctor):
    _submit(client, doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id

    response = client.post(
        f"/api/doctor/messages/{msg_id}/reply",
        json={"body": "Hello"},
        headers=_auth(doctor),
    )

    assert response.status_code == 400
    assert "WhatsApp" in response.json()["detail"]
    assert db_session.query(models.MessageReply).count() == 0


def test_empty_reply_is_rejected(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id

    response = client.post(
        f"/api/doctor/messages/{msg_id}/reply",
        json={"body": "   "},
        headers=_auth(doctor),
    )

    assert response.status_code == 400
    assert db_session.query(models.MessageReply).count() == 0


def test_doctor_cannot_reply_to_another_doctors_inquiry(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id
    intruder = _user(db_session, "doctor", "03003333333", "3333333333333", name="Dr Other")

    response = client.post(
        f"/api/doctor/messages/{msg_id}/reply",
        json={"body": "Hello"},
        headers=_auth(intruder),
    )

    assert response.status_code == 404


def test_patient_sees_the_doctors_reply_in_their_own_inquiries(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id
    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Take this medicine."}, headers=_auth(doctor))

    response = client.get("/api/patient/inquiries", headers=_auth(patient))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["is_from_account"] is True
    assert [r["body"] for r in payload[0]["replies"]] == ["Take this medicine."]


def test_patient_does_not_see_another_patients_inquiries(client, db_session, patient, other_patient):
    _submit(client, _auth(patient))

    response = client.get("/api/patient/inquiries", headers=_auth(other_patient))

    assert response.status_code == 200
    assert response.json() == []


def test_patient_inquiries_requires_authentication(client, db_session):
    response = client.get("/api/patient/inquiries")

    assert response.status_code == 401


def test_doctor_cannot_use_the_patient_inbox(client, db_session, doctor):
    response = client.get("/api/patient/inquiries", headers=_auth(doctor))

    assert response.status_code == 403


def test_replying_requires_authentication(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id

    response = client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"})

    assert response.status_code == 401


def test_deleting_an_inquiry_removes_its_replies(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    msg_id = db_session.query(models.ContactMessage).one().id
    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"}, headers=_auth(doctor))
    assert db_session.query(models.MessageReply).count() == 1

    response = client.delete(f"/api/doctor/messages/{msg_id}", headers=_auth(doctor))

    assert response.status_code == 200
    assert db_session.query(models.MessageReply).count() == 0


def test_doctor_message_list_flags_guest_and_account_inquiries(client, db_session, doctor, patient):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    _submit(client, name="Walk Up Guest", whatsapp="03009999999", doctor_id=doctor.id)

    response = client.get("/api/doctor/messages", headers=_auth(doctor))

    assert response.status_code == 200
    payload = response.json()
    assert {m["is_from_account"] for m in payload} == {True, False}


def _send_as(client, patient, doctor, **overrides):
    _submit(client, _auth(patient), doctor_id=doctor.id)
    return db_id(client, patient)


def db_id(client, patient):
    listing = client.get("/api/patient/inquiries", headers=_auth(patient))
    return listing.json()[0]["id"]


def test_patient_can_edit_within_the_one_minute_window(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)

    response = client.put(
        f"/api/patient/inquiries/{msg_id}",
        json={"subject": "Corrected subject", "message": "Corrected body"},
        headers=_auth(patient),
    )

    assert response.status_code == 200
    assert response.json()["subject"] == "Corrected subject"
    assert response.json()["message"] == "Corrected body"


def test_editing_is_refused_after_the_one_minute_window(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)
    stored = db_session.query(models.ContactMessage).one()
    stored.created_at = datetime.utcnow() - timedelta(minutes=2)
    db_session.commit()

    response = client.put(
        f"/api/patient/inquiries/{msg_id}",
        json={"message": "Too late"},
        headers=_auth(patient),
    )

    assert response.status_code == 400
    assert "1 minute" in response.json()["detail"]


def test_editing_is_refused_once_the_doctor_has_replied(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)
    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"}, headers=_auth(doctor))

    response = client.put(
        f"/api/patient/inquiries/{msg_id}",
        json={"message": "Changed my mind"},
        headers=_auth(patient),
    )

    assert response.status_code == 400
    assert "already replied" in response.json()["detail"]


def test_empty_edit_is_rejected(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)

    response = client.put(
        f"/api/patient/inquiries/{msg_id}",
        json={"message": "   "},
        headers=_auth(patient),
    )

    assert response.status_code == 400


def test_patient_sees_which_doctor_they_wrote_to(client, db_session, doctor, patient):
    doctor.specialization = "Pulmonology"
    db_session.commit()
    _submit(client, _auth(patient), doctor_id=doctor.id)

    response = client.get("/api/patient/inquiries", headers=_auth(patient))

    assert response.status_code == 200
    entry = response.json()[0]
    assert entry["doctor_name"] == doctor.name
    assert entry["doctor_specialization"] == "Pulmonology"


def test_general_enquiry_has_no_doctor_attached(client, db_session, patient):
    _submit(client, _auth(patient))

    response = client.get("/api/patient/inquiries", headers=_auth(patient))

    assert response.status_code == 200
    entry = response.json()[0]
    assert entry["doctor_name"] is None
    assert entry["doctor_specialization"] is None


def test_patient_cannot_edit_another_patients_inquiry(client, db_session, doctor, patient, other_patient):
    msg_id = _send_as(client, patient, doctor)

    response = client.put(
        f"/api/patient/inquiries/{msg_id}",
        json={"message": "Not mine"},
        headers=_auth(other_patient),
    )

    assert response.status_code == 404


def test_edit_marks_the_inquiry_unread_again(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)
    stored = db_session.query(models.ContactMessage).one()
    stored.is_read = 1
    db_session.commit()

    client.put(f"/api/patient/inquiries/{msg_id}", json={"message": "Edited"}, headers=_auth(patient))

    assert db_session.query(models.ContactMessage).one().is_read == 0


def test_patient_can_delete_own_inquiry_and_its_replies(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)
    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"}, headers=_auth(doctor))

    response = client.delete(f"/api/patient/inquiries/{msg_id}", headers=_auth(patient))

    assert response.status_code == 200
    assert db_session.query(models.ContactMessage).count() == 0
    assert db_session.query(models.MessageReply).count() == 0


def test_patient_cannot_delete_another_patients_inquiry(client, db_session, doctor, patient, other_patient):
    msg_id = _send_as(client, patient, doctor)

    response = client.delete(f"/api/patient/inquiries/{msg_id}", headers=_auth(other_patient))

    assert response.status_code == 404
    assert db_session.query(models.ContactMessage).count() == 1


def test_patient_cannot_edit_or_delete_while_signed_out(client, db_session, doctor, patient):
    msg_id = _send_as(client, patient, doctor)

    assert client.put(f"/api/patient/inquiries/{msg_id}", json={"message": "x"}).status_code == 401
    assert client.delete(f"/api/patient/inquiries/{msg_id}").status_code == 401


def test_deleting_a_patient_account_removes_their_inquiries(client, db_session, doctor, patient):
    """sender_user_id is a real FK, so the admin cleanup has to clear it first."""
    msg_id = _send_as(client, patient, doctor)
    client.post(f"/api/doctor/messages/{msg_id}/reply", json={"body": "Hello"}, headers=_auth(doctor))
    admin = _user(db_session, "admin", "03004444444", "4444444444444", name="Admin")

    response = client.delete(f"/api/admin/users/{patient.id}", headers=_auth(admin))

    assert response.status_code == 200
    assert db_session.query(models.ContactMessage).count() == 0
    assert db_session.query(models.MessageReply).count() == 0
