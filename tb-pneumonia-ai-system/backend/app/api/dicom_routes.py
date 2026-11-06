"""HTTP surface for the DICOM C-STORE gateway.

The gateway process itself owns the DICOM port; these endpoints let the web app
observe and curate what it receives. Auto-ingested studies arrive unattributed
and are listed here until a doctor attaches one to a patient, because the
DICOM PatientID does not reliably map onto this system's phone/CNIC scheme.
"""
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

try:
    from app.db.database import get_db
    from app.db import models
    from app.core.config import settings
    from app.api.auth_utils import oauth2_scheme, get_current_user_from_token
except (ImportError, ModuleNotFoundError):
    from ..db.database import get_db
    from ..db import models
    from ..core.config import settings
    from .auth_utils import oauth2_scheme, get_current_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter()

RADIOLOGY_DIR = os.path.join("uploads", "radiology")

# Reason codes the ingest pipeline can record, mapped to operator-facing text.
REJECTION_REASONS = {
    "not_a_chest_xray": "Not a chest radiograph",
    "unsupported_sop_class": "Unsupported DICOM image type",
    "dicom_decode_error": "Pixel data could not be decoded",
    "conversion_error": "Image conversion failed",
    "storage_error": "Could not store the received study",
    "analysis_error": "Analysis failed unexpectedly",
}


def _require_clinician(token: str) -> dict:
    """Only doctors and admins may review the inbox."""
    user_info = get_current_user_from_token(token)
    if user_info.get("role") not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    return user_info


def _serialize(study) -> dict:
    prediction = study.prediction
    return {
        "id": study.id,
        "status": study.status,
        "patient_id": study.patient_id,
        "study_instance_uid": study.study_instance_uid,
        "sop_instance_uid": study.sop_instance_uid,
        "modality": study.modality,
        "source_ae_title": study.source_ae_title,
        "source_ip": study.source_ip,
        "dicom_patient_id": study.dicom_patient_id,
        "dicom_patient_name": study.dicom_patient_name,
        "result": study.result,
        "confidence": study.confidence,
        "rejection_reason": study.rejection_reason,
        "rejection_label": REJECTION_REASONS.get(study.rejection_reason),
        "image_url": _radiology_asset_path(study.image_path),
        "heatmap_url": _radiology_asset_path(_gradcam_path(study.image_path)) if study.image_path else None,
        "created_at": study.created_at.isoformat() if study.created_at else None,
        "reviewed_at": study.reviewed_at.isoformat() if study.reviewed_at else None,
    }


def _radiology_asset_path(stored_path):
    """Mirror the media route's rules: only PNG/JPEG are servable over HTTP."""
    if not stored_path:
        return None
    safe_name = os.path.basename(str(stored_path).replace("\\", "/"))
    if not safe_name or not safe_name.lower().endswith((".jpg", ".jpeg", ".png")):
        return None
    return f"api/media/radiology/{safe_name}"


def _gradcam_path(image_path):
    if not image_path:
        return None
    base_name, _ = os.path.splitext(str(image_path))
    candidate = f"{base_name}_gradcam.jpg"
    if os.path.isfile(candidate):
        return candidate
    # Derive the location explicitly, since the ingest pipeline may run from a
    # different working directory than the API process.
    radiology_candidate = os.path.join(RADIOLOGY_DIR, os.path.basename(candidate))
    return radiology_candidate if os.path.isfile(radiology_candidate) else None


