from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from datetime import datetime, timedelta
import os
import shutil
import uuid
import json
import cv2
try:
    from app.db.database import get_db
    from app.db import models
    from app.core.config import settings
    from app.schemas.request import PredictionRequest
    from app.services.predict import predict_image, is_model_connected, get_model_status_info
    from app.services.image_validator import validate_chest_xray
    from app.services.dicom import (
        DICOM_EXTENSIONS,
        DicomError,
        dicom_to_png,
        is_dicom_extension,
        looks_like_dicom_bytes
    )
    from app.services.queue import (
        QueueError,
        allocate_token,
        appointments_in_window,
        get_queue_window,
        normalize_date,
        normalize_token,
        queue_lock
    )
    from app.api.websockets import manager
    from app.api.auth_utils import (
        oauth2_scheme,
        optional_oauth2_scheme,
        verify_password,
        get_password_hash,
        create_access_token,
        get_current_user_from_token,
        get_optional_user
    )
except (ImportError, ModuleNotFoundError):
    from ..db.database import get_db
    from ..db import models
    from ..core.config import settings
    from ..schemas.request import PredictionRequest
    from ..services.predict import predict_image, is_model_connected, get_model_status_info
    from ..services.image_validator import validate_chest_xray
    from ..services.dicom import (
        DICOM_EXTENSIONS,
        DicomError,
        dicom_to_png,
        is_dicom_extension,
        looks_like_dicom_bytes
    )
    from ..services.queue import (
        QueueError,
        allocate_token,
        appointments_in_window,
        get_queue_window,
        normalize_date,
        normalize_token,
        queue_lock
    )
    from .websockets import manager
    from .auth_utils import (
        oauth2_scheme,
        optional_oauth2_scheme,
        verify_password,
        get_password_hash,
        create_access_token,
        get_current_user_from_token,
        get_optional_user
    )

router = APIRouter()
UPLOAD_DIR = "uploads"
RADIOLOGY_DIR = os.path.join(UPLOAD_DIR, "radiology")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Raster formats the browser and the CAD model already speak.
RASTER_EXTENSIONS = ("jpg", "jpeg", "png")
# Every extension the /predict endpoint will accept for a radiograph upload.
ACCEPTED_CXR_EXTENSIONS = RASTER_EXTENSIONS + DICOM_EXTENSIONS


def _is_safe_media_path(stored_path: str) -> bool:
    if not stored_path:
        return False
    normalized = os.path.normpath(str(stored_path).replace("\\", "/"))
    if os.path.isabs(normalized):
        return False
    upload_root = os.path.abspath(UPLOAD_DIR)
    return os.path.abspath(normalized).startswith(upload_root + os.sep)


def _radiology_asset_path(stored_path):
    if not stored_path:
        return None
    safe_name = os.path.basename(str(stored_path).replace("\\", "/"))
    if not safe_name or not safe_name.lower().endswith((".jpg", ".jpeg", ".png")):
        return None
    return f"api/media/radiology/{safe_name}"


def _mask_queue_patient_name(name) -> str:
    """Reduce a patient name to initials for the unauthenticated queue display.

    A waiting-room queue only needs to show who is ahead, not who they are.
    """
    parts = [p for p in str(name or "").replace(".", " ").split() if p]
    if not parts:
        return "Queue Patient"
    return " ".join(f"{p[0].upper()}." for p in parts)


def _queue_patient_display_name(name, user_info) -> str:
    """Full name for a signed-in caller, initials for an anonymous one.

    The queue board is read from a route that any waiting-room display can call
    without a session, so an anonymous response must stay initials-only. Once
    the caller proves who they are the full name is safe to show, which is what
    the booking page renders.
    """
    if user_info:
        full_name = str(name or "").strip()
        return full_name or "Queue Patient"
    return _mask_queue_patient_name(name)


def _get_gradcam_asset_path(image_path):
    if not image_path:
        return None
    safe_name = os.path.basename(str(image_path).replace("\\", "/"))
    base_name, _ = os.path.splitext(safe_name)
    gradcam_name = f"{base_name}_gradcam.jpg"
    gradcam_disk = os.path.join(RADIOLOGY_DIR, gradcam_name)
    if os.path.isfile(gradcam_disk):
        return f"api/media/radiology/{gradcam_name}"
    return None


def _can_access_prediction(user_info: dict, prediction) -> bool:
    if not prediction:
        return False
    role = user_info.get("role")
    user_id = int(user_info.get("id") or 0)
    if role == "admin":
        return True
    # An unattributed prediction is a study received from the X-ray machine and
    # awaiting review. Any clinician may view it, otherwise the pending inbox
    # could not display the radiograph a doctor is being asked to review.
    if prediction.user_id is None and prediction.doctor_id is None:
        return role in ("doctor", "admin")
    if role == "doctor":
        return int(prediction.doctor_id or 0) == user_id or int(prediction.user_id or 0) == user_id
    return int(prediction.user_id or 0) == user_id


from typing import Optional
from pydantic import BaseModel

class ContactMessageCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    whatsapp: Optional[str] = None
    subject: str = ""
    message: str
    doctor_id: Optional[int] = None

class MessageReplyCreate(BaseModel):
    body: str

class InquiryEdit(BaseModel):
    subject: Optional[str] = None
    message: Optional[str] = None

# A patient can still fix a typo straight after sending, but not once the thread
# has moved on. Server-enforced so the window can't be bypassed from the client.
INQUIRY_EDIT_WINDOW = timedelta(minutes=1)

def serialize_contact_message(msg):
    """Shape a ContactMessage for the API.

    `is_from_account` is what the doctor UI keys off: a signed-in sender can be
    replied to in-app, a guest can only be reached over WhatsApp.
    """
    return {
        "id": msg.id,
        "name": msg.name,
        "email": msg.email,
        "whatsapp": msg.whatsapp,
        "subject": msg.subject,
        "message": msg.message,
        "is_read": msg.is_read,
        "doctor_id": msg.doctor_id,
        # Lets the patient see which doctor they addressed. Null for a general
        # enquiry that wasn't aimed at a specific doctor.
        "doctor_name": msg.doctor.name if msg.doctor else None,
        "doctor_specialization": msg.doctor.specialization if msg.doctor else None,
        "sender_user_id": msg.sender_user_id,
        "is_from_account": msg.sender_user_id is not None,
        "created_at": msg.created_at,
        "replies": [
            {
                "id": r.id,
                "sender_user_id": r.sender_user_id,
                "sender_name": r.sender.name if r.sender else None,
                "sender_role": r.sender.role if r.sender else None,
                "body": r.body,
                "created_at": r.created_at,
            }
            for r in msg.replies
        ],
    }

@router.post("/contact/submit")
def submit_contact_message(
    data: ContactMessageCreate,
    db: Session = Depends(get_db),
    caller: Optional[dict] = Depends(get_optional_user)
):
    msg = models.ContactMessage(
        name=data.name,
        email=data.email or "",
        whatsapp=data.whatsapp,
        subject=data.subject,
        message=data.message,
        doctor_id=data.doctor_id,
        # Recorded only for a signed-in patient; guests stay NULL.
        sender_user_id=caller["id"] if caller and caller.get("role") == "patient" else None
    )
    db.add(msg)
    db.commit()
    return {"message": "Message submitted successfully", "is_from_account": msg.sender_user_id is not None}

