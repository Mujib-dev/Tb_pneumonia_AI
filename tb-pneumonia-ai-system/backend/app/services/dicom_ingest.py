"""Ingest pipeline for studies pushed by the hospital X-ray machine.

The modality sends instances over DICOM C-STORE; this module turns each accepted
instance into exactly the same artifacts the manual upload path produces:

    received instance -> retained .dcm -> rendered .png -> CXR validation
                      -> trained DenseNet-121 (unchanged) -> Prediction row

The trained weights and their preprocessing are untouched. A study that cannot
be analysed is still recorded (status `rejected`) so a send is never silently
lost, and nothing is raised into the DICOM caller beyond the C-STORE status.
"""
import logging
import os
import shutil
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from .dicom import DicomError, dicom_to_png, dicom_to_pil
from .image_validator import validate_chest_xray

logger = logging.getLogger(__name__)

# SOP classes the pipeline will analyse. Anything outside this set is recorded
# as skipped rather than fed to a chest X-ray classifier.
ANALYSABLE_SOP_CLASSES = {
    "1.2.840.10008.5.1.4.1.1.1",    # Computed Radiography Image Storage
    "1.2.840.10008.5.1.4.1.1.1.1",  # Digital X-Ray Image Storage - For Presentation
    "1.2.840.10008.5.1.4.1.1.1.1.1",  # Digital X-Ray Image Storage - For Processing
    "1.2.840.10008.5.1.4.1.1.1.2",  # Digital Mammography X-Ray - For Presentation
    "1.2.840.10008.5.1.4.1.1.1.2.1",  # Digital Mammography X-Ray - For Processing
    "1.2.840.10008.5.1.4.1.1.1.7",  # Secondary Capture Image Storage
    "1.2.840.10008.5.1.4.1.1.1.7.1",  # Multiframe Single Bit Secondary Capture
    "1.2.840.10008.5.1.4.1.1.1.7.2",  # Multiframe Grayscale Byte Secondary Capture
    "1.2.840.10008.5.1.4.1.1.1.99",  # Encapsulated PDF (rare, but harmless to skip)
}

RADIOLOGY_DIR = os.path.join("uploads", "radiology")


class IngestRejected(Exception):
    """A study was received and logged but cannot be analysed.

    Carries the reason for the review inbox; the DICOM association is still
    answered with success because the transfer itself did complete.
    """

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail or reason


def _dicom_text(value) -> str | None:
    """Normalise a DICOM text value, tolerating person-name and empty values."""
    if value is None:
        return None
    text = str(value).strip()
    # PN values may carry an ideographic/alphabetic component pair.
    if "^" in text:
        text = text.split("^")[0].strip()
    return text or None


def _save_instance(dataset, storage_dir: str) -> tuple[str, str]:
    """Write the received dataset to disk as .dcm. Returns (path, sop_uid)."""
    os.makedirs(storage_dir, exist_ok=True)
    stem = uuid.uuid4().hex
    sop_uid = _dicom_text(getattr(dataset, "SOPInstanceUID", None)) or f"unknown-{stem}"
    path = os.path.join(storage_dir, f"{stem}.dcm")
    # pydicom 3 renamed this flag; write a conformant file under both versions.
    try:
        dataset.save_as(path, enforce_file_format=True)
    except TypeError:
        dataset.save_as(path, write_like_original=False)
    return path, sop_uid


def _discard(*paths) -> None:
    for path in paths:
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                logger.warning("Could not remove %s", path, exc_info=True)


