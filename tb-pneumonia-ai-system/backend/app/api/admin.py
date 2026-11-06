import json
import os
import re
from typing import NamedTuple, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
try:
    from app.db.database import get_db
    from app.db import models
    from app.api.auth_utils import oauth2_scheme, get_current_user_from_token, get_password_hash
except (ImportError, ModuleNotFoundError):
    from ..db.database import get_db
    from ..db import models
    from .auth_utils import oauth2_scheme, get_current_user_from_token, get_password_hash
from pydantic import BaseModel

router = APIRouter()

def get_current_admin(token: str = Depends(oauth2_scheme)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access Admin Panel")
    return user_info


def _digits(value) -> str:
    """Digits-only form of a CNIC / phone value.

    `/doctor/search-patient` normalises its query and matches it against BOTH the
    `cnic` and `phone` columns, taking the first hit. Uniqueness therefore has to be
    judged on digits-only values across both columns, otherwise a duplicate makes the
    directory lookup return whichever row the database happens to yield first.
    """
    if value is None:
        return ""
    return re.sub(r"[^0-9]", "", str(value))


class _Conflict(NamedTuple):
    name: str
    digits: str


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_DIGIT_RANGE = range(10, 16)  # 10-15 digits, matching the public contact form


def _split_setting_list(raw) -> list:
    """Contact settings are stored as a JSON array; tolerate a bare string too."""
    text = (raw or "").strip() if isinstance(raw, str) else ""
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except ValueError:
        return [text]
    if isinstance(parsed, list):
        return [str(item).strip() for item in parsed if str(item).strip()]
    return [str(parsed).strip()]


def _validate_contact_setting(key: str, raw) -> str:
    """Reject contact values that would render a broken link on the public pages.

    These settings are interpolated straight into `mailto:`, `tel:` and `wa.me/`
    hrefs, so an unvalidated value silently breaks the direct-contact channels
    instead of failing where the mistake was made.
    """
    entries = _split_setting_list(raw)
    if key == "contact_email":
        invalid = [e for e in entries if not _EMAIL_RE.match(e)]
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid email address in contact_email: {invalid[0]!r}",
            )
    elif key in ("contact_phone", "contact_whatsapp"):
        invalid = [e for e in entries if len(_digits(e)) not in _PHONE_DIGIT_RANGE]
        if invalid:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Invalid phone number in {key}: {invalid[0]!r}. "
                    "Use 10-15 digits, e.g. +92 348 1974606."
                ),
            )
    return raw



def _find_identity_conflict(db, exclude_user_id: int, phone, cnic):
    """Return ``_Conflict`` if applying this identity would duplicate another user."""
    wanted = {_digits(phone), _digits(cnic)} - {""}
    if not wanted:
        return None

    # Deliberately no SQL prefilter: it would need to match digits-only, and a LIKE on
    # the raw column silently misses legacy rows such as "+92 348 1974606" - which is
    # precisely the duplicate this must catch. Only the needed columns are loaded.
    rows = db.query(
        models.User.name, models.User.cnic, models.User.phone
    ).filter(models.User.id != exclude_user_id)

    for other_name, other_cnic, other_phone in rows:
        clash = ({_digits(other_cnic), _digits(other_phone)} - {""}) & wanted
        if clash:
            return _Conflict(name=other_name, digits=sorted(clash)[0])
    return None


class ContactSettingsUpdate(BaseModel):
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    contact_address: Optional[str] = None
    contact_desc: Optional[str] = None
    footer_text: Optional[str] = None
    home_hero_title: Optional[str] = None
    home_hero_subtitle: Optional[str] = None
    about_intro_text: Optional[str] = None
    social_facebook: Optional[str] = None
    social_instagram: Optional[str] = None
    social_linkedin: Optional[str] = None

