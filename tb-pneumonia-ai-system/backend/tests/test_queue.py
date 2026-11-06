from datetime import timedelta

import pytest

from app.db import models
from app.services import queue as q


def _make_appointment(db, doctor_id, date_value, token_number, status="pending"):
    appointment = models.Appointment(
        doctor_id=doctor_id,
        patient_id=None,
        booking_date=date_value,
        token_number=token_number,
        status=status,
    )
    db.add(appointment)
    db.commit()
    return appointment


def test_first_batch_is_one_to_twenty(db_session, doctor, tomorrow):
    window = q.get_queue_window(db_session, doctor.id, tomorrow)

    assert window["active_batch"] == 1
    assert window["window_start"] == 1
    assert window["window_end"] == 20
    assert window["tokens"] == list(range(1, 21))
    assert window["available_count"] == 20


def test_second_batch_opens_only_after_all_twenty_are_terminal(db_session, doctor, tomorrow):
    for token in range(1, 21):
        status = "absent" if token == 20 else "completed"
        _make_appointment(db_session, doctor.id, tomorrow, token, status)

    window = q.get_queue_window(db_session, doctor.id, tomorrow)

    assert window["active_batch"] == 2
    assert window["window_start"] == 21
    assert window["window_end"] == 40
    assert window["available_count"] == 20


def test_single_non_terminal_slot_keeps_current_batch(db_session, doctor, tomorrow):
    for token in range(1, 20):
        status = "pending" if token == 7 else "completed"
        _make_appointment(db_session, doctor.id, tomorrow, token, status)

    window = q.get_queue_window(db_session, doctor.id, tomorrow)

    assert window["active_batch"] == 1
    assert window["window_start"] == 1
    assert window["available_tokens"] == [20]


def test_serving_does_not_complete_the_batch(db_session, doctor, tomorrow):
    for token in range(1, 21):
        status = "serving" if token == 3 else "completed"
        _make_appointment(db_session, doctor.id, tomorrow, token, status)

    window = q.get_queue_window(db_session, doctor.id, tomorrow)

    assert window["active_batch"] == 1


def test_pending_registration_reserves_a_token(db_session, doctor, tomorrow):
    request = models.RegistrationRequest(
        doctor_id=doctor.id,
        name="Walk In",
        phone="03009999999",
        cnic="9999999999999",
        booking_date=tomorrow,
        token_number=4,
        status="pending",
    )
    db_session.add(request)
    db_session.commit()

    window = q.get_queue_window(db_session, doctor.id, tomorrow)

    assert 4 not in window["available_tokens"]
    assert window["pending_tokens"] == [4]
    assert window["active_available_count"] == 19


def test_allocate_token_returns_requested_free_token(db_session, doctor, tomorrow):
    allocated = q.allocate_token(db_session, doctor.id, tomorrow, requested_token=9)
    assert allocated == 9


def test_allocate_token_rejects_taken_token(db_session, doctor, tomorrow):
    _make_appointment(db_session, doctor.id, tomorrow, 9)

    with pytest.raises(q.QueueError) as excinfo:
        q.allocate_token(db_session, doctor.id, tomorrow, requested_token=9)

    assert "already booked" in str(excinfo.value)


def test_allocate_token_rejects_token_outside_active_batch(db_session, doctor, tomorrow):
    with pytest.raises(q.QueueError) as excinfo:
        q.allocate_token(db_session, doctor.id, tomorrow, requested_token=25)

    assert "outside the active batch" in str(excinfo.value)


def test_allocate_token_fills_next_free_slot(db_session, doctor, tomorrow):
    _make_appointment(db_session, doctor.id, tomorrow, 1)
    _make_appointment(db_session, doctor.id, tomorrow, 2)

    assert q.allocate_token(db_session, doctor.id, tomorrow) == 3


def test_full_batch_raises_conflict(db_session, doctor, tomorrow):
    for token in range(1, 21):
        _make_appointment(db_session, doctor.id, tomorrow, token)

    with pytest.raises(q.QueueError) as excinfo:
        q.allocate_token(db_session, doctor.id, tomorrow)

    assert excinfo.value.status_code == 409


def test_normalize_rejects_past_date_and_bad_format(db_session):
    past = (q.datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    with pytest.raises(q.QueueError):
        q.normalize_date(past)
    with pytest.raises(q.QueueError):
        q.normalize_date("31-12-2025")


def test_normalize_token_rejects_non_positive_and_non_integer():
    assert q.normalize_token("7") == 7
    with pytest.raises(q.QueueError):
        q.normalize_token(0)
    with pytest.raises(q.QueueError):
        q.normalize_token("abc")
    with pytest.raises(q.QueueError):
        q.normalize_token(True)


def test_doctor_custom_reduced_capacity(db_session, tomorrow):
    doc = models.User(
        name="Dr Capacity Test",
        phone="03009876543",
        cnic="1234598765432",
        hashed_password="hashed_pw",
        role="doctor",
        consultation_fee=1500,
        max_tokens=5,
        token_mode="dynamic"
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    window = q.get_queue_window(db_session, doc.id, tomorrow)
    assert window["batch_size"] == 5
    assert window["tokens"] == [1, 2, 3, 4, 5]
    assert window["window_start"] == 1
    assert window["window_end"] == 5
    assert window["available_count"] == 5


def test_fixed_mode_strictly_caps_at_max_tokens(db_session, tomorrow):
    doc = models.User(
        name="Dr Fixed Test",
        phone="03009876544",
        cnic="1234598765433",
        hashed_password="hashed_pw",
        role="doctor",
        consultation_fee=1500,
        max_tokens=5,
        token_mode="fixed"
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    for t in range(1, 6):
        _make_appointment(db_session, doc.id, tomorrow, t, status="completed")

    window = q.get_queue_window(db_session, doc.id, tomorrow)
    assert window["batch_size"] == 5
    assert window["active_batch"] == 1
    assert window["is_full"] is True
    assert window["available_count"] == 0
    assert window["next_batch"] is None

    with pytest.raises(q.QueueError) as excinfo:
        q.allocate_token(db_session, doc.id, tomorrow)
    assert excinfo.value.status_code == 409

