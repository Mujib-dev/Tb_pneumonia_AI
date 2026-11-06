"""DICOM C-STORE gateway for the hospital X-ray machine.

Runs as its own process so a fault in the network listener cannot take down the
HTTP API:

    python -m app.dicom_server

Accepted studies are converted, validated and classified by the *existing*
trained model via `app.services.dicom_ingest`. Nothing about the model or its
preprocessing is changed here.

NOT VERIFIED AGAINST A REAL MODALITY. The listener is implemented to the DICOM
standard and is exercised end-to-end in the test suite with a pynetdicom SCU
standing in for the machine. It has not been connected to a physical X-ray
machine, so vendor-specific quirks (unannounced private SOP classes, implicit
VR quirks, TLS requirements) may still need adjustment on site.
"""
import ipaddress
import logging
import logging.handlers
import os
import sys
import threading

from pydicom.dataset import Dataset
from pynetdicom import AE, evt, build_context
from pynetdicom.sop_class import Verification

from app.core.config import settings
from app.db.database import SessionLocal

logger = logging.getLogger("app.dicom_server")

# Storage SOP classes are advertised via the context. Verification (C-ECHO) is
# included because most modalities probe it before attempting a transfer.
ACCEPTED_SOP_CLASSES = [
    "1.2.840.10008.5.1.4.1.1.1",      # Computed Radiography
    "1.2.840.10008.5.1.4.1.1.1.1",    # Digital X-Ray For Presentation
    "1.2.840.10008.5.1.4.1.1.1.1.1",  # Digital X-Ray For Processing
    "1.2.840.10008.5.1.4.1.1.1.2",    # Digital Mammography X-Ray Presentation
    "1.2.840.10008.5.1.4.1.1.1.2.1",  # Digital Mammography X-Ray Processing
    "1.2.840.10008.5.1.4.1.1.1.7",    # Secondary Capture
    "1.2.840.10008.5.1.4.1.1.1.7.1",  # Multiframe Single Bit Secondary Capture
    "1.2.840.10008.5.1.4.1.1.1.7.2",  # Multiframe Grayscale Byte Secondary Capture
    "1.2.840.10008.5.1.4.1.1.104.1",  # Encapsulated PDF
    "1.2.840.10008.1.1",              # Verification
]


def configure_logging() -> None:
    """Log to stdout and a rotating file, so a DICOM failure is auditable."""
    level = logging.DEBUG if os.getenv("DICOM_LOG_LEVEL", "INFO").upper() == "DEBUG" else logging.INFO
    root = logging.getLogger()
    root.setLevel(level)

    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    root.addHandler(stream)

    log_path = os.getenv("DICOM_LOG_FILE", "logs/dicom_gateway.log")
    try:
        os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
        rotating = logging.handlers.RotatingFileHandler(
            log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        rotating.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
        )
        root.addHandler(rotating)
    except OSError:
        # A read-only working directory must not stop the listener from running.
        logger.warning("Could not open DICOM log file %s", log_path, exc_info=True)


def remote_address(event) -> str:
    """Best-effort peer IP for an association event."""
    try:
        return str(event.assoc.requestor.address)
    except Exception:
        return "unknown"


def is_allowed_remote_ip(address: str) -> bool:
    """Enforce the optional remote IP allowlist.

    An empty allowlist means 'any', which is only acceptable on a trusted,
    isolated hospital VLAN. CIDR entries are supported.
    """
    allowed = settings.dicom_allowed_remote_ips
    if not allowed:
        return True
    try:
        peer = ipaddress.ip_address(address)
    except ValueError:
        logger.warning("DICOM peer address %r is not an IP; rejecting", address)
        return False
    for entry in allowed:
        try:
            if "/" in entry:
                if peer in ipaddress.ip_network(entry, strict=False):
                    return True
            elif peer == ipaddress.ip_address(entry):
                return True
        except ValueError:
            logger.warning("Ignoring malformed DICOM_ALLOWED_REMOTE_IPS entry %r", entry)
    logger.warning("DICOM peer %s is not in DICOM_ALLOWED_REMOTE_IPS; rejecting", address)
    return False


def is_allowed_ae_title(calling_ae_title: str) -> bool:
    """Enforce the optional calling AE title allowlist."""
    allowed = settings.dicom_allowed_remote_ae_titles
    if not allowed:
        return True
    if calling_ae_title in allowed:
        return True
    logger.warning(
        "DICOM calling AE title %r is not in DICOM_ALLOWED_REMOTE_AE_TITLES; rejecting",
        calling_ae_title,
    )
    return False