def ingest_dataset(
    dataset,
    db: Session,
    *,
    source_ae_title: str,
    source_ip: str,
    storage_dir: str = RADIOLOGY_DIR,
    reject_non_cxr: bool = True,
    analyse: bool = True,
) -> dict:
    """Receive one DICOM instance, analyse it, and record it in the inbox.

    Always returns a summary dict. Failures are reported in `status`/`reason`
    rather than raised, because a rejected study still has to be answered to the
    sending modality and shown to a doctor.
    """
    from app.db import models
    from app.services.predict import is_model_connected, predict_image

    sop_class_uid = _dicom_text(getattr(dataset, "SOPClassUID", None)) or ""
    study_uid = _dicom_text(getattr(dataset, "StudyInstanceUID", None))
    series_uid = _dicom_text(getattr(dataset, "SeriesInstanceUID", None))
    modality = _dicom_text(getattr(dataset, "Modality", None))
    dicom_patient_id = _dicom_text(getattr(dataset, "PatientID", None))
    dicom_patient_name = _dicom_text(getattr(dataset, "PatientName", None))

    source_dicom_path = None
    image_path = None

    try:
        source_dicom_path, sop_uid = _save_instance(dataset, storage_dir)
    except Exception as exc:
        logger.exception("Failed to persist received DICOM instance")
        return _failed_study_record(
            db, models, sop_uid, study_uid, series_uid, source_ae_title, modality,
            dicom_patient_id, dicom_patient_name, source_ip,
            "storage_error", f"Could not write the received study: {exc}",
        )

    # A modality that retries a send after a timeout must not create a second
    # study. Checked before any further work so the duplicate is a cheap no-op
    # rather than a wasted inference.
    existing = db.query(models.DicomStudy).filter(
        models.DicomStudy.sop_instance_uid == sop_uid
    ).first()
    if existing is not None:
        _discard(source_dicom_path)
        logger.info(
            "Ignoring duplicate C-STORE for SOP %s from AE %s; study %s already recorded",
            sop_uid, source_ae_title, existing.id,
        )
        return {
            "status": existing.status,
            "sop_instance_uid": sop_uid,
            "study_id": existing.id,
            "reason": "duplicate",
            "message": "Instance was already received; the existing record was kept.",
        }

    study = models.DicomStudy(
        patient_id=None,
        prediction_id=None,
        study_instance_uid=study_uid,
        sop_instance_uid=sop_uid,
        series_instance_uid=series_uid,
        source_ae_title=source_ae_title,
        modality=modality,
        dicom_patient_id=dicom_patient_id,
        dicom_patient_name=dicom_patient_name,
        image_path=None,
        source_dicom_path=source_dicom_path.replace("\\", "/"),
        status="pending",
        source_ip=source_ip,
    )

    try:
        if sop_class_uid and sop_class_uid not in ANALYSABLE_SOP_CLASSES:
            raise IngestRejected(
                "unsupported_sop_class",
                f"Stored SOP Class {sop_class_uid} is not an image type this system analyses.",
            )

        if not is_model_connected():
            # Keep the study for later rather than discarding a good transfer.
            _queue_for_later(study, db, models)
            return {
                "status": study.status,
                "sop_instance_uid": sop_uid,
                "reason": "model_offline",
                "message": "CAD model is offline; the study is queued for review.",
            }

        if not analyse:
            _queue_for_later(study, db, models)
            return {
                "status": study.status,
                "sop_instance_uid": sop_uid,
                "reason": "analysis_disabled",
                "message": "Automatic analysis is disabled; the study is queued for review.",
            }

        # Render with the shared DICOM service so the model sees exactly the
        # same pixels a manual DICOM upload produces.
        try:
            image_path = dicom_to_png(
                source_dicom_path,
                os.path.join(storage_dir, f"{os.path.splitext(os.path.basename(source_dicom_path))[0]}.png"),
            )
        except DicomError as exc:
            raise IngestRejected("dicom_decode_error", str(exc)) from exc
        except Exception as exc:
            raise IngestRejected("conversion_error", f"Pixel conversion failed: {exc}") from exc

        if reject_non_cxr:
            is_valid, validation_msg = validate_chest_xray(image_path)
            if not is_valid:
                raise IngestRejected("not_a_chest_xray", validation_msg)

        result, confidence, all_scores, heatmap_path = predict_image(image_path)

        import json

        prediction = models.Prediction(
            user_id=None,          # unattributed until a doctor attaches it
            doctor_id=None,
            image_path=image_path.replace("\\", "/"),
            result=result,
            confidence=confidence,
            all_scores=json.dumps(all_scores),
        )
        db.add(prediction)
        db.flush()

        study.image_path = prediction.image_path
        study.prediction_id = prediction.id
        study.status = "analysed"
        study.result = result
        study.confidence = confidence
        study.all_scores = json.dumps(all_scores)
        study.reviewed_at = datetime.utcnow()
        db.add(study)
        db.commit()

        logger.info(
            "Analysed DICOM study SOP %s from AE %s (%s): %s %.2f",
            sop_uid, source_ae_title, source_ip, result, confidence,
        )
        return {
            "status": study.status,
            "sop_instance_uid": sop_uid,
            "study_id": study.id,
            "prediction_id": prediction.id,
            "result": result,
            "confidence": confidence,
            "heatmap_path": heatmap_path,
        }

    except IngestRejected as exc:
        # Retain the study so a doctor can see why it was not analysed, but drop
        # the rendered PNG since it is not a usable radiograph.
        _discard(image_path)
        study.image_path = None
        study.status = "rejected"
        study.rejection_reason = exc.reason
        study.reviewed_at = datetime.utcnow()
        db.add(study)
        db.commit()
        logger.warning(
            "Rejected DICOM study SOP %s from AE %s: %s (%s)",
            sop_uid, source_ae_title, exc.reason, exc.detail,
        )
        return {
            "status": study.status,
            "sop_instance_uid": sop_uid,
            "study_id": study.id,
            "reason": exc.reason,
            "message": exc.detail,
        }

    except Exception as exc:
        # An unexpected failure must not lose the transfer or break the
        # association; record it for the review inbox instead.
        _discard(image_path)
        study.image_path = None
        study.status = "rejected"
        study.rejection_reason = "analysis_error"
        study.reviewed_at = datetime.utcnow()
        db.add(study)
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Could not record the failed DICOM study")
        logger.exception("Unexpected error analysing DICOM study SOP %s", sop_uid)
        return {
            "status": "rejected",
            "sop_instance_uid": sop_uid,
            "reason": "analysis_error",
            "message": str(exc),
        }


