from contextlib import contextmanager
from datetime import datetime
import threading

from sqlalchemy import text

from ..db import models


BATCH_SIZE = 20
TERMINAL_STATUSES = frozenset(("completed", "absent"))
_QUEUE_LOCKS = {}
_QUEUE_LOCKS_GUARD = threading.Lock()


class QueueError(Exception):
    def __init__(self, detail, status_code=400):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def normalize_date(value, allow_past=False):
    if value is None or not str(value).strip():
        raise QueueError("A valid booking date is required.")
    cleaned = str(value).strip()
    try:
        parsed = datetime.strptime(cleaned, "%Y-%m-%d").date()
    except ValueError:
        raise QueueError("Invalid date format. Expected YYYY-MM-DD.")
    if not allow_past and parsed < datetime.utcnow().date():
        raise QueueError("Cannot book an appointment for a past date.")
    return parsed.isoformat()


def normalize_token(value, required=True):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise QueueError("A token number is required.")
        return None
    if isinstance(value, bool):
        raise QueueError("Token number must be a positive integer.")
    try:
        token = int(value)
    except (TypeError, ValueError):
        raise QueueError("Token number must be a positive integer.")
    if isinstance(value, float) and not value.is_integer():
        raise QueueError("Token number must be a positive integer.")
    if token < 1:
        raise QueueError("Token number must be a positive integer.")
    return token


def is_terminal_status(status):
    return str(status or "").strip().lower() in TERMINAL_STATUSES


def _valid_token(value):
    if isinstance(value, bool) or (isinstance(value, float) and not value.is_integer()):
        return None
    try:
        token = int(value)
    except (TypeError, ValueError):
        return None
    return token if token > 0 else None


def _get_appointments(db, doctor_id, date_value, for_update=False):
    query = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == int(doctor_id),
        models.Appointment.booking_date == date_value
    )
    if for_update:
        query = query.with_for_update()
    return query.order_by(models.Appointment.token_number.asc()).all()


def _batch_is_complete(token_map, start, batch_size=BATCH_SIZE, reserved_tokens=None):
    reserved_tokens = reserved_tokens or set()
    return all(
        token in token_map
        and token not in reserved_tokens
        and all(is_terminal_status(app.status) for app in token_map[token])
        for token in range(start, start + batch_size)
    )


def _get_reserved_tokens(db, doctor_id, date_value, exclude_request_id=None, for_update=False):
    query = db.query(models.RegistrationRequest.token_number).filter(
        models.RegistrationRequest.doctor_id == int(doctor_id),
        models.RegistrationRequest.booking_date == date_value,
        models.RegistrationRequest.status == "pending"
    )
    if exclude_request_id is not None:
        query = query.filter(models.RegistrationRequest.id != exclude_request_id)
    if for_update:
        query = query.with_for_update()
    return {
        token for (token,) in query.all()
        if _valid_token(token) is not None
    }


