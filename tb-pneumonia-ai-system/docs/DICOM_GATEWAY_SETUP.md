# DICOM C-STORE Gateway — Setup and On-Site Verification

The hospital X-ray machine pushes chest radiographs to this system over the
DICOM **C-STORE** operation. The gateway receives each study, renders it with
the same DICOM conversion the manual upload path uses, and classifies it with
the **existing, unchanged** DenseNet-121 model. Studies arrive unattributed and
land in the **DICOM Inbox**, where a doctor attaches one to a patient.

## Status: simulator-verified, NOT yet tested on real hardware

Everything below has been exercised end-to-end against a pynetdicom SCU acting
as the machine (real socket, real presentation-context negotiation, real
C-STORE). It has **not** been connected to a physical X-ray machine, so:

- vendor-specific quirks (unannounced private SOP classes, implicit-VR
  behaviour, mandatory C-ECHO checks, TLS requirements) may still need changes;
- the AE title, IP and port below are placeholders, not real site values.

Complete the [On-site verification](#on-site-verification) section before going
live. Do not describe this integration as working with the real machine until
you have.

## Architecture

```
 X-ray machine ──DICOM C-STORE──▶ dicom-gateway process (:11112)
 (AE: see config)                     │  app/dicom_server.py
                                       ▼
                                      app/services/dicom_ingest.py
                                       │  retain .dcm → render .png
                                       │  → validate CXR → predict
                                       ▼
                                      PostgreSQL  ── dicom_studies (pending)
                                       │
 HTTP API (:8000) ◀── doctors review ─┘
   GET  /api/dicom/pending-studies
   POST /api/dicom/pending-studies/{id}/attach
```

The gateway is a **separate process** from the HTTP API so a fault in the
network listener cannot take the web application down, and so port 11112 can be
firewalled separately from port 8000.

## Configuration

All settings are environment variables read by `app/core/config.py`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DICOM_ENABLED` | `false` | Must be `true` or the gateway refuses to start |
| `DICOM_LOCAL_AE_TITLE` | `PULMOAI` | **This node's AE title.** Must be unique on the network |
| `DICOM_BIND_ADDRESS` | `0.0.0.0` | Use `0.0.0.0` to accept the machine; never expose publicly |
| `DICOM_PORT` | `11112` | Standard DICOM port |
| `DICOM_ALLOWED_REMOTE_AE_TITLES` | *(empty)* | Comma-separated calling AE titles. Empty = accept any |
| `DICOM_ALLOWED_REMOTE_IPS` | *(empty)* | Comma-separated IPs or CIDRs. Empty = accept any |
| `DICOM_MAX_ASSOCIATIONS` | `8` | Concurrent inbound associations |
| `DICOM_MAX_INSTANCES_PER_ASSOCIATION` | `512` | Caps a runaway sender |
| `DICOM_MAX_INSTANCE_BYTES` | `10485760` | 10 MB per instance |
| `DICOM_ACCEPTED_SOP_CLASSES` | CR/DX/SC list | Comma-separated SOP Class UIDs |
| `DICOM_REJECT_NON_CXR` | `true` | Flag studies that fail the chest-radiograph validator |
| `DICOM_ANALYSE_ON_INGEST` | `true` | `false` = receive and queue only (dry run) |
| `DICOM_LOG_LEVEL` | `INFO` | `DEBUG` for negotiation traces |
| `DICOM_LOG_FILE` | `logs/dicom_gateway.log` | Rotating audit log |

## Running it

### Locally

```bash
cd backend
pip install -r requirements.txt
export DICOM_ENABLED=true
export DICOM_LOCAL_AE_TITLE=PULMOAI
export DICOM_ALLOWED_REMOTE_AE_TITLES=XRAY01        # the machine's AE title
export DICOM_ALLOWED_REMOTE_IPS=192.168.1.50        # the machine's IP
python -m app.dicom_server
```

The API runs separately and unchanged:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
cd docker
export DICOM_ENABLED=true
export DICOM_LOCAL_AE_TITLE=PULMOAI
export DICOM_ALLOWED_REMOTE_AE_TITLES=XRAY01
export DICOM_ALLOWED_REMOTE_IPS=192.168.1.50
docker compose up -d --build
```

The `dicom-gateway` service shares the `uploads_data` volume with the API, so
the PNG and Grad-CAM overlay the gateway writes are served by the existing
authenticated `/api/media/radiology/{filename}` endpoint.

## Database

Apply `database/migrations/002_dicom_gateway.sql` (creates `dicom_studies` and
its indexes). On a fresh Docker volume the init scripts run automatically; on
an existing database run it by hand.

## Configuring the X-ray machine

On the modality or PACS, create a remote destination:

| Field | Value |
| --- | --- |
| Destination AE title | `DICOM_LOCAL_AE_TITLE` (e.g. `PULMOAI`) |
| Host / IP | IP of the machine running this service |
| Port | `DICOM_PORT` (default `11112`) |
| Connection | **Send** studies (C-STORE) |
| Scheduled nodes | `C-STORE` (optionally `C-ECHO` to verify reachability) |

The gateway advertises the Verification SOP class, so **C-ECHO works** for a
reachability test even though the user chose a C-STORE-only scope.

## Security

- **Never expose port 11112 to the internet.** DICOM has no built-in
  authentication. Bind it to a hospital VLAN or a host firewall rule.
- **Set both allowlists in production.** Empty allowlists accept any AE title
  from any IP, which would let any device on the reachable network push studies
  that appear in a doctor's inbox.
- **DICOM TLS is not implemented.** If the hospital network requires TLS, this
  gateway cannot satisfy it as written.
- **No PHI is logged.** The log records AE titles, IP addresses, SOP Instance
  UIDs and results. Patient name/ID are stored in the database for review but
  never written to the log.
- **The inbox is authenticated.** Every `/api/dicom/*` route requires a doctor
  or admin token, and only a doctor's own registered patients can be attached.
- **Media stays private.** Radiographs are served only through the authenticated
  media route, never from a public static mount.
- **Patient matching is manual and auditable.** DICOM `PatientID` is a
  modality-local value that does not map onto this system's phone/CNIC scheme,
  so a study cannot silently attach itself to the wrong patient.

## Behaviour on unusual input

| Situation | Result |
| --- | --- |
| Valid chest radiograph | Analysed; `status=analysed`; C-STORE returns Success |
| Not a chest radiograph | `status=rejected`, `rejection_reason=not_a_chest_xray`; C-STORE still returns Success |
| SOP class we do not analyse | `status=rejected`, `rejection_reason=unsupported_sop_class` |
| Model offline or `DICOM_ANALYSE_ON_INGEST=false` | `status=pending`; queued for later |
| Same SOP Instance UID re-sent | Ignored (unique constraint); the original row stands |
| Peer not in an allowlist | Association aborted (by design: `EVT_ESTABLISHED` is a notification event in pynetdicom 2.x, so a status return alone would be silently discarded); nothing stored |
| Unexpected internal failure | Recorded as `status=rejected`; transfer is **not** lost |

Data-quality rejections return **Success** on the wire on purpose: the
transport succeeded, and returning Failure would make the modality retry or
alarm for what is a clinical data issue rather than a transport failure.

## On-site verification

Work through this with the machine's vendor/IT before enabling the gateway for
real clinical use.

1. **Confirm the listener is up.**
   `docker compose logs -f dicom-gateway` should show
   `PulmoAI DICOM gateway starting` and the correct AE title and port.

2. **C-ECHO from the modality.** Use the vendor's "verify/test" tool or
   `storescu`-equivalent. A Success confirms IP, port and AE title are right.

3. **Send one test study** and confirm:
   - the gateway logs `C-STORE … -> analysed`;
   - a row appears in the DICOM Inbox in the web app with the expected
     patient label, result and confidence;
   - the radiograph and Grad-CAM heatmap render;
   - the `uploads/radiology` directory gained one `.dcm` and one `.png`.

4. **Check the SOP class actually sent.** If the study lands as
   `unsupported_sop_class`, add its UID to `DICOM_ACCEPTED_SOP_CLASSES`.

5. **Check transfer syntax.** Compressed syntaxes (JPEG/JPEG-LS/JPEG 2000) may
   need extra decoders (e.g. `pylibjpeg`, `gdcm`) for pixel decoding.

6. **Confirm the allowlist blocks strangers.** From another host on the network,
   a C-ECHO must be refused when its IP/AE is not allowlisted. The gateway aborts
   the refused association (see the behaviour table) rather than returning a
   DICOM status, because pynetdicom 2.x treats `EVT_ESTABLISHED` as a
   notification-only event whose result is discarded.

7. **Run the end-to-end smoke test** (starts the real `python -m app.dicom_server`
   process and drives it with an SCU over a socket, including the trained model):

```bash
cd backend
python tests/smoke_dicom_gateway.py
```

8. **Record what you verified** here, then remove this warning once the site
   test has genuinely passed:

```
Verified on: <date>
Machine: <make/model>
AE title: <title>
Transfer syntax: <uid>
Notes: <vendor quirks, extra decoders needed, TLS required?>
```

## Tests

```bash
cd backend
python -m pytest tests/test_dicom_gateway.py -q     # 17 gateway tests
python -m pytest tests/test_dicom_inbox_api.py -q  # 15 inbox API tests
python -m pytest tests/test_dicom_upload.py -q     # 33 DICOM conversion tests
```

`test_c_store_over_a_real_association` performs a real association over a
loopback socket with a pynetdicom SCU standing in for the machine.
`tests/smoke_dicom_gateway.py` goes further: it launches the actual gateway
process, sends a real radiograph over TCP, and asserts the study, prediction
and rendered image all land in the database with the original `.dcm` retained.