def _queue_for_later(study, db: Session, models) -> None:
    """Persist an unanalysed study so it can be processed later."""
    db.add(study)
    db.commit()


def _failed_study_record(
    db: Session,
    models,
    sop_uid,
    study_uid,
    series_uid,
    source_ae_title,
    modality,
    dicom_patient_id,
    dicom_patient_name,
    source_ip,
    reason,
    message,
) -> dict:
    """Record a study that failed before any file was written.

    Used when the instance cannot be persisted at all; there is no image to
    review, but the attempt is still auditable.
    """
    existing = db.query(models.DicomStudy).filter(
        models.DicomStudy.sop_instance_uid == sop_uid
    ).first()
    if existing is not None:
        return {"status": existing.status, "sop_instance_uid": sop_uid, "study_id": existing.id,
                "reason": "duplicate", "message": "Instance was already received."}

    study = models.DicomStudy(
        patient_id=None,
        prediction_id=None,
        study_instance_uid=study_uid,
        sop_instance_uid=sop_uid,
        series_instance_uid=series_uid,
        source_ae_title=source_ae_title,
        modality=modality,
        dicom_patient_id=dicom_patient_id,
        dicom_patient_name=dicom_patient_name,
        image_path=None,
        source_dicom_path=None,
        status="rejected",
        rejection_reason=reason,
        source_ip=source_ip,
        reviewed_at=datetime.utcnow(),
    )
    db.add(study)
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not record the failed DICOM study")
        return {"status": "rejected", "sop_instance_uid": sop_uid, "reason": reason, "message": message}
    return {"status": "rejected", "sop_instance_uid": sop_uid, "study_id": study.id,
            "reason": reason, "message": message}
