-- Migration 001: appointment token integrity
-- Adds the positive-token check and the per-doctor/per-day uniqueness rule that
-- the ORM models already declare. Safe to run more than once.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_appointment_token_positive'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT ck_appointment_token_positive CHECK (token_number > 0);
    END IF;
END
$$;

DELETE FROM appointments a
USING appointments b
WHERE a.id > b.id
  AND a.doctor_id = b.doctor_id
  AND a.booking_date = b.booking_date
  AND a.token_number = b.token_number;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_appointment_doctor_date_token'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT uq_appointment_doctor_date_token
            UNIQUE (doctor_id, booking_date, token_number);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'status'
    ) THEN
        ALTER TABLE appointments
            ADD COLUMN status VARCHAR DEFAULT 'pending';
    END IF;
END
$$;

UPDATE appointments SET status = 'pending' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
    ON appointments (doctor_id, booking_date);