@router.get("/doctor/messages")
def get_doctor_messages(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor' and user_info['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    doctor_id = user_info['id']
    messages = db.query(models.ContactMessage).filter(models.ContactMessage.doctor_id == doctor_id).order_by(models.ContactMessage.created_at.desc()).all()
    return [serialize_contact_message(m) for m in messages]

@router.post("/doctor/messages/{msg_id}/reply")
def reply_to_doctor_message(
    msg_id: int,
    data: MessageReplyCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor' and user_info['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    body = (data.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id, models.ContactMessage.doctor_id == user_info['id']).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    # Guests have no account to read an in-app thread, so don't pretend otherwise.
    if msg.sender_user_id is None:
        raise HTTPException(status_code=400, detail="This inquiry came from a guest and can only be answered over WhatsApp")
    reply = models.MessageReply(
        message_id=msg.id,
        sender_user_id=user_info['id'],
        body=body
    )
    db.add(reply)
    # Replying implies the doctor has seen it.
    msg.is_read = 1
    db.commit()
    db.refresh(reply)
    return {
        "id": reply.id,
        "sender_user_id": reply.sender_user_id,
        "sender_name": user_info['email'],
        "body": reply.body,
        "created_at": reply.created_at,
    }

@router.get("/patient/inquiries")
def get_patient_inquiries(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Inquiries this patient account sent, newest first, with any doctor replies."""
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'patient':
        raise HTTPException(status_code=403, detail="Not authorized")
    messages = (
        db.query(models.ContactMessage)
        .filter(models.ContactMessage.sender_user_id == user_info['id'])
        .order_by(models.ContactMessage.created_at.desc())
        .all()
    )
    return [serialize_contact_message(m) for m in messages]


def _own_inquiry(db, msg_id, user_info):
    """Fetch an inquiry the caller sent, or 404.

    Scoped to sender_user_id so one patient can never touch another's message.
    """
    msg = db.query(models.ContactMessage).filter(
        models.ContactMessage.id == msg_id,
        models.ContactMessage.sender_user_id == user_info['id']
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return msg


def _edit_window_left(msg):
    return INQUIRY_EDIT_WINDOW - (datetime.utcnow() - msg.created_at)


@router.put("/patient/inquiries/{msg_id}")
def edit_patient_inquiry(
    msg_id: int,
    data: InquiryEdit,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'patient':
        raise HTTPException(status_code=403, detail="Not authorized")
    msg = _own_inquiry(db, msg_id, user_info)

    if _edit_window_left(msg) <= timedelta(0):
        raise HTTPException(
            status_code=400,
            detail="The 1 minute editing window has closed, so this inquiry can no longer be edited"
        )
    if msg.replies:
        raise HTTPException(
            status_code=400,
            detail="Your doctor has already replied, so this inquiry can no longer be edited"
        )

    if data.subject is not None:
        msg.subject = data.subject.strip()
    if data.message is not None:
        cleaned = data.message.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        msg.message = cleaned

    # A corrected question is unread again, so the doctor re-reads it.
    msg.is_read = 0
    db.commit()
    db.refresh(msg)
    return serialize_contact_message(msg)


@router.delete("/patient/inquiries/{msg_id}")
def delete_patient_inquiry(
    msg_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'patient':
        raise HTTPException(status_code=403, detail="Not authorized")
    msg = _own_inquiry(db, msg_id, user_info)
    # delete-orphan cascade clears the replies along with it.
    db.delete(msg)
    db.commit()
    return {"message": "Inquiry deleted successfully"}

@router.put("/doctor/messages/{msg_id}/read")
def mark_doctor_message_read(msg_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor' and user_info['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id, models.ContactMessage.doctor_id == user_info['id']).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = 1
    db.commit()
    return {"message": "Message marked as read"}

@router.delete("/doctor/messages/{msg_id}")
def delete_doctor_message(msg_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor' and user_info['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id, models.ContactMessage.doctor_id == user_info['id']).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"message": "Message deleted successfully"}

@router.delete("/doctor/delete-prediction/{prediction_id}")
def delete_prediction(prediction_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] not in ['doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    prediction = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Record not found")

    if not _can_access_prediction(user_info, prediction):
        raise HTTPException(status_code=403, detail="Not authorized to delete this record.")
    
    # Delete image file from disk
    if prediction.image_path:
        try:
            if os.path.exists(prediction.image_path):
                os.remove(prediction.image_path)
        except OSError:
            pass # Ignore if file already gone

        # Remove the paired Grad-CAM overlay and the retained DICOM study,
        # otherwise every delete leaks a file onto the radiology volume.
        base_name, _ = os.path.splitext(prediction.image_path)
        for sibling in (f"{base_name}_gradcam.jpg", f"{base_name}.dcm"):
            try:
                if _is_safe_media_path(sibling) and os.path.isfile(sibling):
                    os.remove(sibling)
            except OSError:
                pass
            
    db.delete(prediction)
    db.commit()
    return {"message": "Record deleted successfully"}

@router.post("/doctor/link-prediction-to-patient")
def link_prediction_to_patient(data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    prediction_id = data.get('prediction_id')
    patient_identifier = data.get('patient_identifier')
    
    if not prediction_id or not patient_identifier:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    prediction = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Screening record not found")

    if int(prediction.doctor_id or 0) != int(user_info["id"]):
        raise HTTPException(status_code=403, detail="Not authorized to modify this screening record.")
        
    # Normalize identifier
    import re
    norm_id = re.sub(r'[^0-9]', '', str(patient_identifier))
    
    patient = db.query(models.User).filter(
        (models.User.phone == norm_id) | (models.User.cnic == norm_id)
    ).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with identifier {patient_identifier} not found. Please register them first.")
        
    # Link the prediction
    prediction.user_id = patient.id
    db.commit()
    
    return {"message": f"Record successfully linked to {patient.name}"}

# --- DASHBOARD ROUTES ---

@router.get("/media/radiology/{filename}")
def get_radiology_image(
    filename: str,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from fastapi.responses import FileResponse

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_info = get_current_user_from_token(token)
    safe_name = os.path.basename(filename)
    if not safe_name or safe_name != filename or not safe_name.lower().endswith((".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Invalid media filename.")

    requested_stem = os.path.splitext(safe_name)[0]
    is_gradcam_request = requested_stem.lower().endswith("_gradcam")
    owner_stem = requested_stem[: -len("_gradcam")] if is_gradcam_request else requested_stem

    prediction = db.query(models.Prediction).filter(
        models.Prediction.image_path.like(f"%{owner_stem}.%")
    ).order_by(models.Prediction.id.desc()).first()

    if not prediction or not _can_access_prediction(user_info, prediction):
        raise HTTPException(status_code=404, detail="Image not found.")

    if is_gradcam_request:
        stored_path = os.path.join(RADIOLOGY_DIR, f"{owner_stem}_gradcam.jpg")
    else:
        stored_path = prediction.image_path

    if not _is_safe_media_path(stored_path) or not os.path.isfile(stored_path):
        raise HTTPException(status_code=404, detail="Image not found.")

    ext = os.path.splitext(stored_path)[1].lower()
    media_type = "image/png" if ext == ".png" else "image/jpeg"
    return FileResponse(stored_path, media_type=media_type)


# --- AUTH ROUTES ---

@router.post("/auth/register")
def register(
    name: str = Form(...),
    phone: str = Form(...),
    cnic: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    access_code: str = Form(None),
    profile_pic: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # Normalize inputs
    import re
    phone = re.sub(r'[^0-9]', '', phone)
    cnic = re.sub(r'[^0-9]', '', cnic)
    name = name.strip()
    
    if len(name) < 2 or len(name) > 50:
        raise HTTPException(status_code=400, detail="Name must be between 2 and 50 characters.")
        
    if len(password) < 8 or len(password) > 64:
        raise HTTPException(status_code=400, detail="Password must be between 8 and 64 characters long.")

    role = (role or "").strip().lower()
    if role != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Public self-registration is restricted to medical specialists. Patients are registered by their attending doctor.",
        )
    if not re.fullmatch(r"[0-9]{10,15}", phone):
        raise HTTPException(status_code=400, detail="Enter a valid phone number.")
    if not re.fullmatch(r"[0-9]{10,15}", cnic):
        raise HTTPException(status_code=400, detail="Enter a valid CNIC / B-Form number.")

    # Check if Phone is registered
    db_user_phone = db.query(models.User).filter(models.User.phone == phone).first()
    if db_user_phone:
        raise HTTPException(status_code=400, detail="This phone number is already registered to an account.")

    # Check if CNIC is registered
    db_user_cnic = db.query(models.User).filter(models.User.cnic == cnic).first()
    if db_user_cnic:
        raise HTTPException(status_code=400, detail="This CNIC / B-Form number is already registered to an account.")
    
    # Verify Doctor Access Code
    if role == 'doctor':
        if not access_code or not access_code.strip():
            raise HTTPException(status_code=400, detail="Doctor Authorization Code is required for medical specialist registration.")
        valid_codes = [code.strip() for code in settings.REGISTRATION_KEYS.split(",") if code.strip()]
        if access_code.strip() not in valid_codes:
            raise HTTPException(status_code=403, detail="Invalid Doctor Access Code.")
            
        # Check if code has already been used by another doctor
        existing_code_user = db.query(models.User).filter(models.User.used_access_code == access_code.strip()).first()
        if existing_code_user:
            raise HTTPException(status_code=400, detail="This access code has already been used by another doctor.")

    # Save Profile Picture
    profile_pic_path = None
    if profile_pic and hasattr(profile_pic, "filename") and profile_pic.filename:
        file_ext = profile_pic.filename.split(".")[-1].lower()
        if file_ext not in ["jpg", "jpeg", "png"]:
            raise HTTPException(status_code=400, detail="Invalid profile picture format. Only JPG, JPEG, and PNG are allowed.")
            
        os.makedirs(os.path.join(UPLOAD_DIR, "profiles"), exist_ok=True)
        file_name = f"{uuid.uuid4()}.{file_ext}"
        profile_pic_path = os.path.join(UPLOAD_DIR, "profiles", file_name).replace("\\", "/")
        with open(profile_pic_path, "wb") as buffer:
            shutil.copyfileobj(profile_pic.file, buffer)

    hashed_pwd = get_password_hash(password)
    new_user = models.User(
        name=name,
        phone=phone,
        cnic=cnic,
        hashed_password=hashed_pwd,
        role=role,
        profile_pic=profile_pic_path,
        used_access_code=access_code.strip() if (role == 'doctor' and access_code) else None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Burn the code for this process only. used_access_code already prevents
    # reuse across restarts, and rewriting .env at runtime is unsafe.
    if role == 'doctor' and access_code:
        valid_codes = [code.strip() for code in settings.REGISTRATION_KEYS.split(",") if code.strip()]
        if access_code.strip() in valid_codes:
            valid_codes.remove(access_code.strip())
            settings.REGISTRATION_KEYS = ",".join(code for code in valid_codes if code)

    return {"message": "User created successfully"}

@router.post("/auth/login")
def login(login_data: dict, db: Session = Depends(get_db)):
    # Support login via phone OR cnic
    import re
    raw_identifier = login_data.get('identifier') or login_data.get('phone') or login_data.get('cnic') or ''
    identifier = re.sub(r'[^0-9]', '', str(raw_identifier))
    password = str(login_data.get('password') or '')

    if not password:
        raise HTTPException(status_code=400, detail="Password is required to sign in.")

    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Enter the 11-digit mobile number (03XXXXXXXXX) or 13-digit CNIC linked to your account.",
        )

    user = db.query(models.User).filter(
        (models.User.phone == identifier) | 
        (models.User.cnic == identifier)
    ).first()

    # Deliberately identical status and wording for an unknown account and a wrong
    # password so this endpoint cannot be used to discover registered phone numbers.
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail=(
                "Sign-in failed. This phone number/CNIC and password combination is not recognised. "
                "Check for typos, or reset your password if you are sure the account exists. "
                "Patient accounts are created by the attending doctor."
            ),
        )

    
    access_token = create_access_token(data={"sub": user.phone, "role": user.role, "id": user.id})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "id": user.id,
        "role": user.role, 
        "name": user.name,
        "profile_pic": user.profile_pic,
        "specialization": user.specialization,
        "clinic_name": user.clinic_name,
        "address": user.address,
        "token_mode": user.token_mode,
        "max_tokens": user.max_tokens,
        "about": user.about,
        "timetable": user.timetable,
        "consultation_fee": user.consultation_fee,
        "phone": user.phone,
        "whatsapp": user.whatsapp
    }

from fastapi import Request

@router.post("/auth/update-profile")
async def update_profile(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        user_info = get_current_user_from_token(token)
        user = db.query(models.User).filter(models.User.id == user_info['id']).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        form_data = await request.form()
        
        name = form_data.get("name")
        phone = form_data.get("phone")
        if phone:
            import re
            phone = re.sub(r'[^0-9]', '', phone)
            
        specialization = form_data.get("specialization")
        clinic_name = form_data.get("clinic_name")
        address = form_data.get("address")
        token_mode = form_data.get("token_mode")
        
        max_tokens_str = form_data.get("max_tokens")
        max_tokens = int(max_tokens_str) if max_tokens_str else None
        
        about = form_data.get("about")
        timetable = form_data.get("timetable")
        
        consultation_fee_str = form_data.get("consultation_fee")
        consultation_fee = int(consultation_fee_str) if consultation_fee_str else None
        
        profile_pic = form_data.get("profile_pic")
        
        gender = form_data.get("gender")
        age_str = form_data.get("age")
        
        if name: user.name = name
        if phone: user.phone = phone
        whatsapp = form_data.get("whatsapp")
        if whatsapp is not None:
            import re
            clean_wa = re.sub(r'[^0-9]', '', whatsapp)
            user.whatsapp = clean_wa if clean_wa else None
        if specialization: user.specialization = specialization
        if clinic_name: user.clinic_name = clinic_name
        if address: user.address = address
        if gender: user.gender = gender
        if age_str:
            try:
                user.age = int(age_str)
            except (ValueError, TypeError):
                pass
        if token_mode: user.token_mode = token_mode
        if max_tokens is not None: user.max_tokens = max_tokens
        if about is not None: user.about = about
        if timetable is not None: user.timetable = timetable
        if consultation_fee is not None: user.consultation_fee = consultation_fee
        
        if profile_pic and hasattr(profile_pic, "filename") and profile_pic.filename:
            profile_dir = os.path.join(UPLOAD_DIR, "profiles")
            os.makedirs(profile_dir, exist_ok=True)
            
            file_ext = profile_pic.filename.split(".")[-1].lower()
            if file_ext not in ["jpg", "jpeg", "png"]:
                raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, JPEG, and PNG are allowed.")
                
            file_name = f"profile_{uuid.uuid4()}.{file_ext}"
            full_path = os.path.join(profile_dir, file_name)
            
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(profile_pic.file, buffer)
            
            user.profile_pic = os.path.join(UPLOAD_DIR, "profiles", file_name).replace("\\", "/")

        db.commit()
        db.refresh(user)
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role,
                "profile_pic": user.profile_pic,
                "specialization": user.specialization,
                "clinic_name": user.clinic_name,
                "address": user.address,
                "gender": user.gender,
                "age": user.age,
                "cnic": user.cnic,
                "token_mode": user.token_mode,
                "max_tokens": user.max_tokens,
                "timetable": user.timetable,
                "consultation_fee": user.consultation_fee,
                "phone": user.phone,
                "whatsapp": user.whatsapp
            }
        }
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="This phone number is already registered to another account.")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Update Profile Error: {str(e)}")


@router.post("/auth/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    import re

    identifier = data.get('identifier')
    phone = data.get('phone')
    cnic = data.get('cnic')
    new_password = data.get('new_password', '')
    current_password = data.get('current_password', '')

    if len(new_password) < 8 or len(new_password) > 64:
        raise HTTPException(status_code=400, detail="New password must be between 8 and 64 characters long.")

    if not current_password:
        raise HTTPException(
            status_code=400,
            detail="Current password is required. Use 'Change Password' while signed in instead.",
        )

    if identifier:
        norm_id = re.sub(r'[^0-9]', '', identifier)
        user = db.query(models.User).filter(
            (models.User.phone == norm_id) |
            (models.User.cnic == norm_id)
        ).first()
    else:
        user = db.query(models.User).filter(
            models.User.phone == phone,
            models.User.cnic == cnic
        ).first()

    if not user or not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identity verification failed. Check your Phone/CNIC and current password.")

    hashed_pwd = get_password_hash(new_password)
    user.hashed_password = hashed_pwd
    db.commit()
    return {"message": "Password updated successfully"}

# --- PREDICTION ROUTES ---

def _discard_screening_files(*paths) -> None:
    """Best-effort removal of a radiograph and every artefact derived from it."""
    for path in paths:
        if not path:
            continue
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass


def _screening_derived_paths(image_path):
    """Sibling artefacts written next to a screening radiograph.

    A DICOM upload keeps its original study next to the rendered PNG, and every
    screening also gets a Grad-CAM overlay. All three share one stem, so they
    are always created and removed as a set.
    """
    base_name, _ = os.path.splitext(str(image_path))
    return [f"{base_name}_gradcam.jpg", f"{base_name}.dcm"]


def _store_cxr_upload(file_bytes: bytes, file_ext: str):
    """Persist an uploaded radiograph. Returns (image_path, source_path).

    A DICOM study is written twice on purpose: the raw `.dcm` is retained for
    the clinical record, while a display-rendered `.png` sibling is what the
    chest X-ray validator, the DenseNet inference call, the Grad-CAM overlay
    and the media route all consume. Keeping one shared stem means those
    consumers stay byte-for-byte identical to the PNG upload path.

    `image_path` is the canonical stored path; `source_path` is the original
    uploaded file (identical to `image_path` for raster formats).
    """
    os.makedirs(RADIOLOGY_DIR, exist_ok=True)
    stem = uuid.uuid4().hex

    if is_dicom_extension(file_ext):
        source_path = os.path.join(RADIOLOGY_DIR, f"{stem}.dcm")
        with open(source_path, "wb") as handle:
            handle.write(file_bytes)
        try:
            image_path = dicom_to_png(
                source_path, os.path.join(RADIOLOGY_DIR, f"{stem}.png")
            )
        except Exception as exc:
            _discard_screening_files(source_path)
            if isinstance(exc, DicomError):
                raise HTTPException(status_code=400, detail=f"Invalid DICOM file. {exc}")
            raise HTTPException(
                status_code=400,
                detail=f"The DICOM study could not be converted into an image. {exc}"
            )
        return image_path, source_path

    image_path = os.path.join(RADIOLOGY_DIR, f"{stem}.{file_ext}")
    with open(image_path, "wb") as handle:
        handle.write(file_bytes)
    return image_path, image_path


@router.post("/predict")
async def predict(
    file: UploadFile = File(...), 
    patient_identifier: str = Form(None), # Explicitly handle as Form data
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)

    # Read the upload before writing anything, so empty/oversized payloads and
    # unsupported types never leave a file behind.
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. Maximum allowed size is 10 MB."
        )

    uploaded_name = file.filename or ""
    file_ext = uploaded_name.rsplit(".", 1)[-1].lower() if "." in uploaded_name else ""

    # PACS exports frequently drop or mangle the extension, so confirm the
    # content before rejecting what is really a DICOM study.
    if not is_dicom_extension(file_ext) and looks_like_dicom_bytes(file_bytes):
        file_ext = "dcm"

    if file_ext not in ACCEPTED_CXR_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPG, JPEG, PNG, and DICOM (.dcm) are allowed."
        )

    file_path, source_path = _store_cxr_upload(file_bytes, file_ext)

    # Strict Medical Chest X-Ray Validation (Rejects face photos, selfies, portraits, and non-radiographs)
    is_valid_xray, validation_error = validate_chest_xray(file_path)
    if not is_valid_xray:
        _discard_screening_files(file_path, source_path, *_screening_derived_paths(file_path))
        raise HTTPException(
            status_code=400,
            detail=validation_error
        )

    # Restriction: Check AI Diagnostic Model connection
    if not is_model_connected():
        _discard_screening_files(file_path, source_path, *_screening_derived_paths(file_path))
        raise HTTPException(
            status_code=503,
            detail="Diagnostic CAD model is not connected or offline. Random predictions are restricted and cannot be performed."
        )

    # Run AI Model with Explainable AI (Grad-CAM)
    try:
        result, confidence, all_scores, heatmap_path = predict_image(file_path)
    except Exception as e:
        _discard_screening_files(file_path, source_path, *_screening_derived_paths(file_path))
        raise HTTPException(
            status_code=500,
            detail=f"Clinical radiograph analysis failed: {str(e)}"
        )
    
    # Determine who this prediction belongs to
    target_user_id = int(user_info['id']) if user_info['role'] == 'patient' else None
    target_doctor_id = int(user_info['id']) if user_info['role'] == 'doctor' else None

    # If a doctor is uploading for a specific patient
    if user_info['role'] == 'doctor' and patient_identifier:
        # Normalize identifier (remove dashes/spaces)
        import re
        norm_id = re.sub(r'[^0-9]', '', patient_identifier)
        
        patient = db.query(models.User).filter(
            (models.User.phone == norm_id) | 
            (models.User.cnic == norm_id)
        ).first()
        if patient:
            target_user_id = patient.id
            print(f"DEBUG: Linked screening to patient: {patient.name} (ID: {patient.id})")
        else:
            print(f"DEBUG: Could not find patient with identifier: {norm_id}")

    # Save prediction to database
    new_prediction = models.Prediction(
        user_id=target_user_id,
        doctor_id=target_doctor_id,
        image_path=file_path,
        result=result,
        confidence=confidence,
        all_scores=json.dumps(all_scores)
    )
    db.add(new_prediction)
    
    # Auto-complete appointment and count fee when checkup is done
    if target_user_id and target_doctor_id:
        from datetime import datetime
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        active_app = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == target_doctor_id,
            models.Appointment.patient_id == target_user_id,
            models.Appointment.booking_date == today_str,
            models.Appointment.status.in_(["serving", "pending", "arrived"])
        ).first()
        
        if active_app:
            doctor = db.query(models.User).filter(models.User.id == target_doctor_id).first()
            active_app.status = "completed"
            active_app.fee_charged = doctor.consultation_fee or 0

    db.commit()
    
    # Fetch patient name for the response
    patient_name = "Guest/Self"
    if target_user_id:
        patient = db.query(models.User).filter(models.User.id == target_user_id).first()
        if patient:
            patient_name = patient.name

    return {
        "id": new_prediction.id,
        "result": result, 
        "confidence": confidence, 
        "all_scores": all_scores,
        "patient_id": target_user_id,
        "patient_name": patient_name,
        "image_path": file_path,
        # Provenance of the upload. A DICOM study is rendered to PNG before
        # inference, so the source format is reported separately from image_path.
        "source_format": "DICOM" if is_dicom_extension(file_ext) else file_ext.upper(),
        "image_url": _radiology_asset_path(file_path),
        "heatmap_url": _radiology_asset_path(heatmap_path) if heatmap_path else None,
        "created_at": new_prediction.created_at.isoformat() if new_prediction.created_at else None
    }

@router.get("/model-status")
def get_ai_model_status():
    """Returns whether the deep learning CAD model is loaded and ready for screening."""
    return get_model_status_info()

# --- PATIENT ROUTES ---

@router.get("/patient/history")
def get_history(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    
    if user_info['role'] == 'admin':
        # Admin can view all clinical screenings across the system
        history = db.query(models.Prediction).order_by(models.Prediction.created_at.desc()).all()
    elif user_info['role'] == 'doctor':
        # Doctors see all screenings they performed
        doc_id = int(user_info['id'])
        history = db.query(models.Prediction).filter(models.Prediction.doctor_id == doc_id).order_by(models.Prediction.created_at.desc()).all()
    else:
        # Patients see only their own screenings
        patient_id = int(user_info['id'])
        history = db.query(models.Prediction).filter(models.Prediction.user_id == patient_id).order_by(models.Prediction.created_at.desc()).all()

        
    result = []
    for h in history:
        # Find patient name and address if they were registered
        patient = None
        if h.user_id:
            patient = db.query(models.User).filter(models.User.id == h.user_id).first()
        
        # Find doctor info
        doctor = None
        if h.doctor_id:
            doctor = db.query(models.User).filter(models.User.id == h.doctor_id).first()
        
        # Safe JSON parsing for all_scores
        parsed_scores = None
        if h.all_scores:
            try:
                parsed_scores = json.loads(h.all_scores)
            except:
                parsed_scores = h.all_scores # Fallback to raw string if it's not JSON
        
        # Check if Grad-CAM saliency map exists for this scan
        heatmap_url = None
        if h.image_path:
            safe_scan_name = os.path.basename(str(h.image_path).replace("\\", "/"))
            base_scan, _ = os.path.splitext(safe_scan_name)
            gradcam_disk = os.path.join(RADIOLOGY_DIR, f"{base_scan}_gradcam.jpg")
            if os.path.isfile(gradcam_disk):
                heatmap_url = f"api/media/radiology/{base_scan}_gradcam.jpg"

        result.append({
            "id": h.id,
            "image_path": h.image_path,
            "image_url": _radiology_asset_path(h.image_path),
            "heatmap_url": heatmap_url,
            "result": h.result,
            "confidence": h.confidence,
            "all_scores": parsed_scores,
            "created_at": h.created_at,
            "patient_name": patient.name if patient else "Guest/Self",
            "patient_address": patient.address if patient else "N/A",
            "patient_gender": patient.gender if patient else "N/A",
            "patient_age": patient.age if patient else "N/A",
            "patient_cnic": patient.cnic if patient else "N/A",
            "patient_phone": patient.phone if patient else "N/A",
            "patient_profile_pic": patient.profile_pic if patient else None,
            "doctor_id": doctor.id if doctor else None,
            "doctor_name": doctor.name if doctor else None,
            "doctor_specialization": doctor.specialization if doctor else None,
            "doctor_clinic_name": doctor.clinic_name if doctor else None,
            "doctor_profile_pic": doctor.profile_pic if doctor else None,
        })
    return result

# --- DOCTOR MANAGEMENT ROUTES ---

@router.get("/doctor/search-patient")
def search_patient(identifier: str, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Normalize search term (remove dashes/spaces)
    import re
    search_term = re.sub(r'[^0-9]', '', identifier)
    
    # Search for user by normalized CNIC or Phone
    patient = db.query(models.User).filter(
        (models.User.cnic == search_term) | (models.User.phone == search_term)
    ).first()
    
    if not patient:
        return {"exists": False}
    
    # Check if already linked
    is_linked = db.query(models.DoctorPatient).filter(
        models.DoctorPatient.doctor_id == user_info['id'],
        models.DoctorPatient.patient_id == patient.id
    ).first() is not None
    
    return {
        "exists": True,
        "is_linked": is_linked,
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "cnic": patient.cnic,
            "phone": patient.phone,
            "gender": patient.gender,
            "age": patient.age
        }
    }

@router.post("/doctor/register-patient")
async def register_patient_by_doctor(
    name: str = Form(...),
    phone: str = Form(...),
    cnic: str = Form(...),
    address: str = Form(None),
    gender: str = Form(None),
    age: int = Form(None),
    password: str = Form(None),
    profile_pic: UploadFile = File(None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Normalize inputs
    import re
    phone_norm = re.sub(r'[^0-9]', '', phone or '')
    cnic_norm = re.sub(r'[^0-9]', '', cnic or '')
    clean_name = (name or '').strip()

    if len(clean_name) < 3:
        raise HTTPException(
            status_code=400,
            detail="Patient full name must be at least 3 characters long."
        )

    if len(cnic_norm) != 13:
        raise HTTPException(
            status_code=400,
            detail="CNIC must be exactly 13 digits (e.g. 1234567890123)."
        )

    if not (len(phone_norm) == 11 and phone_norm.startswith('03')):
        raise HTTPException(
            status_code=400,
            detail="Phone number must be an 11-digit number starting with '03' (e.g. 03XXXXXXXXX)."
        )

    if not gender:
        raise HTTPException(
            status_code=400,
            detail="Please select a gender for the patient."
        )

    if age is None or age < 1 or age > 120:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid patient age between 1 and 120 years."
        )

    if password and len(password.strip()) < 6:
        raise HTTPException(
            status_code=400,
            detail="Patient portal password must be at least 6 characters long."
        )

    # Check if CNIC / B-Form is already registered
    existing_cnic = db.query(models.User).filter(models.User.cnic == cnic_norm).first()
    if existing_cnic:
        raise HTTPException(
            status_code=400, 
            detail="A patient with this CNIC / B-Form is already registered in the system. Use the 'Link Existing' option instead."
        )
        
    # Check if Phone number is already registered
    existing_phone = db.query(models.User).filter(models.User.phone == phone_norm).first()
    if existing_phone:
        raise HTTPException(
            status_code=400, 
            detail=f"The phone number '{phone}' is already registered to '{existing_phone.name}'. Please enter a unique phone number for this patient."
        )
    
    # Save profile pic if provided
    profile_pic_path = None
    if profile_pic:
        profile_dir = os.path.join(UPLOAD_DIR, "profiles")
        if not os.path.exists(profile_dir):
            os.makedirs(profile_dir)
        
        file_ext = profile_pic.filename.split(".")[-1]
        file_name = f"profile_{uuid.uuid4()}.{file_ext}"
        profile_pic_path = os.path.join(profile_dir, file_name)
        
        with open(profile_pic_path, "wb") as buffer:
            shutil.copyfileobj(profile_pic.file, buffer)

    # Create new patient
    try:
        new_patient = models.User(
            name=clean_name,
            cnic=cnic_norm,
            phone=phone_norm,
            address=address,
            gender=gender,
            age=age,
            hashed_password=get_password_hash(password if password else cnic),
            role='patient',
            profile_pic=profile_pic_path
        )
        db.add(new_patient)
        db.flush() # Get ID before commit
        
        # Link to this doctor
        link = models.DoctorPatient(doctor_id=user_info['id'], patient_id=new_patient.id)
        db.add(link)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Registration Error: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail="Registration failed. This CNIC or Phone Number may already be registered in the system."
        )
    
    return {
        "message": "Patient registered and linked successfully",
        "patient": {
            "id": new_patient.id,
            "name": new_patient.name,
            "cnic": new_patient.cnic,
            "phone": new_patient.phone,
            "gender": new_patient.gender,
            "profile_pic": new_patient.profile_pic
        }
    }

@router.post("/doctor/link-patient")
def link_patient(data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    patient_id = data['patient_id']
    
    # Check if link exists
    existing_link = db.query(models.DoctorPatient).filter(
        models.DoctorPatient.doctor_id == user_info['id'],
        models.DoctorPatient.patient_id == patient_id
    ).first()
    
    if existing_link:
        return {"message": "Already linked"}
    
    new_link = models.DoctorPatient(doctor_id=user_info['id'], patient_id=patient_id)
    db.add(new_link)
    db.commit()
    
    return {"message": "Patient linked to your profile successfully"}

@router.delete("/doctor/unlink-patient/{patient_id}")
def unlink_patient(patient_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    link = db.query(models.DoctorPatient).filter(
        models.DoctorPatient.doctor_id == user_info['id'],
        models.DoctorPatient.patient_id == patient_id
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Patient link not found")
        
    db.delete(link)
    db.commit()
    return {"message": "Patient removed from your registry"}

@router.put("/doctor/update-patient/{patient_id}")
async def update_patient_by_doctor(
    patient_id: int,
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify doctor-patient link exists
    link = db.query(models.DoctorPatient).filter(
        models.DoctorPatient.doctor_id == user_info['id'],
        models.DoctorPatient.patient_id == patient_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Patient not linked to this doctor")

    patient = db.query(models.User).filter(models.User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    form_data = await request.form()

    name = form_data.get("name")
    phone = form_data.get("phone")
    gender = form_data.get("gender")
    age_str = form_data.get("age")
    address = form_data.get("address")
    profile_pic = form_data.get("profile_pic")

    import re
    if name: patient.name = name
    if phone:
        phone_norm = re.sub(r'[^0-9]', '', phone)
        patient.phone = phone_norm
    if gender: patient.gender = gender
    if age_str:
        try: patient.age = int(age_str)
        except: pass
    if address is not None: patient.address = address

    if profile_pic and hasattr(profile_pic, "filename") and profile_pic.filename:
        profile_dir = os.path.join(UPLOAD_DIR, "profiles")
        os.makedirs(profile_dir, exist_ok=True)
        file_ext = profile_pic.filename.split(".")[-1]
        file_name = f"profile_{uuid.uuid4()}.{file_ext}"
        full_path = os.path.join(profile_dir, file_name)
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(profile_pic.file, buffer)
        patient.profile_pic = os.path.join(UPLOAD_DIR, "profiles", file_name).replace("\\", "/")

    try:
        db.commit()
        db.refresh(patient)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Phone number already registered to another patient.")

    return {
        "message": "Patient updated successfully",
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "cnic": patient.cnic,
            "phone": patient.phone,
            "gender": patient.gender,
            "age": patient.age,
            "address": patient.address,
            "profile_pic": patient.profile_pic,
            "created_at": patient.created_at
        }
    }

@router.get("/doctor/dashboard")
def doctor_dashboard(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    # Doctor-only, matching every action this screen offers (search-patient,
    # register-patient, link/unlink/update-patient, payments are all doctor-gated).
    # Previously admins were admitted here and then received 403 on each of those,
    # which surfaced as a dashboard full of dead controls. Admins use /admin/*.
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Base query
    pred_query = db.query(models.Prediction)
    patient_query = db.query(models.User).join(models.DoctorPatient, models.User.id == models.DoctorPatient.patient_id)
    
    # If doctor, filter by their ID. If admin, show everything.
    if user_info['role'] == 'doctor':
        doc_id = int(user_info['id'])
        # Try finding by ID first, but be flexible if there's an identity mismatch
        pred_query = pred_query.filter(models.Prediction.doctor_id == doc_id)
        
        # LOGGING FOR DEBUGGING
        print(f"--- DASHBOARD DEBUG ---")
        print(f"User ID from Token: {doc_id}")
        print(f"User Role: {user_info['role']}")
        
        patient_query = patient_query.filter(models.DoctorPatient.doctor_id == doc_id)
    
    all_predictions = pred_query.all()
    print(f"Records found in DB: {len(all_predictions)}")
    
    # If no records found for this specific ID, check if there are records for this doctor's name (Fallback)
    if user_info['role'] == 'doctor' and len(all_predictions) == 0:
        current_user = db.query(models.User).filter(models.User.id == doc_id).first()
        if current_user:
            print(f"Fallback search for name: {current_user.name}")
            # This is a safety check to see if records exist under the doctor's name but different ID
            # (In case of database migrations or ID shifts)
            all_predictions = db.query(models.Prediction).filter(models.Prediction.doctor_id == doc_id).all()
    linked_patients = patient_query.all()
    
    # Basic Stats
    total_cases = len(all_predictions)
    tb_cases = len([p for p in all_predictions if p.result == 'TB'])
    pneumonia_cases = len([p for p in all_predictions if p.result == 'Pneumonia'])
    
    # Monthly Trends (Last 6 months)
    from datetime import datetime, timedelta
    trends = []
    for i in range(5, -1, -1):
        month_start = datetime.utcnow().replace(day=1) - timedelta(days=i*30)
        month_name = month_start.strftime("%b")
        
        # Filter predictions for this month
        month_preds = [p for p in all_predictions if p.created_at.month == month_start.month and p.created_at.year == month_start.year]
        
        trends.append({
            "name": month_name,
            "tb": len([p for p in month_preds if p.result == 'TB']),
            "pneumonia": len([p for p in month_preds if p.result == 'Pneumonia']),
            "normal": len([p for p in month_preds if p.result == 'Normal'])
        })
    
    # Fetch doctor name for personalization
    doc_id = int(user_info['id'])
    doctor = db.query(models.User).filter(models.User.id == doc_id).first()
    doctor_name = doctor.name if doctor else "Medical Officer"
    print(f"DEBUG: Dashboard personalized for: {doctor_name}")

    # Create a mapping of patient IDs to names for the records table
    patient_map = {p.id: p.name for p in linked_patients}
    
    # Calculate Total Revenue
    completed_appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doc_id,
        models.Appointment.status == "completed"
    ).all()
    total_revenue = sum((app.fee_charged or 0) for app in completed_appointments)
    
    return {
        "doctor_name": doctor_name,
        "stats": {
            "total": total_cases,
            "tb": tb_cases,
            "pneumonia": pneumonia_cases,
            "normal": total_cases - tb_cases - pneumonia_cases,
            "patient_count": len(linked_patients),
            "revenue": total_revenue
        },
        "trends": trends,
        "records": [
            {
                "id": r.id, 
                "user_id": r.user_id, 
                "patient_name": patient_map.get(r.user_id, "Guest/Self"),
                "result": r.result, 
                "confidence": r.confidence, 
                "created_at": r.created_at,
                "image_path": r.image_path,
                "image_url": _radiology_asset_path(r.image_path),
                "heatmap_url": _get_gradcam_asset_path(r.image_path)
            } for r in all_predictions
        ],
        "patients": [
            {
                "id": p.id, 
                "name": p.name, 
                "cnic": p.cnic, 
                "phone": p.phone,
                "address": p.address,
                "gender": p.gender,
                "age": p.age,
                "profile_pic": p.profile_pic,
                "created_at": p.created_at
            } for p in linked_patients
        ]
    }

# --- APPOINTMENT TOKEN BOOKING SYSTEM ---

@router.get("/doctors/list")
def get_doctors_list(db: Session = Depends(get_db)):
    doctors = db.query(models.User).filter(models.User.role == "doctor").all()
    return [
        {
            "id": doc.id,
            "name": doc.name,
            "profile_pic": doc.profile_pic,
            "specialization": doc.specialization or "General Medical Specialist",
            "clinic_name": doc.clinic_name or "PulmoAI Wellness Clinic",
            "address": doc.address or "Clinical Headquarters",
            "token_mode": doc.token_mode or "fixed",
            "max_tokens": doc.max_tokens or 20,
            "about": doc.about,
            "timetable": doc.timetable,
            "consultation_fee": doc.consultation_fee,
            "whatsapp": doc.whatsapp
        } for doc in doctors
    ]

@router.get("/appointments/booked-tokens")
def get_booked_tokens(
    doctor_id: int,
    date: str,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    try:
        date_value = normalize_date(date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.booking_date == date_value
    ).all()
    tokens = set()
    for app in appointments:
        try:
            token_number = int(app.token_number)
        except (TypeError, ValueError):
            continue
        if token_number > 0:
            tokens.add(token_number)
    tokens = sorted(tokens)
    if active_only:
        try:
            return get_queue_window(db, doctor_id, date_value)["booked_tokens"]
        except QueueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return tokens


@router.get("/appointments/queue-window")
def get_queue_window_route(doctor_id: int, date: str, db: Session = Depends(get_db)):
    try:
        date_value = normalize_date(date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    doctor = db.query(models.User).filter(
        models.User.id == doctor_id,
        models.User.role == "doctor"
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found or not registered.")

    try:
        return get_queue_window(db, doctor_id, date_value, doctor=doctor)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/appointments/book")
def book_appointment(data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    role = user_info.get("role")

    try:
        doctor_id = int(data.get("doctor_id"))
        date_value = normalize_date(data.get("booking_date"))
        requested_token = normalize_token(data.get("token_number"), required=False)
        patient_id = int(data.get("patient_id")) if role in ("doctor", "admin") and data.get("patient_id") else int(user_info["id"])
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Doctor, date, patient, and token values must be valid.")

    patient_name_override = data.get("patient_name_override")
    if patient_name_override is not None:
        patient_name_override = str(patient_name_override).strip() or None

    if role not in ("patient", "doctor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to book appointments.")

    doctor = db.query(models.User).filter(
        models.User.id == doctor_id,
        models.User.role == "doctor"
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found or not registered.")

    if role in ("doctor", "admin") and data.get("patient_id"):
        patient = db.query(models.User).filter(models.User.id == patient_id).first()
        if not patient or patient.role != "patient":
            raise HTTPException(status_code=404, detail="Patient not found.")

    if role not in ("doctor", "admin"):
        from datetime import datetime, timedelta
        four_hours_ago = datetime.utcnow() - timedelta(hours=4)
        recent_app = db.query(models.Appointment).filter(
            models.Appointment.patient_id == patient_id,
            models.Appointment.created_at >= four_hours_ago
        ).order_by(models.Appointment.created_at.desc()).first()

        if recent_app and recent_app.created_at:
            time_elapsed = datetime.utcnow() - recent_app.created_at
            time_remaining = timedelta(hours=4) - time_elapsed
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            hours_rem = minutes_remaining // 60
            mins_rem = minutes_remaining % 60
            time_str = f"{hours_rem}h {mins_rem}m" if hours_rem > 0 else f"{mins_rem}m"
            raise HTTPException(
                status_code=400,
                detail=f"To ensure fair access, patients can only book one token every 4 hours. Please wait {time_str} before booking another token."
            )

    try:
        with queue_lock(db, doctor_id, date_value):
            if role != "doctor":
                patient_existing = db.query(models.Appointment).filter(
                    models.Appointment.doctor_id == doctor_id,
                    models.Appointment.booking_date == date_value,
                    models.Appointment.patient_id == patient_id
                ).first()
                if patient_existing:
                    raise QueueError(
                        f"You have already booked Token #{patient_existing.token_number} with this doctor for that date."
                    )

            assigned_token = allocate_token(
                db,
                doctor_id,
                date_value,
                requested_token=requested_token,
                for_update=True,
                doctor=doctor
            )
            new_app = models.Appointment(
                doctor_id=doctor_id,
                patient_id=patient_id,
                booking_date=date_value,
                token_number=assigned_token,
                patient_name_override=patient_name_override,
                fee_charged=doctor.consultation_fee or 0,
                status="pending"
            )
            db.add(new_app)
            db.flush()
            db.commit()
            db.refresh(new_app)
    except QueueError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That token was booked by another request. Please choose another active token.")

    try:
        queue_window = get_queue_window(db, doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": f"Successfully booked Token #{assigned_token} for {date_value}!",
        "appointment_id": new_app.id,
        "token_number": assigned_token,
        "queue_window": queue_window
    }

@router.get("/appointments/patient-bookings")
def get_patient_bookings(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    patient_id = int(user_info['id'])

    bookings = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient_id
    ).order_by(models.Appointment.booking_date.desc()).all()

    response_data = []
    for b in bookings:
        # Find active current serving token for this doctor on this day
        serving_app = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == b.doctor_id,
            models.Appointment.booking_date == b.booking_date,
            models.Appointment.status == "serving"
        ).first()
        
        if serving_app:
            current_serving = serving_app.token_number
        else:
            highest_completed = db.query(models.Appointment).filter(
                models.Appointment.doctor_id == b.doctor_id,
                models.Appointment.booking_date == b.booking_date,
                models.Appointment.status == "completed"
            ).order_by(models.Appointment.token_number.desc()).first()
            current_serving = highest_completed.token_number if highest_completed else 0

        response_data.append({
            "id": b.id,
            "doctor_id": b.doctor_id,
            "doctor_name": b.doctor.name if b.doctor else "Unknown Doctor",
            "doctor_specialization": b.doctor.specialization if b.doctor else "General Specialist",
            "clinic_name": b.doctor.clinic_name if b.doctor else "Wellness Clinic",
            "patient_name": b.patient_name_override or (b.patient.name if b.patient else None),
            "booking_date": b.booking_date,
            "token_number": b.token_number,
            "status": b.status or "pending",
            "fee_charged": b.fee_charged,
            "current_serving": current_serving,
            "created_at": b.created_at
        })

    return response_data

@router.get("/appointments/doctor-queue-public")
def get_doctor_queue_public(
    doctor_id: int,
    date: str,
    active_only: bool = False,
    user_info: dict | None = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    try:
        date_value = normalize_date(date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.booking_date == date_value
    ).order_by(models.Appointment.token_number.asc()).all()
    if active_only:
        try:
            queue_window = get_queue_window(db, doctor_id, date_value, appointments=appointments)
            appointments = appointments_in_window(appointments, queue_window)
        except QueueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return [
        {
            "id": app.id,
            "token_number": app.token_number,
            # This route is reachable without a token, so an anonymous caller gets
            # initials only and the fee is withheld: returning them in full
            # published every patient's identity, token number and charge for the
            # clinic day to anyone on the internet. A signed-in caller (patient,
            # doctor or admin) is served the full name so the booking page's queue
            # board reads properly. The doctor-only view with phone, gender, age
            # and fee is /appointments/doctor-today.
            "patient_name": _queue_patient_display_name(
                app.patient_name_override or (app.patient.name if app.patient else None),
                user_info
            ),
            "status": app.status or "pending",
        } for app in appointments
    ]


@router.get("/appointments/doctor-today")
def get_doctor_today_appointments(
    date: str,
    active_only: bool = False,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    doctor_id = int(user_info['id'])

    doctor = db.query(models.User).filter(models.User.id == doctor_id, models.User.role == "doctor").first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Access denied. Only doctors can view their queue.")

    try:
        date_value = normalize_date(date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.booking_date == date_value
    ).order_by(models.Appointment.token_number.asc()).all()
    if active_only:
        try:
            queue_window = get_queue_window(db, doctor_id, date_value, appointments=appointments)
            appointments = appointments_in_window(appointments, queue_window)
        except QueueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return [
        {
            "id": app.id,
            "token_number": app.token_number,
            "patient_name": app.patient_name_override or (app.patient.name if app.patient else "Unknown Patient"),
            "patient_phone": app.patient.phone if app.patient else "N/A",
            "patient_gender": app.patient.gender if app.patient else "N/A",
            "patient_age": app.patient.age if app.patient else "N/A",
            "patient_profile_pic": app.patient.profile_pic if app.patient else None,
            "status": app.status or "pending",
            "fee_charged": app.fee_charged,
            "created_at": app.created_at
        } for app in appointments
    ]

@router.post("/appointments/move-to-tomorrow")
def move_appointment_to_tomorrow(data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    role = user_info.get("role")
    if role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        appointment_id = int(data.get("appointment_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid appointment ID is required.")

    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if role == "doctor" and appointment.doctor_id != int(user_info["id"]):
        raise HTTPException(status_code=403, detail="Not authorized for this appointment.")

    doctor_id = int(appointment.doctor_id)
    source_date = str(appointment.booking_date)
    from datetime import datetime, timedelta
    try:
        current_date = datetime.strptime(source_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        current_date = datetime.utcnow()
    tomorrow_date = (current_date + timedelta(days=1)).strftime("%Y-%m-%d")
    if tomorrow_date < datetime.utcnow().strftime("%Y-%m-%d"):
        tomorrow_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        with queue_lock(db, doctor_id, tomorrow_date):
            appointment = db.query(models.Appointment).filter(
                models.Appointment.id == appointment_id
            ).with_for_update().first()
            if not appointment:
                raise HTTPException(status_code=404, detail="Appointment not found")
            if str(appointment.booking_date) != source_date:
                raise HTTPException(status_code=409, detail="Appointment changed; please retry.")
            new_token_number = allocate_token(
                db,
                doctor_id,
                tomorrow_date,
                for_update=True
            )
            appointment.booking_date = tomorrow_date
            appointment.token_number = new_token_number
            db.flush()
            db.commit()
    except QueueError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A token was allocated concurrently. Please try again.")

    try:
        queue_window = get_queue_window(db, doctor_id, tomorrow_date)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": "Moved to tomorrow",
        "new_date": tomorrow_date,
        "new_token": new_token_number,
        "queue_window": queue_window
    }

@router.post("/appointments/update-status")
def update_appointment_status(data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Not authorized.")
    doctor_id = int(user_info["id"])

    try:
        appointment_id = int(data.get("appointment_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid appointment ID is required.")

    new_status = str(data.get("status") or "").strip().lower()
    if new_status not in ("pending", "serving", "completed", "absent", "arrived"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be pending, serving, completed, absent, or arrived.")

    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.doctor_id == doctor_id
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found or not assigned to you.")

    try:
        date_value = normalize_date(appointment.booking_date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    doctor = db.query(models.User).filter(
        models.User.id == doctor_id,
        models.User.role == "doctor"
    ).first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Access denied. Only doctors can update appointments.")

    with queue_lock(db, doctor_id, date_value):
        appointment = db.query(models.Appointment).filter(
            models.Appointment.id == appointment_id,
            models.Appointment.doctor_id == doctor_id
        ).with_for_update().first()
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found or not assigned to you.")

        if new_status == "serving":
            previous_serving = db.query(models.Appointment).filter(
                models.Appointment.doctor_id == doctor_id,
                models.Appointment.booking_date == date_value,
                models.Appointment.status == "serving"
            ).with_for_update().first()
            if previous_serving:
                previous_serving.status = "completed"
                previous_serving.fee_charged = previous_serving.fee_charged or doctor.consultation_fee or 0

        appointment.status = new_status
        if new_status == "completed":
            custom_fee = data.get("custom_fee")
            if custom_fee is not None and str(custom_fee).strip() != "":
                try:
                    appointment.fee_charged = int(custom_fee)
                except (TypeError, ValueError):
                    appointment.fee_charged = doctor.consultation_fee or 0
            elif appointment.fee_charged is None:
                appointment.fee_charged = doctor.consultation_fee or 0

        db.commit()
        db.refresh(appointment)

    try:
        queue_window = get_queue_window(db, doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": f"Appointment token #{appointment.token_number} updated to {new_status}!",
        "appointment_id": appointment.id,
        "status": appointment.status,
        "queue_window": queue_window
    }

@router.post("/appointments/check-in/{appointment_id}")
def check_in_appointment(appointment_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can check in to appointments.")
    patient_id = int(user_info["id"])

    app = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.patient_id == patient_id
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    try:
        date_value = normalize_date(app.booking_date)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    doctor_id = int(app.doctor_id)
    with queue_lock(db, doctor_id, date_value):
        app = db.query(models.Appointment).filter(
            models.Appointment.id == appointment_id,
            models.Appointment.patient_id == patient_id
        ).with_for_update().first()
        if not app:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if app.status != "absent":
            raise HTTPException(status_code=400, detail="Only absent/delayed appointments can check in.")
        app.status = "arrived"
        db.commit()

    try:
        queue_window = get_queue_window(db, doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": "You have checked in successfully! Waiting for doctor's approval to re-add you to the live queue.",
        "status": "arrived",
        "queue_window": queue_window
    }


@router.get("/appointments/serving-status")
def get_serving_status(doctor_id: int, date: str, db: Session = Depends(get_db)):
    try:
        date_value = normalize_date(date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    serving_app = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.booking_date == date_value,
        models.Appointment.status == "serving"
    ).first()

    if serving_app:
        return {
            "doctor_id": doctor_id,
            "date": date_value,
            "current_serving": serving_app.token_number,
            "status": "serving"
        }

    highest_completed = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.booking_date == date_value,
        models.Appointment.status == "completed"
    ).order_by(models.Appointment.token_number.desc()).first()

    return {
        "doctor_id": doctor_id,
        "date": date_value,
        "current_serving": highest_completed.token_number if highest_completed else 0,
        "status": "completed" if highest_completed else "idle"
    }

@router.delete("/appointments/cancel/{appointment_id}")
def cancel_appointment(appointment_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    user_id = int(user_info["id"])
    role = user_info.get("role")
    if role not in ("doctor", "patient"):
        raise HTTPException(status_code=403, detail="Not authorized.")

    from datetime import datetime
    today_str = datetime.now().strftime("%Y-%m-%d")

    app = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if app.status == "completed":
        raise HTTPException(status_code=400, detail="This patient checkup is already completed. Completed tokens cannot be cancelled or deleted.")
    if app.booking_date < today_str:
        raise HTTPException(status_code=400, detail="The scheduled day for this appointment has ended. Past date appointments cannot be cancelled or deleted.")
    if role == "doctor" and app.doctor_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this clinic's appointments.")
    if role == "patient" and app.patient_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment.")

    try:
        date_value = normalize_date(app.booking_date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    doctor_id = int(app.doctor_id)
    with queue_lock(db, doctor_id, date_value):
        app = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).with_for_update().first()
        if not app:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if app.status == "completed":
            raise HTTPException(status_code=400, detail="This patient checkup is already completed. Completed tokens cannot be cancelled or deleted.")
        if app.booking_date < today_str:
            raise HTTPException(status_code=400, detail="The scheduled day for this appointment has ended. Past date appointments cannot be cancelled or deleted.")
        if role == "doctor" and app.doctor_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this clinic's appointments.")
        if role == "patient" and app.patient_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment.")
        db.delete(app)
        db.commit()

    try:
        queue_window = get_queue_window(db, doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": "Appointment cancelled successfully!",
        "queue_window": queue_window
    }

@router.put("/appointments/update/{appointment_id}")
def update_appointment(appointment_id: int, data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can reschedule appointments.")
    patient_id = int(user_info['id'])

    try:
        new_date = normalize_date(data.get("booking_date"))
        requested_token = normalize_token(data.get("token_number"), required=False)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    from datetime import datetime
    today_str = datetime.now().strftime("%Y-%m-%d")

    app = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.patient_id == patient_id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if app.status == "completed":
        raise HTTPException(status_code=400, detail="This patient checkup is already completed. Completed tokens cannot be rescheduled or edited.")
    if app.booking_date < today_str:
        raise HTTPException(status_code=400, detail="The scheduled day for this appointment has ended. Past date appointments cannot be rescheduled or edited.")
    doctor_id = int(app.doctor_id)

    try:
        with queue_lock(db, doctor_id, new_date):
            app = db.query(models.Appointment).filter(
                models.Appointment.id == appointment_id,
                models.Appointment.patient_id == patient_id
            ).with_for_update().first()
            if not app:
                raise HTTPException(status_code=404, detail="Appointment not found.")
            if app.status == "completed":
                raise HTTPException(status_code=400, detail="This patient checkup is already completed. Completed tokens cannot be rescheduled or edited.")
            if app.booking_date < today_str:
                raise HTTPException(status_code=400, detail="The scheduled day for this appointment has ended. Past date appointments cannot be rescheduled or edited.")
            other_patient_booking = db.query(models.Appointment).filter(
                models.Appointment.doctor_id == doctor_id,
                models.Appointment.booking_date == new_date,
                models.Appointment.patient_id == patient_id,
                models.Appointment.id != appointment_id
            ).first()
            if other_patient_booking:
                raise QueueError(
                    f"You already have Token #{other_patient_booking.token_number} with this doctor on that date."
                )

            assigned_token = allocate_token(
                db,
                doctor_id,
                new_date,
                requested_token=requested_token,
                exclude_appointment_id=appointment_id,
                for_update=True
            )
            app.booking_date = new_date
            app.token_number = assigned_token
            app.status = "pending"
            db.flush()
            db.commit()
    except QueueError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That token was booked by another request. Please choose another active token.")

    try:
        queue_window = get_queue_window(db, doctor_id, new_date)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return {
        "message": f"Appointment rescheduled successfully to Token #{assigned_token}!",
        "appointment_id": app.id,
        "booking_date": new_date,
        "token_number": assigned_token,
        "queue_window": queue_window
    }


# ========================================================
# REGISTRATION & LIVE TOKEN APPROVAL SYSTEM
# ========================================================

@router.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    doctor_id = None
    request_id = None

    try:
        access_token = websocket.query_params.get("token")
        if access_token:
            user_info = get_current_user_from_token(access_token)
            if user_info.get("role") in ("doctor", "admin"):
                doctor_id = int(user_info["id"])

        if doctor_id is None:
            raw_request_id = websocket.query_params.get("request_id")
            if raw_request_id:
                candidate = int(raw_request_id)
                req = websocket.app.state.db_factory().query(models.RegistrationRequest).filter(
                    models.RegistrationRequest.id == candidate
                ).first()
                if req and req.status == "pending":
                    request_id = req.id

        if doctor_id is None and request_id is None:
            await websocket.close(code=4401)
            return
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, doctor_id=doctor_id, request_id=request_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.post("/registration/request")
async def submit_registration_request(data: dict, db: Session = Depends(get_db)):
    try:
        doctor_id = int(data.get("doctor_id"))
        date_value = normalize_date(data.get("booking_date"))
        token_number = normalize_token(data.get("token_number"))
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Doctor, date, and token values must be valid.")

    name = str(data.get("name") or "").strip()
    phone = str(data.get("phone") or "").strip()
    cnic = str(data.get("cnic") or "").strip()
    if not name or not phone or not cnic:
        raise HTTPException(status_code=400, detail="Name, phone, and CNIC are required.")

    doctor = db.query(models.User).filter(
        models.User.id == doctor_id,
        models.User.role == "doctor"
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found or not registered.")

    try:
        with queue_lock(db, doctor_id, date_value):
            existing = db.query(models.RegistrationRequest).filter(
                (models.RegistrationRequest.phone == phone) | (models.RegistrationRequest.cnic == cnic),
                models.RegistrationRequest.status == "pending"
            ).first()
            if existing:
                raise QueueError("You already have a pending registration request.")

            duplicate_token = db.query(models.RegistrationRequest).filter(
                models.RegistrationRequest.doctor_id == doctor_id,
                models.RegistrationRequest.booking_date == date_value,
                models.RegistrationRequest.token_number == token_number,
                models.RegistrationRequest.status == "pending"
            ).first()
            if duplicate_token:
                raise QueueError(f"Token #{token_number} already has a pending registration request.")

            queue_window = get_queue_window(db, doctor_id, date_value, for_update=True, doctor=doctor)
            if token_number not in queue_window["available_tokens"]:
                if token_number not in queue_window["tokens"]:
                    raise QueueError(
                        f"Token #{token_number} is outside the active batch "
                        f"({queue_window['window_start']}-{queue_window['window_end']})."
                    )
                raise QueueError(f"Token #{token_number} is no longer available.")

            new_request = models.RegistrationRequest(
                doctor_id=doctor_id,
                name=name,
                phone=phone,
                cnic=cnic,
                gender=data.get("gender"),
                age=data.get("age"),
                booking_date=date_value,
                token_number=token_number,
                status="pending"
            )
            db.add(new_request)
            db.flush()
            db.commit()
            db.refresh(new_request)
    except QueueError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That token was reserved by another request. Please choose another active token.")

    try:
        queue_window = get_queue_window(db, doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    await manager.broadcast({
        "type": "NEW_REGISTRATION_REQUEST",
        "doctor_id": doctor_id,
        "request": {
            "id": new_request.id,
            "name": name,
            "booking_date": date_value,
            "token_number": token_number
        }
    })

    return {
        "message": "Registration request submitted successfully.",
        "request_id": new_request.id,
        "queue_window": queue_window
    }


@router.get("/registration/status/{phone_or_cnic}")
async def check_registration_status(phone_or_cnic: str, db: Session = Depends(get_db)):
    import re

    normalized = re.sub(r'[^0-9]', '', phone_or_cnic)
    req = db.query(models.RegistrationRequest).filter(
        (models.RegistrationRequest.phone == normalized) | (models.RegistrationRequest.cnic == normalized)
    ).order_by(models.RegistrationRequest.created_at.desc()).first()

    if not req:
        raise HTTPException(status_code=404, detail="No registration request found.")

    return {
        "id": req.id,
        "status": req.status,
        "rejection_reason": req.rejection_reason
    }

@router.get("/registration/requests")
async def get_registration_requests(
    date: Optional[str] = None,
    active_only: bool = False,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    date_value = None
    if date:
        try:
            date_value = normalize_date(date, allow_past=True)
        except QueueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    query = db.query(models.RegistrationRequest).filter(
        models.RegistrationRequest.doctor_id == user_info["id"],
        models.RegistrationRequest.status == "pending"
    )
    if date_value:
        query = query.filter(models.RegistrationRequest.booking_date == date_value)
    requests = query.order_by(models.RegistrationRequest.created_at.desc()).all()

    if active_only and date_value:
        try:
            queue_window = get_queue_window(db, int(user_info["id"]), date_value)
            requests = [
                request for request in requests
                if queue_window["window_start"] <= (request.token_number or 0) <= queue_window["window_end"]
            ]
        except QueueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    return requests

@router.post("/registration/{request_id}/approve")
async def approve_registration(request_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    req = db.query(models.RegistrationRequest).filter(models.RegistrationRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if int(req.doctor_id) != int(user_info["id"]):
        raise HTTPException(status_code=403, detail="Not authorized for this request.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been processed.")

    try:
        date_value = normalize_date(req.booking_date)
        requested_token = normalize_token(req.token_number)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    doctor = db.query(models.User).filter(
        models.User.id == req.doctor_id,
        models.User.role == "doctor"
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found or not registered.")

    try:
        with queue_lock(db, req.doctor_id, date_value):
            req = db.query(models.RegistrationRequest).filter(
                models.RegistrationRequest.id == request_id,
                models.RegistrationRequest.status == "pending"
            ).with_for_update().first()
            if not req:
                raise QueueError("This request has already been processed.", status_code=409)

            patient = db.query(models.User).filter(
                (models.User.phone == req.phone) | (models.User.cnic == req.cnic)
            ).first()
            if patient and patient.role != "patient":
                raise QueueError("A non-patient account uses these registration details.", status_code=409)

            if not patient:
                patient = models.User(
                    name=req.name,
                    phone=req.phone,
                    cnic=req.cnic,
                    hashed_password=get_password_hash(req.cnic),
                    role="patient",
                    gender=req.gender,
                    age=req.age
                )
                db.add(patient)
                db.flush()

            existing_booking = db.query(models.Appointment).filter(
                models.Appointment.doctor_id == req.doctor_id,
                models.Appointment.booking_date == date_value,
                models.Appointment.patient_id == patient.id
            ).first()
            if existing_booking:
                raise QueueError(
                    f"This patient already has Token #{existing_booking.token_number} with this doctor on that date.",
                    status_code=409
                )

            link_exists = db.query(models.DoctorPatient).filter(
                models.DoctorPatient.doctor_id == req.doctor_id,
                models.DoctorPatient.patient_id == patient.id
            ).first()
            if not link_exists:
                db.add(models.DoctorPatient(doctor_id=req.doctor_id, patient_id=patient.id))

            assigned_token = allocate_token(
                db,
                req.doctor_id,
                date_value,
                requested_token=requested_token,
                allow_fallback=True,
                exclude_request_id=req.id,
                for_update=True
            )
            new_app = models.Appointment(
                doctor_id=req.doctor_id,
                patient_id=patient.id,
                booking_date=date_value,
                token_number=assigned_token,
                fee_charged=doctor.consultation_fee or 0,
                status="pending"
            )
            db.add(new_app)
            req.token_number = assigned_token
            req.status = "approved"
            request_doctor_id = int(req.doctor_id)
            request_patient_id = int(patient.id)
            db.flush()
            db.commit()
    except QueueError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That token was allocated concurrently. Please try again.")

    try:
        queue_window = get_queue_window(db, request_doctor_id, date_value)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    await manager.broadcast({
        "type": "REGISTRATION_APPROVED",
        "request_id": request_id,
        "doctor_id": request_doctor_id,
        "token_number": assigned_token
    })

    return {
        "message": "Approved and account created",
        "assigned_token": assigned_token,
        "queue_window": queue_window
    }


@router.post("/registration/{request_id}/reject")
async def reject_registration(request_id: int, data: dict, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    doctor_id = int(user_info["id"])
    req = db.query(models.RegistrationRequest).filter(
        models.RegistrationRequest.id == request_id,
        models.RegistrationRequest.doctor_id == doctor_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been processed.")

    try:
        date_value = normalize_date(req.booking_date, allow_past=True)
    except QueueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    rejection_reason = str(data.get("reason") or "No reason provided").strip()
    with queue_lock(db, doctor_id, date_value):
        req = db.query(models.RegistrationRequest).filter(
            models.RegistrationRequest.id == request_id,
            models.RegistrationRequest.doctor_id == doctor_id,
            models.RegistrationRequest.status == "pending"
        ).with_for_update().first()
        if not req:
            raise HTTPException(status_code=409, detail="This request has already been processed.")
        req.status = "rejected"
        req.rejection_reason = rejection_reason
        db.commit()

    await manager.broadcast({
        "type": "REGISTRATION_REJECTED",
        "request_id": request_id,
        "doctor_id": doctor_id,
        "reason": rejection_reason
    })

    return {"message": "Request rejected."}

@router.get("/doctor/payments")
def get_doctor_payments(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_info = get_current_user_from_token(token)
    if user_info['role'] != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized. Only doctors can view payments.")
    
    doc_id = int(user_info['id'])
    
    completed_appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doc_id,
        models.Appointment.status == "completed"
    ).order_by(models.Appointment.id.desc()).all()
    
    total_revenue = 0
    this_month_revenue = 0
    today_revenue = 0
    
    from datetime import datetime
    now = datetime.utcnow()
    
    payment_history = []
    
    for app in completed_appointments:
        fee = app.fee_charged or 0
        total_revenue += fee
        
        # Check if in current month
        if app.booking_date.startswith(f"{now.year}-{now.month:02d}"):
            this_month_revenue += fee
            
        # Check if today
        if app.booking_date == f"{now.year}-{now.month:02d}-{now.day:02d}":
            today_revenue += fee
            
        # Add all completed appointments to history, even if fee is 0 (Free)
        patient = db.query(models.User).filter(models.User.id == app.patient_id).first()
        payment_history.append({
            "id": app.id,
            "date": app.booking_date,
            "patient_name": patient.name if patient else "Unknown",
            "patient_phone": patient.phone if patient else "",
            "fee": fee,
            "token_number": app.token_number
        })
            
    return {
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "today_revenue": today_revenue,
        "history": payment_history
    }
