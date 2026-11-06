-- Migration 002: DICOM gateway pending inbox
--
-- Adds the `dicom_studies` table that records studies pushed by the hospital
-- X-ray machine over C-STORE. Rows are created unattributed and reviewed by a
-- doctor, because the DICOM PatientID does not reliably map onto this system's
-- phone/CNIC patient identifiers.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS dicom_studies (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id),
    prediction_id INTEGER REFERENCES predictions(id),

    study_instance_uid VARCHAR(255),
    sop_instance_uid VARCHAR(255) NOT NULL,
    series_instance_uid VARCHAR(255),
    source_ae_title VARCHAR(255),
    modality VARCHAR(64),

    dicom_patient_id VARCHAR(255),
    dicom_patient_name VARCHAR(255),

    image_path TEXT,
    source_dicom_path TEXT,

    status VARCHAR(32) DEFAULT 'pending',
    result VARCHAR(50),
    confidence DOUBLE PRECISION,
    all_scores TEXT,
    rejection_reason TEXT,

    source_ip VARCHAR(64),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE
);

-- A modality that retries a send after a timeout must not create a second row.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_dicom_study_sop_instance'
    ) THEN
        ALTER TABLE dicom_studies
            ADD CONSTRAINT uq_dicom_study_sop_instance UNIQUE (sop_instance_uid);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_dicom_studies_sop_instance
    ON dicom_studies (sop_instance_uid);

CREATE INDEX IF NOT EXISTS idx_dicom_studies_study_instance
    ON dicom_studies (study_instance_uid);

CREATE INDEX IF NOT EXISTS idx_dicom_studies_dicom_patient
    ON dicom_studies (dicom_patient_id);

-- The inbox is always the newest unattributed rows, so index that ordering.
CREATE INDEX IF NOT EXISTS idx_dicom_studies_status_created
    ON dicom_studies (status, created_at DESC);