@router.get("/dicom/gateway-status")
def dicom_gateway_status(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Report gateway configuration and pending counts for the doctor's UI.

    The listener runs in a separate process, so the API reports configuration
    and queue depth rather than claiming the port is live. `DICOM_ENABLED` false
    means the gateway process is not expected to be running at all.
    """
    user_info = _require_clinician(token)

    from app.services.predict import is_model_connected

    pending = db.query(models.DicomStudy).filter(models.DicomStudy.status == "pending").count()
    rejected = db.query(models.DicomStudy).filter(models.DicomStudy.status == "rejected").count()
    analysed = db.query(models.DicomStudy).filter(models.DicomStudy.status == "analysed").count()

    # A doctor's own unreviewed work, so the badge reflects their clinic.
    mine = db.query(models.DicomStudy).filter(
        models.DicomStudy.patient_id.is_(None),
        models.DicomStudy.status.in_(["pending", "rejected"]),
    ).count()

    return {
        "enabled": settings.DICOM_ENABLED,
        "local_ae_title": settings.DICOM_LOCAL_AE_TITLE,
        "bind_address": settings.DICOM_BIND_ADDRESS,
        "port": settings.DICOM_PORT,
        "remote_ae_allowlist": settings.dicom_allowed_remote_ae_titles,
        "remote_ip_allowlist": settings.dicom_allowed_remote_ips,
        "reject_non_cxr": settings.DICOM_REJECT_NON_CXR,
        "analyse_on_ingest": settings.DICOM_ANALYSE_ON_INGEST,
        "model_connected": is_model_connected(),
        "counts": {"pending": pending, "rejected": rejected, "analysed": analysed, "unattributed": mine},
        # Never imply the machine link is proven; it is simulator-verified only.
        "machine_integration_verified": False,
    }


@router.get("/dicom/pending-studies")
def list_pending_studies(
    limit: int = 50,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Unattributed studies awaiting review, newest first."""
    _require_clinician(token)

    limit = max(1, min(int(limit or 50), 200))
    rows = (
        db.query(models.DicomStudy)
        .filter(models.DicomStudy.patient_id.is_(None))
        .order_by(models.DicomStudy.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize(row) for row in rows]


@router.post("/dicom/pending-studies/{study_id}/attach")
def attach_study_to_patient(
    study_id: int,
    data: dict,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Attach a received study to a patient, mirroring the manual link flow.

    Reuses the existing prediction-linking semantics: the study's prediction
    becomes owned by the patient, and the doctor's own screening history is
    preserved because `doctor_id` was set when it was analysed.
    """
    import re

    user_info = _require_clinician(token)
    identifier = str(data.get("patient_identifier") or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="A patient phone number or CNIC is required.")

    study = db.query(models.DicomStudy).filter(models.DicomStudy.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="DICOM study not found.")
    if study.patient_id:
        raise HTTPException(status_code=400, detail="This study is already attached to a patient.")
    if study.status != "analysed" or not study.prediction_id:
        raise HTTPException(
            status_code=400,
            detail="Only an analysed study can be attached. Review or discard the rejected study instead.",
        )

    norm_id = re.sub(r"[^0-9]", "", identifier)
    patient = db.query(models.User).filter(
        (models.User.phone == norm_id) | (models.User.cnic == norm_id)
    ).first()
    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"No patient matches {identifier}. Register the patient first.",
        )

    # A doctor may only attach a patient already in their own registry.
    if user_info.get("role") == "doctor":
        linked = db.query(models.DoctorPatient).filter(
            models.DoctorPatient.doctor_id == user_info["id"],
            models.DoctorPatient.patient_id == patient.id,
        ).first()
        if not linked:
            raise HTTPException(
                status_code=403,
                detail="You can only attach a patient who is linked to your own registry.",
            )

    prediction = db.query(models.Prediction).filter(
        models.Prediction.id == study.prediction_id
    ).first()
    if prediction is None:
        raise HTTPException(status_code=404, detail="The prediction for this study no longer exists.")

    prediction.user_id = patient.id
    study.patient_id = patient.id
    study.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(study)

    logger.info(
        "DICOM study %s attached to patient %s by user %s",
        study_id, patient.id, user_info.get("id"),
    )
    return {
        "message": f"Study attached to {patient.name}.",
        "study": _serialize(study),
    }


@router.delete("/dicom/pending-studies/{study_id}")
def discard_pending_study(
    study_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Discard an unusable study and remove its files from disk."""
    _require_clinician(token)

    study = db.query(models.DicomStudy).filter(models.DicomStudy.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="DICOM study not found.")
    if study.patient_id:
        raise HTTPException(
            status_code=400,
            detail="This study is attached to a patient; delete the screening record instead.",
        )

    _remove_files(study)
    db.delete(study)
    db.commit()
    return {"message": "DICOM study discarded."}


def _remove_files(study) -> None:
    """Delete the rendered PNG, its heatmap and the retained original study."""
    targets = []
    if study.image_path:
        targets.append(study.image_path)
        base, _ = os.path.splitext(study.image_path)
        targets.append(f"{base}_gradcam.jpg")
    if study.source_dicom_path:
        targets.append(study.source_dicom_path)

    for path in targets:
        if not path:
            continue
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            logger.warning("Could not remove %s", path, exc_info=True)