def get_queue_window(db, doctor_id, date_value, appointments=None, for_update=False, doctor=None):
    date_value = normalize_date(date_value, allow_past=True)
    if appointments is None:
        appointments = _get_appointments(db, doctor_id, date_value, for_update=for_update)

    if doctor is None and doctor_id is not None:
        doctor = db.query(models.User).filter(models.User.id == int(doctor_id)).first()

    batch_size = BATCH_SIZE
    token_mode = "dynamic"

    if doctor is not None:
        if getattr(doctor, "max_tokens", None) and int(doctor.max_tokens) > 0:
            batch_size = int(doctor.max_tokens)
        if getattr(doctor, "token_mode", None):
            token_mode = str(doctor.token_mode).strip().lower()

    token_map = {}
    for appointment in appointments:
        token = _valid_token(appointment.token_number)
        if token is not None:
            token_map.setdefault(token, []).append(appointment)

    reserved_tokens = _get_reserved_tokens(
        db,
        doctor_id,
        date_value,
        for_update=for_update
    )
    batch_number = 1
    if token_mode == "dynamic":
        while True:
            start = (batch_number - 1) * batch_size + 1
            if not _batch_is_complete(token_map, start, batch_size=batch_size, reserved_tokens=reserved_tokens):
                break
            batch_number += 1

    start = (batch_number - 1) * batch_size + 1
    end = start + batch_size - 1
    window_tokens = list(range(start, end + 1))
    booked_tokens = sorted({
        token for token in token_map
        if start <= token <= end
    })
    pending_tokens = sorted(
        token for token in reserved_tokens
        if start <= token <= end
    )
    terminal_tokens = sorted(
        token for token in booked_tokens
        if all(is_terminal_status(app.status) for app in token_map[token])
    )
    occupied_tokens = set(booked_tokens) | set(pending_tokens)
    available_tokens = [token for token in window_tokens if token not in occupied_tokens]
    next_start = end + 1
    next_end = next_start + batch_size - 1
    active_booked_count = len(booked_tokens)
    active_pending_count = len(pending_tokens)
    active_available_count = len(available_tokens)

    if token_mode == "dynamic":
        next_batch_ready = _batch_is_complete(token_map, start, batch_size=batch_size, reserved_tokens=reserved_tokens)
        next_batch = batch_number + 1
        next_batch_state = "active" if next_batch_ready else "locked"
    else:
        next_batch_ready = False
        next_batch = None
        next_batch_state = "disabled"

    is_full = len(occupied_tokens) >= batch_size

    return {
        "doctor_id": int(doctor_id),
        "date": date_value,
        "batch_size": batch_size,
        "token_mode": token_mode,
        "active_batch": batch_number,
        "active_batch_number": batch_number,
        "active_batch_start": start,
        "active_batch_end": end,
        "window_start": start,
        "window_end": end,
        "active_window_start": start,
        "active_window_end": end,
        "tokens": window_tokens,
        "token_window": window_tokens,
        "booked_tokens": booked_tokens,
        "available_tokens": available_tokens,
        "terminal_tokens": terminal_tokens,
        "pending_tokens": pending_tokens,
        "reserved_tokens": pending_tokens,
        "booked_count": active_booked_count,
        "available_count": active_available_count,
        "terminal_count": len(terminal_tokens),
        "active_booked_count": active_booked_count,
        "active_pending_count": active_pending_count,
        "active_available_count": active_available_count,
        "active_batch_state": "in_progress" if active_booked_count or active_pending_count else "open",
        "is_full": is_full,
        "next_batch": next_batch,
        "next_batch_number": next_batch,
        "next_batch_start": next_start if token_mode == "dynamic" else None,
        "next_batch_end": next_end if token_mode == "dynamic" else None,
        "next_batch_ready": next_batch_ready,
        "next_batch_state": next_batch_state,
    }


def appointments_in_window(appointments, queue_window):
    start = queue_window["window_start"]
    end = queue_window["window_end"]
    return [
        appointment for appointment in appointments
        if start <= (_valid_token(appointment.token_number) or 0) <= end
    ]


def allocate_token(
    db,
    doctor_id,
    date_value,
    requested_token=None,
    exclude_appointment_id=None,
    allow_fallback=False,
    appointments=None,
    exclude_request_id=None,
    for_update=False,
    doctor=None
):
    date_value = normalize_date(date_value, allow_past=True)
    if appointments is None:
        appointments = _get_appointments(
            db, doctor_id, date_value, for_update=for_update
        )
    queue_window = get_queue_window(
        db,
        doctor_id,
        date_value,
        appointments=appointments,
        for_update=for_update,
        doctor=doctor
    )
    occupied = {
        _valid_token(appointment.token_number)
        for appointment in appointments
        if appointment.id != exclude_appointment_id
    }
    occupied.discard(None)
    occupied.update(_get_reserved_tokens(
        db,
        doctor_id,
        date_value,
        exclude_request_id=exclude_request_id,
        for_update=for_update
    ))

    if requested_token is not None:
        requested_token = normalize_token(requested_token)
        if requested_token in queue_window["tokens"] and requested_token not in occupied:
            return requested_token
        if not allow_fallback:
            if requested_token not in queue_window["tokens"]:
                raise QueueError(
                    f"Token #{requested_token} is outside the active batch "
                    f"({queue_window['window_start']}-{queue_window['window_end']})."
                )
            raise QueueError("This token number is already booked by another patient.")

    available = [
        token for token in queue_window["tokens"]
        if token not in occupied
    ]
    if not available:
        raise QueueError(
            f"No tokens are available in the active batch "
            f"({queue_window['window_start']}-{queue_window['window_end']}).",
            status_code=409
        )
    return available[0]


@contextmanager
def queue_lock(db, doctor_id, date_value):
    key = f"{int(doctor_id)}:{date_value}"
    with _QUEUE_LOCKS_GUARD:
        lock = _QUEUE_LOCKS.setdefault(key, threading.RLock())
    with lock:
        bind = db.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:queue_key))"),
                {"queue_key": key}
            )
        yield