def build_ae() -> AE:
    """Construct the application entity with the configured identity."""
    ae = AE(ae_title=settings.DICOM_LOCAL_AE_TITLE)
    configured = settings.dicom_accepted_sop_class_uids or [c for c in ACCEPTED_SOP_CLASSES if c != Verification]

    for uid in configured:
        try:
            ae.add_supported_context(uid)
        except Exception:
            logger.warning("Could not advertise SOP class %s; skipping", uid)

    # Always answer C-ECHO so a modality can probe availability first.
    ae.add_supported_context(Verification)
    return ae


# pynetdicom 2.x has no server-side association/instance caps, so they are
# enforced here. C-STORE handlers run on a thread pool, hence the lock.
#
# The association object is stored as the dict *value* next to its instance
# count. Keying on `id()` alone would let CPython recycle an address for a new
# association while a stale entry survived, corrupting both caps.
_active_associations: dict[int, tuple[object, int]] = {}
_associations_lock = threading.Lock()


def _refuse(event, reason: str) -> None:
    """Tear down an association that must not be allowed to transfer.

    EVT_ESTABLISHED is a *notification* event, so pynetdicom discards the
    handler's return value and the accept has already been sent by the time this
    runs. Returning a status here would silently do nothing, so an untrusted
    peer has to be removed with an explicit abort. The C-STORE handler repeats
    every check below as the authoritative, actually-enforced guard; this exists
    so a rejected peer cannot hold a connection open at all.
    """
    logger.warning("Refusing association: %s", reason)
    try:
        event.assoc.abort()
    except Exception:
        logger.warning("Could not abort refused association", exc_info=True)


def _on_established(event):
    """Apply the allowlists and the association cap before any transfer.

    Checking here rather than only in the C-STORE handler means a disallowed
    peer never gets a usable association, which is what the DICOM standard
    expects and avoids handing a connection to a device that may not be trusted.
    """
    assoc = event.assoc
    peer_ip = remote_address(event)
    calling_ae = assoc.requestor.ae_title

    if not is_allowed_remote_ip(peer_ip):
        _refuse(event, f"address {peer_ip} is not in DICOM_ALLOWED_REMOTE_IPS")
        return

    if not is_allowed_ae_title(calling_ae):
        _refuse(event, f"AE title {calling_ae!r} is not in DICOM_ALLOWED_REMOTE_AE_TITLES")
        return

    with _associations_lock:
        over_capacity = len(_active_associations) >= settings.DICOM_MAX_ASSOCIATIONS
        if not over_capacity:
            _active_associations.setdefault(id(assoc), (assoc, 0))
        active = len(_active_associations)

    if over_capacity:
        _refuse(
            event,
            f"{active} associations already active (max DICOM_MAX_ASSOCIATIONS="
            f"{settings.DICOM_MAX_ASSOCIATIONS}) from {peer_ip}",
        )
        return

    logger.info("Association accepted from %s (AE %r); %d active", peer_ip, calling_ae, active)


def _on_released(event):
    with _associations_lock:
        _active_associations.pop(id(event.assoc), None)


def _on_aborted(event):
    with _associations_lock:
        _active_associations.pop(id(event.assoc), None)


def _record_instance(assoc) -> bool:
    """Count an instance against its association. False means the cap is hit."""
    with _associations_lock:
        key = id(assoc)
        existing = _active_associations.get(key)
        count = (existing[1] if existing else 0) + 1
        if count > settings.DICOM_MAX_INSTANCES_PER_ASSOCIATION:
            return False
        _active_associations[key] = (assoc, count)
    return True


def _decoded_size_bytes(dataset) -> int:
    """Approximate the decoded size of a dataset, for the per-instance cap.

    Encoded size cannot be measured after pynetdicom has decoded the message, so
    this sums element values. It is a guard against absurd inputs, not an exact
    wire-size check.
    """
    total = 0
    try:
        for element in dataset:
            value = element.value
            if isinstance(value, (bytes, bytearray, memoryview)):
                total += len(value)
            elif isinstance(value, str):
                total += len(value.encode("utf-8", "ignore"))
    except Exception:
        logger.warning("Could not size the received dataset", exc_info=True)
    return total