@router.get("/admin/settings/contact")
def get_contact_settings(db: Session = Depends(get_db)):
    settings = db.query(models.SiteSettings).all()
    # Default values in case they haven't been seeded
    result = {
        "contact_email": "support@tbpneumonia-ai.com",
        "contact_phone": "+92 300 000 0000",
        "contact_address": "123 Healthcare Avenue\nMedical City, PK 12345",
        "contact_desc": "We're here to help. Reach out to us if you have any questions or need support regarding our TB & Pneumonia AI System."
    }
    for s in settings:
        result[s.setting_key] = s.setting_value
    return result

@router.put("/admin/settings/contact")
def update_contact_settings(data: ContactSettingsUpdate, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    settings_dict = data.dict(exclude_unset=True)
    # Validate everything before writing anything, so a rejected value cannot
    # leave the settings half-updated.
    validated = {
        key: _validate_contact_setting(key, value)
        for key, value in settings_dict.items()
    }
    for key, value in validated.items():
        setting = db.query(models.SiteSettings).filter(models.SiteSettings.setting_key == key).first()
        if setting:
            setting.setting_value = value
        else:
            new_setting = models.SiteSettings(setting_key=key, setting_value=value)
            db.add(new_setting)
    db.commit()
    return {"message": "Settings updated successfully"}

@router.get("/admin/messages")
def get_contact_messages(admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    messages = db.query(models.ContactMessage).order_by(models.ContactMessage.created_at.desc()).all()
    return messages

@router.put("/admin/messages/{msg_id}/read")
def mark_message_read(msg_id: int, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = 1
    db.commit()
    return {"message": "Message marked as read"}

@router.delete("/admin/messages/{msg_id}")
def delete_contact_message(msg_id: int, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"message": "Message deleted successfully"}

@router.get("/admin/stats")
def get_admin_stats(admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_doctors = db.query(models.User).filter(models.User.role == "doctor").count()
    total_patients = db.query(models.User).filter(models.User.role == "patient").count()
    total_admins = db.query(models.User).filter(models.User.role == "admin").count()
    total_predictions = db.query(models.Prediction).count()
    total_appointments = db.query(models.Appointment).count()

    return {
        "total_users": total_users,
        "total_doctors": total_doctors,
        "total_patients": total_patients,
        "total_admins": total_admins,
        "total_predictions": total_predictions,
        "total_appointments": total_appointments
    }

@router.get("/admin/users")
def get_all_users(admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    # Returns a list of all users, sorted with newest first
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    
    # We do not return hashed_password to the frontend
    users_data = []
    for u in users:
        users_data.append({
            "id": u.id,
            "name": u.name,
            "phone": u.phone,
            "whatsapp": u.whatsapp,
            "cnic": u.cnic,
            "role": u.role,
            "profile_pic": u.profile_pic,
            "specialization": u.specialization,
            "clinic_name": u.clinic_name,
            "created_at": u.created_at
        })
    return users_data

@router.post("/admin/create-admin")
def create_new_admin(payload: dict, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    phone = _digits(payload.get("phone"))
    cnic = _digits(payload.get("cnic"))
    password = payload.get("password") or ""
    whatsapp = _digits(payload.get("whatsapp")) if payload.get("whatsapp") else None

    if not name:
        raise HTTPException(status_code=400, detail="Administrator name is required.")
    if len(phone) < 10 or len(phone) > 15:
        raise HTTPException(status_code=400, detail="A valid mobile number (10-15 digits) is required.")
    if len(cnic) != 13:
        raise HTTPException(status_code=400, detail="National ID / CNIC must be exactly 13 digits.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    conflict = _find_identity_conflict(db, None, phone, cnic)
    if conflict:
        field = "Phone number" if conflict.digits == phone else "CNIC / B-Form"
        raise HTTPException(
            status_code=409,
            detail=f"{field} '{conflict.digits}' is already registered to '{conflict.name}'."
        )

    new_admin = models.User(
        name=name,
        phone=phone,
        whatsapp=whatsapp,
        cnic=cnic,
        hashed_password=get_password_hash(password),
        role="admin"
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return {
        "message": f"Administrator '{new_admin.name}' created successfully.",
        "admin": {
            "id": new_admin.id,
            "name": new_admin.name,
            "phone": new_admin.phone,
            "whatsapp": new_admin.whatsapp,
            "cnic": new_admin.cnic,
            "role": new_admin.role,
            "created_at": new_admin.created_at
        }
    }

@router.post("/admin/users/{user_id}/role")
def update_user_role(user_id: int, payload: dict, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    # Prevent the admin from removing their own admin role
    if user_id == admin_info["id"] and payload.get("role") != "admin":
        raise HTTPException(status_code=400, detail="Cannot revoke your own admin access.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_role = payload.get("role")
    if new_role not in ["patient", "doctor", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    user.role = new_role
    db.commit()
    return {"message": f"User {user.name} role updated to {new_role}"}

@router.put("/admin/users/{user_id}/details")
def update_user_details(user_id: int, payload: dict, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "name" in payload:
        user.name = payload["name"]

    if "whatsapp" in payload:
        wa = payload.get("whatsapp")
        user.whatsapp = _digits(wa) if wa else None

    if "phone" in payload or "cnic" in payload:
        # Validate the identity this edit would leave behind, not just the fields
        # being changed, so a stale duplicate cannot be introduced via the other field.
        next_phone = payload.get("phone", user.phone)
        next_cnic = payload.get("cnic", user.cnic)

        conflict = _find_identity_conflict(db, user_id, next_phone, next_cnic)
        if conflict:
            field = "Phone number" if conflict.digits == _digits(next_phone) else "CNIC / B-Form"
            raise HTTPException(
                status_code=409,
                detail=(
                    f"{field} '{conflict.digits}' is already registered to "
                    f"'{conflict.name}'. Every patient must have a unique CNIC and phone number."
                ),
            )

        if "phone" in payload:
            user.phone = _digits(next_phone)
        if "cnic" in payload:
            user.cnic = _digits(next_cnic)

    db.commit()
    return {"message": f"User {user.name} details updated successfully."}

@router.delete("/admin/users/{user_id}")
def delete_user(user_id: int, admin_info: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    # Prevent the admin from deleting themselves
    if user_id == admin_info["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete related records
    # 1. Predictions where user is owner or doctor.
    #    Collect the paths first: bulk .delete() issues a single DELETE and never
    #    touches the radiograph files, which would leak them on disk forever.
    prediction_paths = [
        row[0]
        for row in db.query(models.Prediction.image_path)
        .filter(
            (models.Prediction.user_id == user_id)
            | (models.Prediction.doctor_id == user_id)
        )
        .all()
    ]
    db.query(models.Prediction).filter(
        (models.Prediction.user_id == user_id) | (models.Prediction.doctor_id == user_id)
    ).delete()
    
    # 2. Appointments where user is patient or doctor
    db.query(models.Appointment).filter(
        (models.Appointment.patient_id == user_id) | (models.Appointment.doctor_id == user_id)
    ).delete()
    
    # 3. Registration requests
    db.query(models.RegistrationRequest).filter(models.RegistrationRequest.doctor_id == user_id).delete()
    
    # 4. DoctorPatient mappings
    db.query(models.DoctorPatient).filter(
        (models.DoctorPatient.patient_id == user_id) | (models.DoctorPatient.doctor_id == user_id)
    ).delete()

    # 5. Contact messages referencing the doctor
    db.query(models.ContactMessage).filter(models.ContactMessage.doctor_id == user_id).delete()

    # 5b. Contact messages the user sent as a patient, and any reply they wrote.
    # Bulk deletes bypass the ORM's delete-orphan cascade, so the replies that
    # hang off those inquiries have to go first or the FK to users.id blocks
    # db.delete(user) below.
    sent_message_ids = [
        row[0] for row in db.query(models.ContactMessage.id).filter(
            models.ContactMessage.sender_user_id == user_id
        )
    ]
    db.query(models.MessageReply).filter(models.MessageReply.message_id.in_(sent_message_ids)).delete(
        synchronize_session=False
    )
    db.query(models.MessageReply).filter(models.MessageReply.sender_user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(models.ContactMessage).filter(models.ContactMessage.sender_user_id == user_id).delete()

    # 6. Cleanup profile picture file if present
    if user.profile_pic and os.path.exists(user.profile_pic):
        try:
            os.remove(user.profile_pic)
        except Exception:
            pass

    # 7. Cleanup the radiographs and Grad-CAM overlays freed in step 1
    for image_path in prediction_paths:
        _discard_prediction_files(image_path)

    db.delete(user)
    db.commit()
    return {"message": f"User {user.name} and their associated records have been deleted."}


# --- clinical oversight ---------------------------------------------------------
# Admins could see aggregate counts but had no way to inspect or remove an
# individual screening record or appointment, e.g. to retract a mis-uploaded
# radiograph or clear a duplicate token.

def _discard_prediction_files(image_path) -> None:
    """Delete a prediction's radiograph, its Grad-CAM overlay and its DICOM study."""
    if not image_path:
        return
    base_name, _ = os.path.splitext(str(image_path))
    # A DICOM upload is stored as a rendered PNG next to the retained .dcm, so all
    # three share one stem and must be removed together.
    candidates = [str(image_path), f"{base_name}_gradcam.jpg", f"{base_name}.dcm"]
    for candidate in candidates:
        try:
            if os.path.isfile(candidate):
                os.remove(candidate)
        except OSError:
            pass  # Already gone, or locked; the row is what matters.


@router.get("/admin/predictions")
def list_predictions(
    limit: int = 100,
    offset: int = 0,
    admin_info: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    total = db.query(models.Prediction).count()
    rows = (
        db.query(
            models.Prediction.id,
            models.Prediction.result,
            models.Prediction.confidence,
            models.Prediction.created_at,
            models.Prediction.image_path,
            models.User.name.label("patient_name"),
            models.Prediction.user_id,
        )
        .outerjoin(models.User, models.User.id == models.Prediction.user_id)
        .order_by(models.Prediction.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [
            {
                "id": row.id,
                "result": row.result,
                "confidence": row.confidence,
                "created_at": row.created_at,
                "patient_name": row.patient_name,
                "patient_id": row.user_id,
            }
            for row in rows
        ],
    }


@router.delete("/admin/predictions/{prediction_id}")
def delete_prediction(
    prediction_id: int,
    admin_info: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    prediction = (
        db.query(models.Prediction)
        .filter(models.Prediction.id == prediction_id)
        .first()
    )
    if not prediction:
        raise HTTPException(status_code=404, detail="Screening record not found")

    _discard_prediction_files(prediction.image_path)
    db.delete(prediction)
    db.commit()
    return {"message": f"Screening record {prediction_id} deleted."}


@router.get("/admin/appointments")
def list_appointments(
    limit: int = 100,
    offset: int = 0,
    admin_info: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    total = db.query(models.Appointment).count()
    rows = (
        db.query(
            models.Appointment.id,
            models.Appointment.booking_date,
            models.Appointment.token_number,
            models.Appointment.status,
            models.Appointment.fee_charged,
            models.Appointment.patient_name_override,
            models.Appointment.created_at,
            models.Appointment.patient_id,
            models.Appointment.doctor_id,
            models.User.name.label("patient_name"),
        )
        .outerjoin(models.User, models.User.id == models.Appointment.patient_id)
        .order_by(models.Appointment.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [
            {
                "id": row.id,
                "booking_date": row.booking_date,
                "token_number": row.token_number,
                "status": row.status,
                "fee_charged": row.fee_charged,
                "patient_name": row.patient_name_override or row.patient_name,
                "patient_id": row.patient_id,
                "doctor_id": row.doctor_id,
                "created_at": row.created_at,
            }
            for row in rows
        ],
    }


@router.delete("/admin/appointments/{appointment_id}")
def delete_appointment(
    appointment_id: int,
    admin_info: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    appointment = (
        db.query(models.Appointment)
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    db.delete(appointment)
    db.commit()
    return {"message": f"Appointment {appointment_id} deleted."}

