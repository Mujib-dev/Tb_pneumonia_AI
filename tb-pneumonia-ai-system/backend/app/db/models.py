from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class UserRole(enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    phone = Column(String, unique=True, index=True)
    whatsapp = Column(String, nullable=True)
    cnic = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="patient") # patient or doctor
    profile_pic = Column(String, nullable=True) # Path to image
    specialization = Column(String, nullable=True)
    clinic_name = Column(String, nullable=True)
    address = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    token_mode = Column(String, default="fixed") # fixed or dynamic
    max_tokens = Column(Integer, default=20)
    about = Column(String, nullable=True)
    timetable = Column(String, nullable=True)
    consultation_fee = Column(Integer, default=0) # Doctor's fee per patient
    used_access_code = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    predictions = relationship("Prediction", back_populates="owner", foreign_keys="Prediction.user_id")
    doctor_predictions = relationship("Prediction", back_populates="doctor", foreign_keys="Prediction.doctor_id")
    
    # Many-to-many relationship for doctor-patient linking
    patients = relationship(
        "User", 
        secondary="doctor_patients",
        primaryjoin="User.id==DoctorPatient.doctor_id",
        secondaryjoin="User.id==DoctorPatient.patient_id",
        backref="doctors"
    )

class DoctorPatient(Base):
    __tablename__ = "doctor_patients"
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    patient_id = Column(Integer, ForeignKey("users.id"))

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_path = Column(String)
    result = Column(String) # Normal, TB, Pneumonia
    confidence = Column(Float)
    all_scores = Column(String) # Store as stringified JSON or simple string
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="predictions", foreign_keys=[user_id])
    doctor = relationship("User", back_populates="doctor_predictions", foreign_keys=[doctor_id])


class DicomStudy(Base):
    """A study pushed by the hospital X-ray machine over DICOM C-STORE.

    Rows are created unattributed (`patient_id` NULL) and sit in the pending
    inbox until a doctor attaches them. DICOM PatientID does not reliably match
    this system's phone/CNIC scheme, so matching is a deliberate human action.
    """

    __tablename__ = "dicom_studies"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=True)

    # DICOM identity, kept for traceability back to the modality.
    study_instance_uid = Column(String, index=True)
    sop_instance_uid = Column(String, index=True)
    series_instance_uid = Column(String)
    source_ae_title = Column(String)
    modality = Column(String)

    # Clinical label carried in the study, if the modality populated it.
    dicom_patient_id = Column(String, index=True)
    dicom_patient_name = Column(String)

    # Rendered PNG handed to the model, plus the retained original study.
    image_path = Column(String)
    source_dicom_path = Column(String)

    # Analysis outcome. status: pending | analysed | rejected
    status = Column(String, default="pending", index=True)
    result = Column(String)
    confidence = Column(Float)
    all_scores = Column(String)
    rejection_reason = Column(String)

    source_ip = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # A retried send of the same instance must not create a second study.
        UniqueConstraint("sop_instance_uid", name="uq_dicom_study_sop_instance"),
    )

    prediction = relationship("Prediction", foreign_keys=[prediction_id])
    patient = relationship("User", foreign_keys=[patient_id])

    patient = relationship("User", foreign_keys=[patient_id])
    prediction = relationship("Prediction", foreign_keys=[prediction_id])

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    patient_id = Column(Integer, ForeignKey("users.id"))
    booking_date = Column(String, index=True)  # Format: YYYY-MM-DD
    token_number = Column(Integer)
    status = Column(String, default="pending")  # pending, serving, completed
    fee_charged = Column(Integer, default=0) # The fee that was active at the time of booking
    patient_name_override = Column(String, nullable=True) # Used by doctors to assign tokens to family members/offline patients
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("doctor_id", "booking_date", "token_number", name="uq_appointment_doctor_date_token"),
        CheckConstraint("token_number > 0", name="ck_appointment_token_positive")
    )

    # Relationships
    doctor = relationship("User", foreign_keys=[doctor_id])
    patient = relationship("User", foreign_keys=[patient_id])

class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    phone = Column(String, index=True)
    cnic = Column(String, index=True)
    gender = Column(String)
    age = Column(Integer)
    booking_date = Column(String)
    token_number = Column(Integer)
    status = Column(String, default="pending")  # pending, approved, rejected
    rejection_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    doctor = relationship("User", foreign_keys=[doctor_id])

class SiteSettings(Base):
    __tablename__ = "site_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String, unique=True, index=True)
    setting_value = Column(String)

class ContactMessage(Base):
    __tablename__ = "contact_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String)
    whatsapp = Column(String, nullable=True)
    subject = Column(String)
    message = Column(String)
    is_read = Column(Integer, default=0) # 0 for false, 1 for true
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Set only when the sender was signed in, so the doctor can reply in-app.
    # NULL means a guest inquiry, which is reachable over WhatsApp only.
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("User", foreign_keys=[doctor_id])
    sender = relationship("User", foreign_keys=[sender_user_id])
    replies = relationship("MessageReply", back_populates="message", cascade="all, delete-orphan", order_by="MessageReply.created_at")

class MessageReply(Base):
    __tablename__ = "message_replies"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("contact_messages.id"), nullable=False, index=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("ContactMessage", back_populates="replies")
    sender = relationship("User", foreign_keys=[sender_user_id])