def handle_c_store(event):
    """Receive one instance, analyse it, and return the C-STORE status.

    Storage failures and analysis rejections both return SUCCESS on the wire:
    the transfer did complete, and the outcome is recorded in the review inbox.
    Returning FAILURE would make a modality retry or report an error for what is
    a data-quality issue, not a transport failure.
    """
    peer_ip = remote_address(event)

    if not is_allowed_remote_ip(peer_ip):
        logger.warning("Refusing C-STORE from disallowed address %s", peer_ip)
        return 0xA700  # Refused: out of resources

    calling_ae = event.assoc.requestor.ae_title
    if not is_allowed_ae_title(calling_ae):
        logger.warning("Refusing C-STORE from AE title %r", calling_ae)
        return 0xA700

    if not _record_instance(event.assoc):
        logger.warning(
            "Refusing C-STORE from AE %r: over DICOM_MAX_INSTANCES_PER_ASSOCIATION (%d)",
            calling_ae, settings.DICOM_MAX_INSTANCES_PER_ASSOCIATION,
        )
        return 0xA700

    try:
        dataset: Dataset = event.dataset
    except Exception:
        logger.exception("Could not decode the incoming dataset from %s", peer_ip)
        return 0xC000  # Cannot understand

    size = _decoded_size_bytes(dataset)
    if size > settings.DICOM_MAX_INSTANCE_BYTES:
        logger.warning(
            "Refusing SOP %s from AE %r: %.1f MB exceeds DICOM_MAX_INSTANCE_BYTES (%d bytes)",
            getattr(dataset, "SOPInstanceUID", "unknown"), calling_ae,
            size / 1_048_576, settings.DICOM_MAX_INSTANCE_BYTES,
        )
        return 0xA700

    sop_class = str(getattr(dataset, "SOPClassUID", "") or "unknown")
    sop_instance = str(getattr(dataset, "SOPInstanceUID", "") or "unknown")

    from app.services.dicom_ingest import ingest_dataset

    db = SessionLocal()
    try:
        summary = ingest_dataset(
            dataset,
            db,
            source_ae_title=calling_ae,
            source_ip=peer_ip,
            reject_non_cxr=settings.DICOM_REJECT_NON_CXR,
            analyse=settings.DICOM_ANALYSE_ON_INGEST,
        )
    except Exception:
        # ingest_dataset handles its own errors; anything reaching here would
        # otherwise kill the association mid-transfer.
        logger.exception("Unhandled error ingesting SOP %s from %s", sop_instance, peer_ip)
        summary = {"status": "rejected", "reason": "internal_error"}
    finally:
        db.close()

    logger.info(
        "C-STORE %s from AE %r (%s) -> %s",
        sop_instance, calling_ae, peer_ip,
        f"{summary.get('status')}:{summary.get('reason')}" if summary.get("reason") else summary.get("status"),
    )

    if summary.get("status") == "analysed":
        logger.info(
            "  study %s classified as %s (%.2f)", summary.get("study_id"),
            summary.get("result"), summary.get("confidence") or 0.0,
        )
    return 0x0000  # Success


def main() -> int:
    configure_logging()

    if not settings.DICOM_ENABLED:
        logger.error("DICOM_ENABLED is false. Set it to true before starting the gateway.")
        return 2

    logger.info("=" * 68)
    logger.info("PulmoAI DICOM gateway starting")
    logger.info("  Local AE title      : %s", settings.DICOM_LOCAL_AE_TITLE)
    logger.info("  Listening on        : %s:%s", settings.DICOM_BIND_ADDRESS, settings.DICOM_PORT)
    logger.info("  Remote AE allowlist : %s", settings.dicom_allowed_remote_ae_titles or "(any)")
    logger.info("  Remote IP allowlist : %s", settings.dicom_allowed_remote_ips or "(any)")
    logger.info("  Max associations    : %d", settings.DICOM_MAX_ASSOCIATIONS)
    logger.info("  Max instances/assoc : %d", settings.DICOM_MAX_INSTANCES_PER_ASSOCIATION)
    logger.info("  Max instance bytes  : %d", settings.DICOM_MAX_INSTANCE_BYTES)
    logger.info("  Reject non-CXR      : %s", settings.DICOM_REJECT_NON_CXR)
    logger.info("  Analyse on ingest   : %s", settings.DICOM_ANALYSE_ON_INGEST)
    logger.info(
        "  NOTE: verified against a DICOM simulator only; not yet tested on a physical X-ray machine."
    )
    logger.info("=" * 68)

    ae = build_ae()

    # An explicit `contexts` list replaces the AE's own supported contexts, so
    # the Verification SOP class has to be added back here or a modality's
    # C-ECHO reachability probe would be refused during negotiation.
    accepted = list(settings.dicom_accepted_sop_class_uids)
    if Verification not in accepted:
        accepted.append(Verification)
    contexts = [build_context(sop_class) for sop_class in accepted]

    handlers = [
        (evt.EVT_ESTABLISHED, _on_established),
        (evt.EVT_RELEASED, _on_released),
        (evt.EVT_ABORTED, _on_aborted),
        (evt.EVT_C_STORE, handle_c_store),
    ]

    try:
        ae.start_server(
            (settings.DICOM_BIND_ADDRESS, settings.DICOM_PORT),
            block=True,
            evt_handlers=handlers,
            contexts=contexts or None,
            ae_title=settings.DICOM_LOCAL_AE_TITLE,
        )
    except OSError as exc:
        logger.error("Could not bind %s:%s - %s", settings.DICOM_BIND_ADDRESS, settings.DICOM_PORT, exc)
        return 1
    except KeyboardInterrupt:
        logger.info("DICOM gateway shutting down")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
