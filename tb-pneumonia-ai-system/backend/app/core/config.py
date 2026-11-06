import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()

INSECURE_DEFAULT_SECRET = "your-secret-key-change-it-in-production"
# Deliberately credential-free: a default that embeds a username/password gets committed
# and then reused in production. This value exists only to be detected and rejected.
INSECURE_DEFAULT_DATABASE = "postgresql://localhost:5432/tb_pneumonia_db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "TB & Pneumonia AI System"
    DATABASE_URL: str = os.getenv("DATABASE_URL", INSECURE_DEFAULT_DATABASE)
    SECRET_KEY: str = os.getenv("SECRET_KEY", INSECURE_DEFAULT_SECRET)
    REGISTRATION_KEYS: str = os.getenv("REGISTRATION_KEYS", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # --- DICOM gateway (hospital X-ray machine -> this system) ---
    # The gateway runs as its own process (`python -m app.dicom_server`) so a
    # fault in the network listener cannot take down the HTTP API.
    DICOM_ENABLED: bool = False
    # This node's AE title. This is the value the modality/PACS is configured to
    # send to, and it must be unique on the hospital network.
    DICOM_LOCAL_AE_TITLE: str = "PULMOAI"
    # Interface the listener binds to. 0.0.0.0 is required to accept studies from
    # the machine rather than only from localhost.
    DICOM_BIND_ADDRESS: str = "0.0.0.0"
    DICOM_PORT: int = 11112
    # Comma-separated calling AE titles permitted to push studies. Empty means
    # "accept any AE title", which is only safe on a trusted isolated VLAN.
    DICOM_ALLOWED_REMOTE_AE_TITLES: str = ""
    # Comma-separated remote IPs/CIDRs permitted to connect. Empty means any.
    # Populate this for anything beyond a closed lab network.
    DICOM_ALLOWED_REMOTE_IPS: str = ""
    # Max concurrent inbound associations, to bound memory/CPU on a small host.
    DICOM_MAX_ASSOCIATIONS: int = 8
    # Max number of instances accepted per association (a study is often many
    # slices/subsets; this stops a runaway sender from filling the disk).
    DICOM_MAX_INSTANCES_PER_ASSOCIATION: int = 512
    # Hard ceiling on a single received instance, mirroring the web upload cap.
    DICOM_MAX_INSTANCE_BYTES: int = 10 * 1024 * 1024
    # Max SOP Class UIDs accepted. Defaults to the storage SOP classes a chest
    # radiography modality actually sends.
    DICOM_ACCEPTED_SOP_CLASSES: str = (
        "1.2.840.10008.5.1.4.1.1.1,1.2.840.10008.5.1.4.1.1.1.1,"
        "1.2.840.10008.5.1.4.1.1.1.1.1,1.2.840.10008.5.1.4.1.1.1.2,"
        "1.2.840.10008.5.1.4.1.1.1.2.1,1.2.840.10008.5.1.4.1.1.1.7,"
        "1.2.840.10008.5.1.4.1.1.1.7.1,1.2.840.10008.5.1.4.1.1.1.7.2,"
        "1.2.840.10008.5.1.4.1.1.1.99,1.2.840.10008.5.1.4.1.1.104.1"
    )
    # Skip classification when the CAD model is unavailable, keeping the study
    # queued for later rather than rejecting the send.
    DICOM_REJECT_NON_CXR: bool = True
    # Set False to accept studies and queue them without analysis (dry run).
    DICOM_ANALYSE_ON_INGEST: bool = True

    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore")

    # --- derived helpers -------------------------------------------------
    @property
    def dicom_allowed_remote_ae_titles(self) -> list[str]:
        return _split_csv(self.DICOM_ALLOWED_REMOTE_AE_TITLES)

    @property
    def dicom_allowed_remote_ips(self) -> list[str]:
        return _split_csv(self.DICOM_ALLOWED_REMOTE_IPS)

    @property
    def dicom_accepted_sop_class_uids(self) -> list[str]:
        return _split_csv(self.DICOM_ACCEPTED_SOP_CLASSES)


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in (raw or "").split(",") if item.strip()]


settings = Settings()

if settings.SECRET_KEY == INSECURE_DEFAULT_SECRET:
    raise RuntimeError(
        "SECRET_KEY is still the built-in development default. "
        "Set a strong random SECRET_KEY in your environment before starting the API."
    )

if settings.DATABASE_URL == INSECURE_DEFAULT_DATABASE:
    raise RuntimeError(
        "DATABASE_URL is still the built-in development default. "
        "Set DATABASE_URL (including credentials) in your environment before starting the API."
    )

if not settings.REGISTRATION_KEYS.strip():
    raise RuntimeError(
        "REGISTRATION_KEYS is empty. Set a comma-separated list of one-time doctor registration codes."
    )
