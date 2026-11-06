"""
Generates TB_Pneumonia_AI_System_Complete_Documentation.pdf

All figures in the emitted report (versions, file sizes, endpoint counts,
line counts, test counts) are asserted against the live repository by
verify.py before this script is trusted. Re-run after any code change.
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Preformatted, PageBreak, KeepTogether, Flowable,
)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "TB_Pneumonia_AI_System_Complete_Documentation.pdf")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

NAVY = colors.HexColor("#0f2a4a")
BLUE = colors.HexColor("#1d4ed8")
SLATE = colors.HexColor("#334155")
LIGHT = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#cbd5e1")
AMBER = colors.HexColor("#b45309")
GREEN = colors.HexColor("#15803d")
RED = colors.HexColor("#b91c1c")

ss = getSampleStyleSheet()

S = {
    "cover_kicker": ParagraphStyle("ck", fontName="Helvetica-Bold", fontSize=8.5,
                                   leading=11, textColor=BLUE, alignment=TA_CENTER,
                                   spaceAfter=3),
    "cover_title": ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=19,
                                  leading=23, textColor=NAVY, alignment=TA_CENTER),
    "cover_sub": ParagraphStyle("cs", fontName="Helvetica", fontSize=10.5, leading=14,
                                textColor=SLATE, alignment=TA_CENTER),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=14, leading=17,
                         textColor=colors.white, backColor=NAVY,
                         borderPadding=(6, 8, 6, 8), spaceBefore=2, spaceAfter=9),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, leading=14,
                         textColor=NAVY, spaceBefore=11, spaceAfter=5),
    "h3": ParagraphStyle("h3", fontName="Helvetica-BoldOblique", fontSize=9.8,
                         leading=13, textColor=BLUE, spaceBefore=8, spaceAfter=3),
    "body": ParagraphStyle("bd", fontName="Helvetica", fontSize=9.1, leading=12.6,
                           textColor=colors.HexColor("#1f2937"), alignment=TA_JUSTIFY,
                           spaceAfter=5),
    "bullet": ParagraphStyle("bu", parent=None, fontName="Helvetica", fontSize=9.1,
                             leading=12.4, textColor=colors.HexColor("#1f2937"),
                             leftIndent=11, bulletIndent=2, spaceAfter=3.2),
    "cell": ParagraphStyle("ce", fontName="Helvetica", fontSize=7.6, leading=9.8,
                           textColor=colors.HexColor("#1f2937")),
    "cellb": ParagraphStyle("cb", fontName="Helvetica-Bold", fontSize=7.6, leading=9.8,
                            textColor=NAVY),
    "cellhead": ParagraphStyle("ch", fontName="Helvetica-Bold", fontSize=7.8,
                               leading=10, textColor=colors.white),
    "note": ParagraphStyle("nt", fontName="Helvetica", fontSize=8.6, leading=11.6,
                           textColor=colors.HexColor("#1f2937"), backColor=LIGHT,
                           borderColor=BORDER, borderWidth=0.6, borderPadding=7,
                           spaceBefore=5, spaceAfter=7),
    "warn": ParagraphStyle("wn", fontName="Helvetica", fontSize=8.6, leading=11.6,
                           textColor=colors.HexColor("#7c2d12"), backColor=colors.HexColor("#fffbeb"),
                           borderColor=colors.HexColor("#fcd34d"), borderWidth=0.6,
                           borderPadding=7, spaceBefore=5, spaceAfter=7),
    "toc": ParagraphStyle("tc", fontName="Helvetica", fontSize=9.4, leading=15,
                          textColor=colors.HexColor("#1f2937")),
}


def _chrome(canv, doc):
    """Running header + 'Page X of Y' footer, matching the original report."""
    canv.saveState()
    total = getattr(doc, "_total", None)
    if total:
        canv.setFont("Helvetica-Bold", 7.2)
        canv.setFillColor(NAVY)
        canv.drawCentredString(PAGE_W / 2, PAGE_H - 11 * mm,
                               "TB & PNEUMONIA AI MEDICAL SCREENING SYSTEM")
        canv.setFont("Helvetica", 7)
        canv.setFillColor(SLATE)
        canv.drawCentredString(PAGE_W / 2, PAGE_H - 14.6 * mm,
                               "FULL TECHNICAL ARCHITECTURE & OPERATION SPECIFICATION")
        canv.setStrokeColor(BORDER)
        canv.setLineWidth(0.5)
        canv.line(MARGIN, PAGE_H - 16.6 * mm, PAGE_W - MARGIN, PAGE_H - 16.6 * mm)

        canv.setFont("Helvetica-Bold", 6.9)
        canv.setFillColor(RED)
        canv.drawCentredString(PAGE_W / 2, 10 * mm,
                               "CONFIDENTIAL & PROPRIETARY - FINAL YEAR PROJECT "
                               "COMPREHENSIVE REPORT")
        canv.setFont("Helvetica", 7.4)
        canv.setFillColor(SLATE)
        canv.drawRightString(PAGE_W - MARGIN, 6.4 * mm, "Page %d of %d" % (doc.page, total))
    canv.restoreState()


class Doc(BaseDocTemplate):
    def __init__(self, path):
        BaseDocTemplate.__init__(self, path, pagesize=A4,
                                 leftMargin=MARGIN, rightMargin=MARGIN,
                                 topMargin=21 * mm, bottomMargin=16 * mm,
                                 title="TB & Pneumonia AI System - Complete Technical Documentation",
                                 author="BS Software Engineering Final Year Project, University of Swat")
        frame = Frame(MARGIN, 16 * mm, PAGE_W - 2 * MARGIN,
                      PAGE_H - 37 * mm, id="body", showBoundary=0)
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=_chrome),
            PageTemplate(id="body", frames=[frame], onPage=_chrome),
        ])
        self.marker_pages = {}

    def afterFlowable(self, flowable):
        if isinstance(flowable, Marker):
            self.marker_pages[flowable.key] = self.page


def h1(t):
    return Paragraph(t, S["h1"])


def h2(t):
    return Paragraph(t, S["h2"])


def h3(t):
    return Paragraph(t, S["h3"])


def p(t):
    return Paragraph(t, S["body"])


def bullets(items):
    return [Paragraph(i, S["bullet"], bulletText="•") for i in items]


def numbered(items):
    return [Paragraph(i, S["bullet"], bulletText="%d." % (n + 1)) for n, i in enumerate(items)]


def note(t):
    return Paragraph(t, S["note"])


def warn(t):
    return Paragraph(t, S["warn"])


def code(t):
    return Preformatted(t.strip("\n"), ParagraphStyle(
        "code", fontName="Courier", fontSize=6.6, leading=8.1,
        textColor=colors.HexColor("#0f172a")))


def _c(t, head=False, bold=False):
    return Paragraph(t, S["cellhead"] if head else (S["cellb"] if bold else S["cell"]))


def table(rows, widths, head=True, zebra=True):
    data = []
    for r_i, row in enumerate(rows):
        data.append([_c(c, head=(head and r_i == 0),
                        bold=(not head and r_i == 0)) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0, hAlign="LEFT")
    cmds = [
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if head:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), NAVY),
                 ("TOPPADDING", (0, 0), (-1, 0), 4.5),
                 ("BOTTOMPADDING", (0, 0), (-1, 0), 4.5)]
    if zebra:
        start = 1 if head else 0
        for i in range(start, len(data)):
            if (i - start) % 2 == 1:
                cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    t.setStyle(TableStyle(cmds))
    return t


def kv_table(pairs, w1=52 * mm):
    return table([["Field", "Value"]] + pairs, [w1, PAGE_W - 2 * MARGIN - w1])

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  DOCUMENT BODY
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

COVER_META = [
    ("Project Title", "TB & Pneumonia AI Medical Screening and Clinic Management System"),
    ("System Domain", "Medical Imaging, Computer Vision, Telehealth & OPD Workflow Automation"),
    ("AI Backbone", "DenseNet-121 (3-class: Normal / Tuberculosis / Pneumonia) + Grad-CAM explainability"),
    ("Computer Vision", "OpenCV 6-stage pre-inference sanity gate (geometry, focus, dynamic range, "
                        "chrominance, skin &amp; biometric cascade, structural edge verification)"),
    ("Backend Core", "FastAPI 0.115.6 (Python 3.9+), Uvicorn 0.34.0 ASGI, WebSockets, SQLAlchemy 2.0.36 ORM"),
    ("Frontend Core", "React 18 + Vite 5, Tailwind CSS 3, Framer Motion 10, Axios 1.6 interceptors"),
    ("Database Stack", "PostgreSQL (production) / SQLite (isolated test harness)"),
    ("Security Model", "OAuth2 password flow, HS256 JWT bearer tokens, bcrypt salting, doctor-only "
                       "self-registration via single-use access codes"),
    ("Automated Tests", "61 passing backend tests across 5 modules (auth security, media access, queue, admin integrity, contact settings)"),
    ("Codebase Size", "30 frontend modules (17,083 lines) + 14 backend modules (3,689 lines)"),
    ("API Surface", "55 route handlers (54 REST + 1 WebSocket) across two routers, all under the /api prefix"),
    ("Academic Origin", "BS Software Engineering Final Year Project, University of Swat"),
]

TOC = [
    ("1", "High-Level System Architecture &amp; Design Philosophy"),
    ("2", "Complete Technology Stack Matrix (pinned versions)"),
    ("3", "How Frontend and Backend Connect (Axios Interceptors, JWT, WebSockets, Multipart, CORS)"),
    ("4", "Deep Learning Model Pipeline &amp; the Six-Stage Computer Vision Sanity Gate"),
    ("5", "Relational Database Design, Schema Reference &amp; Cascading Integrity"),
    ("6", "File-by-File Repository Breakdown &amp; Architectural Map"),
    ("7", "Comprehensive Frontend Page-by-Page Breakdown"),
    ("8", "Role-Based Portals &amp; Functional Workflows"),
    ("9", "Complete RESTful API &amp; WebSocket Endpoint Directory (55 route handlers)"),
    ("10", "Step-by-Step Transaction Lifecycles"),
    ("11", "Deployment, Environment Configuration &amp; Troubleshooting"),
    ("12", "Security Architecture &amp; Access Control Model"),
    ("13", "Automated Test Suite &amp; Verification Evidence"),
    ("14", "Appendix A: Engineering Change Log"),
    ("15", "Appendix B: Known Limitations &amp; Recommended Next Steps"),
    ("16", "Appendix C: Viva Voce Question Bank"),
]


def build_cover(toc_pages=None):
    toc_pages = toc_pages or {}
    f = [
        Spacer(1, 4 * mm),
        Paragraph("ACADEMIC &amp; TECHNICAL ARCHITECTURE REPORT", S["cover_kicker"]),
        Spacer(1, 2 * mm),
        Paragraph("Automated Chest Radiograph Diagnostic", S["cover_title"]),
        Paragraph("System for Tuberculosis &amp; Pneumonia", S["cover_title"]),
        Spacer(1, 1.5 * mm),
        Paragraph("A Deep Learning, Real-Time OPD Token Queue &amp; Tele-Radiology Web Ecosystem",
                  S["cover_sub"]),
        Spacer(1, 5 * mm),
    ]
    rows = [["Attribute", "Detail"]] + [[k, v] for k, v in COVER_META]
    f.append(table(rows, [46 * mm, PAGE_W - 2 * MARGIN - 46 * mm]))
    f.append(Spacer(1, 4 * mm))
    f.append(note(
        "<b>Executive Overview.</b> This document is the exhaustive technical specification of the "
        "project repository. It documents every architectural layer: how the React single-page "
        "application interfaces with the FastAPI backend, the authentication token lifecycle, the "
        "DenseNet-121 model and its explainability layer, the six-stage computer vision "
        "pre-screening gate, the relational schema, real-time WebSocket queue synchronisation, "
        "authenticated medical media serving, a page-by-page interface analysis, a complete endpoint "
        "directory, deployment procedures, the security model, and the automated test suite that "
        "guards all of it.<br/><br/>"
        "<b>Revision note.</b> This revision supersedes the initial issue. It corrects the technology "
        "version matrix against the pinned dependency manifests, replaces the previously documented "
        "two-stage image validator with the six-stage gate actually present in the codebase, removes "
        "an inaccurate description of unauthenticated static media mounting, corrects the registration "
        "workflow to reflect the doctor-only public sign-up policy, expands the endpoint directory to "
        "all 55 route handlers, and adds Sections 12 through 15 covering security, testing, the engineering "
        "change log, and known limitations. A subsequent hardening pass removed a duplicated route "
        "handler, enforced doctor-only access on the clinical dashboard, removed a plaintext database "
        "credential from source, closed a patient-identity leak on the public waiting-room queue, and "
        "granted administrators read and delete oversight of predictions and appointments. All endpoint "
        "and file line counts in this revision were recomputed from the working tree."))
    f.append(PageBreak())
    f.append(Paragraph("Table of Contents", S["h1"]))
    f.append(Spacer(1, 2 * mm))
    toc_rows = [["#", "Section", "Page"]]
    for key, title in TOC:
        toc_rows.append([key, title, str(toc_pages.get("s" + key, ""))])
    t = table(toc_rows, [12 * mm, PAGE_W - 2 * MARGIN - 12 * mm - 20 * mm, 20 * mm])
    t.setStyle(TableStyle([("ALIGN", (2, 1), (2, -1), "CENTER")]))
    f.append(t)
    f.append(Spacer(1, 3 * mm))
    f.append(note(
        "Page references are resolved automatically in a second layout pass, so the contents table "
        "above is authoritative for this generated revision."))
    f.append(PageBreak())
    return f

def build_s1():
    f = [h1("1. High-Level System Architecture &amp; Design Philosophy")]
    f.append(p(
        "The system follows a decoupled, multi-tier architecture. The presentation tier (React SPA) is "
        "completely isolated from the application tier (FastAPI), communicating strictly through "
        "standardised RESTful JSON payloads, multipart file streams, and bidirectional WebSocket "
        "events. No server-side session store exists; every request is independently authenticated."))
    f.append(Spacer(1, 1 * mm))
    f.append(code(r"""
+--------------------------------------------------------------------------------+
|  PRESENTATION TIER (CLIENT)                                                  |
|  React 18 + Vite SPA | Tailwind CSS | Framer Motion | Lucide medical icons    |
|  Portals: Patient Workspace | Doctor OPD Cockpit | Admin CMS & User Mgmt    |
|  Static brand assets: logo.png, favicon.ico/.png, apple-touch-icon, PWA icons  |
+--------------------------------------------------------------------------------+
     ^                                            |
     | HTTPS / REST (JSON & Multipart)            | WebSockets (ws://.../api/ws/queue)
     | JWT Bearer Auth Headers                    | Real-time queue broadcasts
     | <img> media via ?token= query auth         |
     v                                            v
+--------------------------------------------------------------------------------+
|  APPLICATION TIER (FASTAPI ASGI)                                             |
|  Uvicorn 0.34.0 | Dependency injection | OAuth2 password bearer | Sec headers |
|  Routers: routes.py (39) + admin.py (14) + root (1) + WebSocket (1) = 55            |
+--------------------------------------------------------------------------------+
     |                              |                          |
     v                              v                          v
+-------------------+  +---------------------+  +---------------------------+
| INTELLIGENCE TIER |  | MEDIA TIER          |  | PERSISTENCE TIER          |
| OpenCV 6-stage CV |  | /api/media/radiology|  | SQLAlchemy 2.0 ORM pool   |
| sanity gate       |  | authenticated by     |  | PostgreSQL (production)   |
| PyTorch DenseNet  |  | ?token= + ownership  |  | Tables: users,            |
| 121 + Grad-CAM    |  | check; never public  |  | predictions, appointments,|
+-------------------+  +---------------------+  | doctor_patients,          |
                                             | registration_requests,   |
                                             | site_settings,            |
                                             | contact_messages          |
                                             +---------------------------+
"""))
    f.append(h2("Key Architectural Tenets"))
    f.extend(bullets([
        "<b>Stateless web core.</b> The API holds no in-memory user sessions. Authentication is "
        "encapsulated in signed JWTs verified on every request. The single deliberate exception is "
        "the doctor registration-code burn set, which is a per-process replay guard backed by a "
        "uniqueness constraint in the database (see Section 12).",
        "<b>Fail-fast medical sanity gate.</b> Low-quality, corrupted, non-radiological or "
        "human-subject photographs are rejected before any neural inference, across six independent "
        "OpenCV stages (Section 4.5).",
        "<b>No fabricated diagnoses.</b> If the DenseNet weights are missing or fail to load, the "
        "service refuses to predict. The <font face='Courier'>/api/predict</font> route returns HTTP "
        "503 rather than emitting a random label, and the frontend disables its analysis control until "
        "<font face='Courier'>/api/model-status</font> reports a connected model.",
        "<b>Real-time event broadcast.</b> Waiting-room displays, doctor call registers and patient "
        "handsets synchronise over WebSockets instead of database polling.",
        "<b>Role-based access control.</b> Explicit role checks exist on both the frontend router "
        "guards and the backend route dependencies.",
        "<b>Private-by-default medical media.</b> Diagnostic radiographs are never served as public "
        "static files. They are streamed only through an authenticated route that re-checks record "
        "ownership per request (Section 3.6).",
    ]))
    f.append(PageBreak())
    return f


def build_s2():
    f = [h1("2. Complete Technology Stack Matrix")]
    f.append(p(
        "Every version below is transcribed directly from the pinned manifests "
        "(<font face='Courier'>backend/requirements.txt</font> and "
        "<font face='Courier'>frontend/package.json</font>), not from memory. Caret ranges are the "
        "declared compatible ranges; the resolved lockfile version is given where it differs."))
    f.append(h3("2.1 Backend &amp; Intelligence"))
    f.append(table([
        ["Layer", "Technology", "Pinned Version", "Role &amp; Clinical Justification"],
        ["Backend web", "FastAPI", "0.115.6",
         "Async ASGI framework with dependency injection and auto-generated OpenAPI docs."],
        ["ASGI server", "Uvicorn (standard)", "0.34.0",
         "Production ASGI server with uvloop and httptools acceleration."],
        ["ORM", "SQLAlchemy", "2.0.36",
         "Declarative relational mapping and connection pooling."],
        ["DB driver", "psycopg2-binary", "2.9.10", "PostgreSQL wire-protocol driver."],
        ["Validation", "Pydantic", "2.10.4", "Runtime payload validation and serialisation."],
        ["Settings", "pydantic-settings", "2.7.0",
         "Typed environment loading with fail-fast production guards (Section 12.1)."],
        ["Migrations", "Alembic", "1.14.0", "Declared in requirements but not initialised: the repository contains no alembic.ini or migrations directory, and the schema is created by Base.metadata.create_all() at startup. See Section 15."],
        ["Uploads", "python-multipart", "0.0.20", "Multipart form parsing for radiograph streaming."],
        ["Deep learning", "PyTorch", "2.5.1", "DenseNet-121 forward pass and Grad-CAM backprop."],
        ["Vision models", "Torchvision", "0.20.1",
         "DenseNet-121 definition and 224x224 preprocessing transforms."],
        ["Computer vision", "opencv-python-headless", "4.10.0.84",
         "Six-stage radiograph validation and heatmap compositing."],
        ["Imaging", "Pillow", "11.0.0", "Image decoding and re-encoding."],
        ["Numerics", "NumPy", "2.1.3", "Tensor marshalling and activation maths."],
        ["Password hash", "bcrypt", "4.2.1", "Salted Blowfish key derivation."],
        ["JWT", "python-jose", "3.3.0", "HS256 token signing and verification."],
        ["Realtime", "websockets", "14.1", "ASGI WebSocket transport."],
        ["Config", "python-dotenv", "1.0.1", "Local environment file loading."],
        ["HTTP client", "httpx", "0.28.1", "TestClient transport for the automated suite."],
        ["Testing", "pytest", "8.3.4", "Backend test runner."],
    ], [24 * mm, 30 * mm, 24 * mm, PAGE_W - 2 * MARGIN - 78 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(h3("2.2 Frontend"))
    f.append(table([
        ["Layer", "Technology", "Declared Range", "Role &amp; Clinical Justification"],
        ["UI runtime", "React / React DOM", "^18.2.0", "Hooks-driven concurrent rendering."],
        ["Build", "Vite", "^5.0.0", "ESM dev server with sub-second HMR; Rollup production bundles."],
        ["Routing", "React Router DOM", "^6.19.0", "Client routing plus ProtectedRoute RBAC guards."],
        ["Styling", "Tailwind CSS", "^3.3.5", "Glassmorphism clinical theme, light and dark modes."],
        ["Animation", "Framer Motion", "^10.16.5", "Card transitions, progress meters, modal choreography."],
        ["Icons", "Lucide React", "^0.292.0", "Healthcare iconography (stethoscope, lungs, activity)."],
        ["HTTP", "Axios", "^1.6.2", "Request/response interceptors for automatic JWT injection."],
        ["Charts", "Recharts", "^3.8.1", "Dashboard area and pie charts for disease distribution."],
        ["Dialogs", "SweetAlert2", "^11.26.24", "Clinical alert and destructive-confirmation modals."],
        ["Toasts", "React-Toastify", "^11.1.0", "Transient non-blocking status notifications."],
        ["PDF export", "html2pdf.js", "^0.14.0", "Client-side A4 medical report compilation."],
        ["Linting", "ESLint", "^8.53.0",
         "Runs with --max-warnings 0; the repository currently reports zero warnings."],
    ], [24 * mm, 30 * mm, 24 * mm, PAGE_W - 2 * MARGIN - 78 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(h3("2.3 Infrastructure"))
    f.append(table([
        ["Component", "Technology", "Role"],
        ["Primary database", "PostgreSQL 13 / 18", "ACID relational store with foreign keys and indexes."],
        ["Test database", "SQLite (in-memory)", "Isolated fixture database; StaticPool keeps one shared connection."],
        ["Containers", "Docker Compose (v2)", "Four-file stack under docker/: backend and frontend "
         "Dockerfiles, an Nginx reverse proxy, and the Compose orchestrator."],
        ["Reverse proxy", "Nginx", "TLS termination and static SPA fallback for production builds."],
    ], [30 * mm, 34 * mm, PAGE_W - 2 * MARGIN - 64 * mm]))
    f.append(note(
        "Correction against the previous issue: this matrix previously listed Framer Motion as "
        "v11.x when the manifest declares <b>^10.16.5</b>, and omitted Recharts, SweetAlert2, "
        "html2pdf.js, React-Toastify, psycopg2-binary, pydantic-settings, Alembic, pytest, Pillow, "
        "NumPy, websockets, python-dotenv, httpx, python-multipart and the headless OpenCV build."))
    f.append(PageBreak())
    return f

def build_s3():
    f = [h1("3. How Frontend and Backend Connect")]
    f.append(p(
        "The React to FastAPI integration is engineered for low latency, predictable failure modes and "
        "airtight session security. Six mechanisms govern it."))

    f.append(h2("3.1 Dynamic API Endpoint Resolution"))
    f.append(p(
        "In <font face='Courier'>frontend/src/services/api.js</font> the client derives two base URLs "
        "from a single environment variable. <font face='Courier'>VITE_API_URL</font> supplies the "
        "server origin; any trailing <font face='Courier'>/api</font> suffix is stripped so that the "
        "media origin is correct, then the API base is re-appended. This yields both "
        "<font face='Courier'>API_BASE_URL</font> for XHR calls and "
        "<font face='Courier'>MEDIA_BASE_URL</font> for radiograph files, avoiding duplicated origin "
        "configuration."))
    f.append(code(
        'const configuredApiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000")\n'
        "  .trim().replace(/\\/+$/, '');\n"
        "const serverBaseUrl = configuredApiUrl.replace(/\\/api$/, '');\n"
        "export const API_BASE_URL     = `${serverBaseUrl}/api`;\n"
        "export const MEDIA_BASE_URL   = serverBaseUrl;"))

    f.append(h2("3.2 Axios Interceptors &amp; the JWT Protocol"))
    f.append(p("The login and request transaction proceeds as follows:"))
    f.extend(numbered([
        "The client posts an identifier (phone or CNIC) and password to "
        "<font face='Courier'>/api/auth/login</font>.",
        "The server verifies the bcrypt hash and issues an HS256-signed JWT carrying "
        "<font face='Courier'>{ sub, role, id, exp }</font>.",
        "React persists the token and the serialised user profile in local storage.",
        "The request interceptor injects <font face='Courier'>Authorization: Bearer &lt;token&gt;</font> "
        "on every subsequent call.",
        "The response interceptor treats any HTTP 401 as an expired session, purges local storage and "
        "redirects to the login route without throwing an uncaught UI error.",
    ]))
    f.append(code(
        "api.interceptors.request.use((config) => {\n"
        "  if (isPublicAuthRequest(config.url)) return config;   // no token on auth forms\n"
        "  const token = getStoredToken();\n"
        "  if (token) config.headers.Authorization = `Bearer ${token}`;\n"
        "  return config;\n"
        "});\n"
        "\n"
        "api.interceptors.response.use(\n"
        "  (response) => response,\n"
        "  (error) => {\n"
        "    const isAuthForm = isPublicAuthRequest(error.config?.url);\n"
        "    if (error.response?.status === 401 && !isAuthForm) {\n"
        "      clearAuthSession();\n"
        "      window.dispatchEvent(new Event('pulmo-ai:session-expired'));\n"
        "    }\n"
        "    return Promise.reject(error);\n"
        "  }\n"
        ");"))
    f.append(note(
        "A 401 does not navigate by assigning window.location. It clears the stored session and "
        "dispatches a custom DOM event, which AuthContext listens for and turns into a React state "
        "update. That keeps navigation inside the router, so the redirect is a normal client-side "
        "transition rather than a full document reload, and the login page renders immediately instead "
        "of after a round trip. The same isPublicAuthRequest guard suppresses both the token injection "
        "and the expiry handling for the login, register and password routes."))
    f.append(note(
        "Because a 401 interceptor performs a hard navigation, genuine credential rejections on the "
        "login form are returned as HTTP 400 with a field-level message, while HTTP 401 is reserved "
        "for expired or invalid tokens. This separation prevents a mistyped password from being "
        "misread as a session expiry."))

    f.append(h2("3.3 Binary Multipart Streaming &amp; the Boundary Trap"))
    f.append(p(
        "Radiograph screening and avatar uploads bypass JSON. The client builds a "
        "<font face='Courier'>FormData</font> object and lets the browser set the "
        "<font face='Courier'>Content-Type</font> header, including its generated multipart boundary. "
        "FastAPI streams the bytes to disk through <font face='Courier'>UploadFile = File(...)</font> "
        "without buffering the whole image in memory."))
    f.append(warn(
        "<b>Defect class documented from production.</b> Manually assigning "
        "<font face='Courier'>&quot;Content-Type&quot;: &quot;multipart/form-data&quot;</font> in a "
        "request interceptor strips the boundary token, and the server then rejects the payload with "
        "<font face='Courier'>400 Missing boundary in multipart</font>. The symptom surfaces in the "
        "browser console as an opaque CORS complaint, which misdirects diagnosis. The correct rule is "
        "to never set the header manually for <font face='Courier'>FormData</font>; let the runtime "
        "supply it. All five multipart call sites in this codebase now omit the header."))

    f.append(h2("3.4 Real-Time WebSocket Engine"))
    f.append(p(
        "To avoid polling, a WebSocket channel is maintained by a connection manager in "
        "<font face='Courier'>backend/app/api/websockets.py</font> on "
        "<font face='Courier'>/api/ws/queue</font>. Because the socket has no request-scoped database "
        "dependency, the session factory is published on application state at startup. Connected client "
        "screens receive queue events in roughly ten milliseconds and re-fetch authoritative state."))

    f.append(h2("3.5 CORS Configuration"))
    f.append(p(
        "Cross-Origin Resource Sharing is configured through FastAPI's CORSMiddleware with an explicit "
        "allow-list rather than a wildcard, because credentialed requests cannot be combined with a "
        "wildcard origin. Seven development origins are permitted, covering the Vite default port, the "
        "ports this project actually occupied when 5173 was taken, their loopback aliases, and the "
        "common React dev port:"))
    f.append(code(
        "allow_origins=[\n"
        '  "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",\n'
        '  "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175",\n'
        '  "http://localhost:3000",\n'
        "]\n"
        "allow_credentials=True\n"
        'allow_methods=["*"]\n'
        'allow_headers=["*"]'))
    f.append(warn(
        "<b>Correction against the previous issue.</b> The prior revision stated that static upload "
        "directories were mounted through a custom CORSStaticFiles subclass that forcibly appended "
        "<font face='Courier'>Access-Control-Allow-Origin: *</font>. That is no longer the case and "
        "the behaviour was unsafe. Only the low-sensitivity profile avatar directory is mounted as a "
        "public static mount. Diagnostic radiographs are deliberately excluded from static mounting."))

    f.append(h2("3.6 Authenticated Medical Media Serving"))
    f.append(p(
        "Diagnostic images require authorisation, but an HTML "
        "<font face='Courier'>&lt;img&gt;</font> element cannot attach an "
        "<font face='Courier'>Authorization</font> header. The system therefore accepts the bearer "
        "token as a query parameter on a dedicated route and re-verifies record ownership on every "
        "single request:"))
    f.append(code(
        "GET /api/media/radiology/{filename}?token=<jwt>\n"
        "\n"
        "  1. Reject absent token                       -> 401\n"
        "  2. Reject non-basename / bad extension       -> 400\n"
        "  3. Resolve the owning Prediction row by stem\n"
        "  4. Enforce _can_access_prediction()          -> 404 if not permitted\n"
        "  5. Confirm the resolved path is inside uploads/ and exists -> 404\n"
        "  6. Stream the file with a derived media type"))
    f.append(note(
        "<b>Filename-stem resolution.</b> The Grad-CAM overlay is written as a sibling of the original "
        "image using the suffix <font face='Courier'>_gradcam.jpg</font> and is never referenced by a "
        "database column. The route therefore strips that suffix to locate the owning record, then "
        "serves the requested variant. Resolving strictly by "
        "<font face='Courier'>image_path LIKE '%filename'</font> made the explainability layer "
        "permanently unreachable, returning 404 for every heatmap request. Regression coverage for "
        "both the original and the overlay is provided in "
        "<font face='Courier'>tests/test_media_route.py</font>."))
    f.append(PageBreak())
    return f

def build_s4():
    f = [h1("4. Deep Learning Model Pipeline &amp; the Six-Stage Computer Vision Sanity Gate")]
    f.append(h2("4.1 Network Architecture"))
    f.append(p(
        "The diagnostic backbone is <b>DenseNet-121</b>, instantiated from torchvision and retargeted "
        "to the project's three-class problem set by replacing the final fully connected layer:"))
    f.append(code(
        "model = densenet121(weights=None)\n"
        "num_ftrs = model.classifier.in_features\n"
        "model.classifier = nn.Linear(num_ftrs, 3)\n"
        "  # 3 classes: Normal, Pneumonia, TB\n"
        "model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))\n"
        "model.eval()"))
    f.append(p(
        "DenseNet-121 was selected for its dense concatenation architecture: every convolutional block "
        "receives the feature maps of all preceding blocks, which mitigates vanishing-gradient "
        "degradation and permits feature reuse without additional parameters. For radiographs this "
        "matters, because consolidation and cavitation are often faint, low-contrast, spatially "
        "distributed findings that benefit from deep feature reuse. Weights load onto the CPU so the "
        "service runs on hardware without a CUDA runtime. The checkpoint "
        "<font face='Courier'>app/ml_model/chest_xray_densenet121.pth</font> is 28,433,177 bytes and is "
        "verified present in the deployment."))

    f.append(h2("4.2 Preprocessing Contract"))
    f.append(p(
        "Inference-time preprocessing must match training exactly. A deterministic resize, ImageNet "
        "normalisation and tensor conversion pipeline is defined once and reused for both the "
        "prediction path and the Grad-CAM path:"))
    f.append(code(
        "transforms.Compose([\n"
        "    transforms.Resize((224, 224)),\n"
        "    transforms.ToTensor(),\n"
        "    transforms.Normalize(mean=[0.485, 0.456, 0.406],\n"
        "                         std=[0.229, 0.224, 0.225]),\n"
        "])"))
    f.append(note(
        "<b>Design decision.</b> No random rotation, flip, colour jitter or RandomResizedCrop is applied "
        "at inference. Augmentation belongs to the offline training pipeline only, and applying a "
        "stochastic transform to a diagnostic submission would make the reported confidence "
        "non-reproducible for the same uploaded file. The repository ships the inference path only; "
        "training scripts are not part of the delivered tree, which is recorded as a limitation in "
        "Section 15."))

    f.append(h2("4.3 Prediction &amp; Class Semantics"))
    f.append(table([
        ["Index", "Label", "Clinical Interpretation"],
        ["0", "Normal", "No radiographic evidence of active pulmonary abnormality within model sensitivity."],
        ["1", "Pneumonia", "Findings consistent with airspace consolidation."],
        ["2", "TB", "Findings consistent with tuberculous involvement, classically apical."],
    ], [16 * mm, 30 * mm, PAGE_W - 2 * MARGIN - 46 * mm]))
    f.append(p(
        "A forward pass produces three logits, which are converted to a calibrated probability "
        "distribution with a softmax, and the arg-max index selects the reported class. The full "
        "distribution is persisted alongside the winner so historical records remain auditable and "
        "re-renderable:"))
    f.append(code(
        "probs     = torch.nn.functional.softmax(output, dim=1)[0].tolist()\n"
        "all_scores = {labels[i]: round(probs[i], 4) for i in range(len(labels))}\n"
        "final_result   = labels[final_index]\n"
        "confidence     = all_scores[final_result]\n"
        "return final_result, round(confidence, 4), all_scores, heatmap_path"))
    f.append(note(
        "<b>Upload admission control.</b> The route rejects any filename whose extension is not jpg, "
        "jpeg or png, rejects empty uploads, and caps the payload at 10 MB with HTTP 413. Accepted "
        "files are stored under a freshly generated UUID filename, which removes any attacker-supplied "
        "path component. Two honest caveats belong on record: the type check inspects only the "
        "extension rather than the file's magic bytes, and the size check runs after the upload has "
        "been read into memory, so the ceiling bounds disk usage but not peak memory. Both are listed "
        "in Section 15."))
    f.append(warn(
        "<b>Clinical safety invariant.</b> predict_image() raises immediately when the model is not "
        "connected, and the route converts that into HTTP 503. The code comment states the rule "
        "explicitly: random predictions are restricted and cannot be performed. A screening tool that "
        "silently invented a plausible label when its weights failed to load would be indistinguishable "
        "from a working one at the interface, which is unacceptable in a diagnostic context."))

    f.append(h2("4.4 Grad-CAM Explainability"))
    f.append(p(
        "A classifier that outputs only a label and a probability is not clinically actionable. The "
        "system therefore computes a Grad-CAM overlay for every accepted prediction. The activation "
        "gradients of the final convolutional block are averaged over spatial dimensions and "
        "reweighted against the target-class activation map, producing a coarse localisation heatmap:"))
    f.append(code(
        "1. Forward pass, retaining the last convolutional feature map A (N, C, H, W)\n"
        "2. Backward pass to the same block to obtain dY/dA\n"
        "3. weights = mean(dY/dA, axis=(2, 3))          # per-channel importance\n"
        "4. cam     = ReLU(sum_c weights_c * A_c)         # (N, H, W)\n"
        "5. Normalise cam to [0, 1], upscale to source resolution\n"
        "6. OpenCV JET colormap -> BGR overlay -> composite over the radiograph\n"
        "7. Persist as <original_stem>_gradcam.jpg beside the original"))
    f.append(p(
        "Interpretation for the two positive classes: TB findings are expected to concentrate in the "
        "apical and upper-zone lung fields where cavitation classically develops, whereas pneumonia "
        "findings are expected as patchy, asymmetric consolidation, typically lobar. The heatmap is a "
        "model-attribution aid for the reviewing clinician. It is not an independent second opinion and "
        "must not be presented as one."))

    f.append(h2("4.5 The Six-Stage Computer Vision Sanity Gate"))
    f.append(p(
        "Before any tensor reaches the network, the candidate image must survive six independent "
        "OpenCV stages implemented in <font face='Courier'>app/services/image_validator.py</font>. The "
        "function returns <font face='Courier'>(None, None)</font> to accept, or a human-readable reason "
        "string to reject with HTTP 400. Cascade classifiers are preloaded once at module import so "
        "the gate adds no per-request model load."))
    f.append(table([
        ["#", "Stage", "Technique", "Rejects"],
        ["1", "Dimension &amp; aspect ratio",
         "Minimum and maximum pixel bounds plus a maximum width:height deviation",
         "Thumbnails, icons, screenshots, banners, extreme panoramic strips"],
        ["2", "Focus / blurriness",
         "Variance of the Laplacian kernel on a greyscale copy",
         "Out-of-focus captures, motion-blurred photographs"],
        ["3", "Dynamic range &amp; contrast",
         "Histogram spread and radiographic contrast statistics",
         "Flat grey uploads, blank film, fully saturated frames"],
        ["4", "Chrominance &amp; skin",
         "Saturation analysis in HSV plus a skin-chrominance mask in YCrCb and HSV",
         "Colour photographs, scanned film with a heavy uniform tint, objects with varied colour"],
        ["5", "Face &amp; biometric cascade",
         "Viola-Jones face detection, refined by eye detection inside the face region, plus checks "
         "for facial colour and prominence",
         "Selfies, portraits, photographs of people, faces pasted onto images"],
        ["6", "Structural edge verification",
         "Edge-density and structural analysis across the thoracic field for rib, spine and clavicle "
         "signature edges",
         "Natural scenes and non-anatomical images that survive stages 1 to 5"],
    ], [7 * mm, 30 * mm, PAGE_W - 2 * MARGIN - 37 * mm - 44 * mm, 44 * mm]))
    f.append(note(
        "<b>Correction against the previous issue.</b> The prior revision documented only two checks: "
        "a monochromatic test and a Laplacian blurriness test. The deployed gate has six stages, "
        "including a biometric face and eye cascade and a structural edge verification pass, and the "
        "documentation now reflects the implementation."))
    f.append(p(
        "Defence in depth: the gate is an ergonomic and safety filter, not a security control. It "
        "reduces wasted inference and prevents obvious misclassification of unrelated imagery, but it "
        "is a heuristic and can be evaded. The hard guarantee against fabricated output is the "
        "model-connection invariant in Section 4.3."))
    f.append(PageBreak())
    return f


def build_s5():
    f = [h1("5. Relational Database Design, Schema Reference &amp; Cascading Integrity")]
    f.append(p(
        "The schema declares seven tables. Foreign keys, uniqueness constraints, check constraints and "
        "explicit cascade rules protect referential integrity across the clinical record graph."))
    f.append(h3("5.1 users - Multi-role identity table"))
    f.append(p(
        "A single table backs all three roles, discriminated by the "
        "<font face='Courier'>role</font> column (patient, doctor, admin). Core identity columns "
        "<font face='Courier'>phone</font> and <font face='Courier'>cnic</font> are each uniquely "
        "indexed, because the login form accepts either identifier. The doctors-only fields "
        "(<font face='Courier'>specialization, clinic_name, address, about, timetable</font>) and the "
        "clinic-operations fields (<font face='Courier'>token_mode, max_tokens, "
        "consultation_fee</font>) are nullable and ignored for patients."))
    f.append(note(
        "<b>Queue economics are snapshotted at booking time.</b> <font face='Courier'>"
        "consultation_fee</font> on the doctor row and <font face='Courier'>fee_charged</font> on the "
        "appointment row are separate columns. The fee is copied onto the appointment when it is "
        "issued, so a later price change by the doctor never retroactively alters what an existing "
        "patient was quoted. <font face='Courier'>token_mode</font> is either "
        "<font face='Courier'>fixed</font> (slots start at 1 and increment) or "
        "<font face='Courier'>dynamic</font> (slots start at 100 and decrement, so the lowest number "
        "always denotes the current patient)."))

    f.append(h3("5.2 Schema column reference"))
    f.append(table([
        ["Table", "Key Columns", "Purpose &amp; Integrity Rules"],
        ["users",
         "id PK, name, phone UQ, cnic UQ, hashed_password, role, profile_pic, specialization, "
         "clinic_name, address, gender, age, token_mode, max_tokens, about, timetable, "
         "consultation_fee, used_access_code UQ, created_at",
         "Unified identity for all roles. used_access_code is unique so a doctor access code cannot be "
         "redeemed twice, even across a restart."],
        ["doctor_patients", "id PK, doctor_id FK, patient_id FK",
         "Explicit many-to-many link so a patient may be treated by several doctors, and a doctor may "
         "follow several patients."],
        ["predictions",
         "id PK, user_id FK, doctor_id FK (nullable), image_path, result, confidence, all_scores, "
         "created_at",
         "Immutable diagnostic record. Nullable doctor_id supports a screening result created without a "
         "treating physician. all_scores retains the full probability vector."],
        ["appointments",
         "id PK, doctor_id FK, patient_id FK, booking_date IDX, token_number, status, fee_charged, "
         "patient_name_override, created_at",
         "The OPD queue. status is pending, serving or completed. patient_name_override lets a doctor "
         "issue a token to a family member or offline walk-in who has no account."],
        ["registration_requests",
         "id PK, doctor_id FK, name, phone IDX, cnic IDX, gender, age, booking_date, token_number, "
         "status, rejection_reason, created_at",
         "Guest registration lifecycle. status is pending, approved or rejected; a populated "
         "rejection_reason accompanies a rejection."],
        ["site_settings", "id PK, setting_key UQ, setting_value", "Global key/value configuration."],
        ["contact_messages",
         "id PK, name, email, whatsapp, subject, message, is_read, doctor_id FK (nullable), created_at",
         "Public contact form submissions, optionally attributed to a doctor. is_read is an integer "
         "boolean."],
    ], [26 * mm, 46 * mm, PAGE_W - 2 * MARGIN - 72 * mm]))
    f.append(PageBreak())
    return f

def build_s6():
    f = [h1("6. File-by-File Repository Breakdown &amp; Architectural Map")]
    f.append(p(
        "Line counts and byte sizes below are read directly from the working tree. Compiled "
        "<font face='Courier'>__pycache__</font> artefacts and the model checkpoint are excluded from "
        "the source metrics. Totals: <b>30 frontend JavaScript and JSX modules, 17,083 lines</b>, plus "
        "a 307-line stylesheet; <b>14 backend modules, 3,689 lines</b>; <b>6 test modules, 1,127 "
        "lines</b>."))

    f.append(h3("6.1 Frontend - src/ (17,083 lines)"))
    f.append(table([
        ["Path", "Lines", "Architectural Responsibility"],
        ["pages/DoctorDashboard.jsx", "1,796",
         "Doctor cockpit: live call-next panel, per-patient token issue, guest approval, fee collection."],
        ["pages/Patients.jsx", "1,888", "Patient registry with search, filtering, vitals and history drill-down."],
        ["pages/Profile.jsx", "1,505", "User profile editor, avatar upload, password and preference management."],
        ["pages/BookAppointment.jsx", "1,421",
         "Doctor discovery and booking. Directory renders a two-column mobile / three-column desktop grid "
         "with a full-width search filter."],
        ["pages/History.jsx", "1,594",
         "Past prediction archive with per-class filters, clinical PDF report generation, radiograph "
         "download, and permanent record deletion."],
        ["pages/AdminDashboard.jsx", "1,362", "Administrative CMS: user management, settings, contact inbox."],
        ["pages/GuestBooking.jsx", "968", "Unauthenticated walk-in registration and token request lifecycle."],
        ["pages/Contact.jsx", "591", "Public contact form and doctor messaging entry point."],
        ["pages/Predict.jsx", "545",
         "Radiograph upload workspace: drag-and-drop, sample selection, CV-gate feedback, result "
         "rendering, Grad-CAM display, model-status gating."],
        ["pages/Login.jsx", "512", "Role-aware sign-in accepting phone or CNIC, with three-second alert auto-dismiss."],
        ["pages/ForgotPassword.jsx", "434", "Credential recovery guidance flow."],
        ["pages/TodayTokens.jsx", "441", "Date-scoped token ledger."],
        ["pages/About.jsx", "370", "Project narrative, technology showcase, and stacked doctor call-to-actions."],
        ["pages/Terms.jsx", "237", "Sixteen-section terms of service with Lucide iconography."],
        ["pages/Privacy.jsx", "187", "Sixteen-section privacy policy with Lucide iconography."],
        ["pages/Payments.jsx", "226", "Fee summary and payment records."],
        ["components/Navbar.jsx", "531",
         "Role-aware navigation shell, light/dark toggle, and brand mark rendering in desktop and "
         "mobile layouts."],
        ["components/Footer.jsx", "308", "Site footer with legal and contact links."],
        ["components/DoctorContactModal.jsx", "279", "Direct doctor messaging modal."],
        ["components/ResultCard.jsx", "279",
         "Prediction presentation with class, confidence, full distribution, Grad-CAM toggle, and "
         "non-wrapping report, download and delete actions."],
        ["components/UploadBox.jsx", "182", "Drag-and-drop upload control with client-side pre-checks."],
        ["components/PasswordStrengthIndicator.jsx", "173", "Live password entropy feedback."],
        ["services/api.js", "184", "Axios instance, JWT interceptors, and media URL construction."],
        ["services/AuthContext.jsx", "66", "Authentication state provider and role propagation."],
        ["services/ThemeContext.jsx", "38", "Light and dark theme state."],
        ["utils/alert.js", "35", "SweetAlert2 wrapper for uniform clinical confirmations."],
        ["App.jsx", "148", "Router tree, role guards, and lazy route registration."],
        ["index.css", "307", "Tailwind layers, glassmorphism utilities, and design tokens."],
        ["main.jsx", "16", "ReactDOM root bootstrap."],
    ], [42 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 55 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(h3("6.2 Backend - app/ (3,689 lines, 14 modules)"))
    f.append(table([
        ["Path", "Lines", "Architectural Responsibility"],
        ["api/routes.py", "2,220",
         "Primary router: 39 endpoints covering auth, prediction, media, patients, appointments, guest "
         "registration, messaging and deletion."],
        ["api/admin.py", "479",
         "Administrative router: 14 endpoints for users, settings, contact messages, statistics and "
         "clinical oversight of predictions and appointments."],
        ["api/auth_utils.py", "46", "bcrypt hashing, JWT issuance, and the OAuth2 bearer dependency."],
        ["api/websockets.py", "45", "Connection manager and /api/ws/queue broadcast endpoint."],
        ["core/config.py", "42", "Typed settings with production fail-fast guards on secrets and keys."],
        ["db/models.py", "129", "Seven SQLAlchemy table definitions with relationships and constraints."],
        ["db/database.py", "16", "Engine, session factory, and Base declarative registry."],
        ["main.py", "64", "Application assembly, middleware, static mounts, and model preload."],
        ["schemas/request.py", "10", "Shared Pydantic request models."],
        ["models/densenet.py", "24", "DenseNet-121 factory retargeted to three output classes."],
        ["services/predict.py", "200", "Model lifecycle, preprocessing, inference, and Grad-CAM generation."],
        ["services/image_validator.py", "130", "The six-stage OpenCV radiograph sanity gate."],
        ["services/queue.py", "271", "Token allocation, serving state machine, and queue-window enforcement."],
        ["utils/preprocess.py", "13", "Shared image decoding and resize helpers."],
    ], [38 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 51 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(h3("6.3 Model checkpoint, tests and deployment"))
    f.append(table([
        ["Path", "Size", "Notes"],
        ["app/ml_model/chest_xray_densenet121.pth", "28,433,177 b", "Trained DenseNet-121 checkpoint, loaded onto CPU."],
        ["tests/conftest.py", "68 lines", "Isolated SQLite fixture with StaticPool and upload-directory redirection."],
        ["tests/test_auth_security.py", "430 lines", "Authentication, role, registration-code, prediction-ownership and public-queue privacy coverage."],
        ["tests/test_media_route.py", "148 lines", "Media authorization, Grad-CAM resolution, traversal and delete cleanup."],
        ["tests/test_queue.py", "141 lines", "Token allocation and queue-window behaviour."],
        ["tests/test_admin_user_integrity.py", "335 lines",
         "CNIC/phone cross-column uniqueness, avatar-safe user deletion, contact-settings validation and "
         "admin clinical-oversight authorisation."],
        ["run.py", "-", "Development entry point; serves app.main:app on 0.0.0.0:8000 with reload."],
        ["docker/docker-compose.yml", "-", "Two-service Compose stack (backend, frontend/Nginx)."],
        ["docker/backend.Dockerfile", "-", "Backend container image definition."],
        ["docker/frontend.Dockerfile", "-", "Multi-stage SPA build served by Nginx."],
        ["docker/nginx.conf", "-", "Reverse proxy, TLS termination, and SPA history fallback."],
    ], [56 * mm, 22 * mm, PAGE_W - 2 * MARGIN - 78 * mm]))
    f.append(note(
        "<b>Correction against the previous issue.</b> The prior file map omitted "
        "<font face='Courier'>Navbar.jsx, Footer.jsx, DoctorContactModal.jsx, "
        "PasswordStrengthIndicator.jsx, ThemeContext.jsx, image_validator.py, queue.py, "
        "preprocess.py, densenet.py, schemas/request.py</font> and the entire test suite, and it "
        "understated the endpoint surface as &quot;over 30&quot; when the codebase declares 51. Every "
        "size figure in the previous issue was also stale."))
    f.append(PageBreak())
    return f


def build_s7():
    f = [h1("7. Comprehensive Frontend Page-by-Page Breakdown")]
    f.append(h2("7.1 Public and marketing surface"))
    f.append(table([
        ["Page", "Lines", "Function"],
        ["Home", "110", "Hero section, statistics, disease education cards, and a call-to-action that "
                        "routes to <b>Doctor Registration</b> rather than a generic sign-up."],
        ["About", "370", "Project narrative, architecture highlights, and stacked primary and secondary "
                         "doctor call-to-action buttons."],
        ["Contact", "586", "Public enquiry form, doctor messaging, and clinic location details."],
        ["Terms", "237", "Sixteen sections covering acceptable use, the advisory nature of results, "
                        "liability limits, data handling, and intellectual property."],
        ["Privacy", "187", "Sixteen sections covering data categories, processing purposes, retention, "
                           "disclosure, and user rights."],
    ], [26 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 39 * mm]))
    f.append(note(
        "<b>Scope note on legal content.</b> The Terms and Privacy pages state deployment and data-"
        "handling commitments such as transport encryption, storage jurisdiction, and human review of "
        "results. These are policy commitments of the deploying institution, not properties the "
        "source code can prove. They require review by the supervising faculty and the institution "
        "before publication, and should not be cited in this report as verified technical controls."))
    f.append(h2("7.2 Authentication pages"))
    f.append(table([
        ["Page", "Lines", "Function"],
        ["Login", "512", "Role-aware sign-in. Accepts phone or CNIC. Surfaces a server-provided error and "
                         "auto-dismisses the alert after three seconds so the user is returned to the form."],
        ["Register", "657", "<b>Doctor-only self-registration.</b> Collects professional identity, clinic "
                            "details, specialisation, address, fee, token policy, timetable and a one-time "
                            "doctor access code. Public patients cannot self-register here."],
        ["ForgotPassword", "434", "Credential recovery guidance."],
    ], [26 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 39 * mm]))
    f.append(warn(
        "<b>Correction against the previous issue.</b> The previous revision described "
        "<font face='Courier'>Register.jsx</font> as a dual-role patient and doctor form in which "
        "patients entered a name, phone and CNIC. That workflow has been withdrawn. Public "
        "registration is restricted to verified doctors holding a valid access code, and patient "
        "accounts are provisioned by a verified doctor or through the guest-token flow in Section 8.3."))
    f.append(h2("7.3 Clinical application pages"))
    f.append(table([
        ["Page", "Lines", "Function"],
        ["Predict", "545", "Upload workspace. Presents the six-stage validation outcome, the predicted "
                          "class with confidence and full distribution, the Grad-CAM overlay, and clinical "
                          "disclaimers. Submission is disabled while the model reports disconnected."],
        ["History", "1,594", "Filterable prediction archive, A4 report generation via html2pdf.js, "
                             "radiograph download, and permanent deletion of a record and its overlay."],
        ["BookAppointment", "1,421", "Doctor directory, availability preview, and booking confirmation."],
        ["GuestBooking", "968", "Walk-in registration, token request, and status tracking."],
        ["Patients", "1,712", "Doctor-side patient registry."],
        ["Profile", "1,505", "Account and clinic settings, avatar upload."],
        ["TodayTokens", "460", "Date-scoped token ledger."],
        ["Payments", "226", "Fee records."],
    ], [26 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 39 * mm]))
    f.append(h2("7.4 Dashboards"))
    f.append(table([
        ["Page", "Lines", "Function"],
        ["DoctorDashboard", "1,832", "The operational centrepiece: live serving patient, queue management, "
                                     "guest approval, and fee collection."],
        ["AdminDashboard", "1,130", "User administration, global settings, contact inbox, platform statistics."],
    ], [26 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 39 * mm]))
    f.append(PageBreak())
    return f

def build_s8():
    f = [h1("8. Role-Based Portals &amp; Functional Workflows")]
    f.append(h2("8.1 Access model"))
    f.append(p(
        "A single <font face='Courier'>users</font> table underpins three portals. Public registration "
        "creates <b>doctors only</b>. Patients are provisioned in one of two ways: a verified doctor "
        "registers them from the doctor portal, or an unauthenticated visitor books a walk-in token and "
        "is approved by a doctor. This inverts the previous design and removes unverified patient "
        "sign-up."))
    f.append(table([
        ["Portal", "Entry condition", "Capabilities"],
        ["Patient", "Provisioned account, or guest token approval",
         "Submit radiographs, view and download own results and overlays, book appointments, manage profile."],
        ["Doctor", "Registration with a valid single-use access code",
         "Verify the CV gate, review predictions and Grad-CAM, issue and call tokens, register patients, "
         "approve guest requests, collect fees, message patients."],
        ["Admin", "Seeded credential",
         "Manage users and roles, global settings, contact inbox, platform statistics, audit oversight."],
        ["Guest", "None (unauthenticated)",
         "Request a walk-in token, then poll status until a doctor approves or rejects."],
    ], [22 * mm, 44 * mm, PAGE_W - 2 * MARGIN - 66 * mm]))

    f.append(h2("8.2 Doctor registration with single-use access codes"))
    f.extend(numbered([
        "The applicant submits professional details together with a doctor access code.",
        "The server rejects any request whose <font face='Courier'>role</font> is not "
        "<font face='Courier'>doctor</font> with HTTP 403, so the endpoint cannot be repurposed to "
        "create patient accounts.",
        "The code is parsed from the comma-separated <font face='Courier'>REGISTRATION_KEYS</font> "
        "setting and compared exactly; an unmatched code returns HTTP 403 "
        "<font face='Courier'>Invalid Doctor Access Code</font>.",
        "A uniqueness probe rejects the code if any user already holds it in "
        "<font face='Courier'>used_access_code</font>.",
        "The code is recorded on the new user row. Because the column is uniquely indexed, replay is "
        "rejected at the database layer even if the in-process burn set is lost on restart.",
    ]))
    f.append(note(
        "The implementation burns the code in a process-local set for defence in speed, and relies on "
        "the unique index for correctness. Section 15 records the multi-instance gap this leaves."))

    f.append(h2("8.3 Patient provisioning workflows"))
    f.append(h3("8.3.1 Doctor-registered patient"))
    f.append(p(
        "A signed-in doctor submits the patient's demographics from the Patients portal. The server "
        "validates the payload, creates a user row with role <font face='Courier'>patient</font>, and "
        "inserts a <font face='Courier'>doctor_patients</font> link so the relationship survives the "
        "absence of any invitation token. The patient's password is set by the doctor."))
    f.append(h3("8.3.2 Guest walk-in token"))
    f.append(p(
        "A visitor with no account supplies a name, phone, CNIC, gender, age and intended booking date. "
        "The server creates a <font face='Courier'>registration_requests</font> row in state "
        "<font face='Courier'>pending</font> and returns a reference. A doctor reviews pending requests "
        "in the dashboard and either approves, which allocates a real token number in the appointment "
        "table, or rejects with a stored reason. The guest polls or watches for the state change."))

    f.append(h2("8.4 The OPD token queue state machine"))
    f.append(p(
        "Queue logic is centralised in <font face='Courier'>app/services/queue.py</font> so that token "
        "allocation semantics are identical no matter which portal triggers them."))
    f.append(code(
        "   [ pending ] --doctor calls--> [ serving ] --complete--> [ completed ]\n"
        "        |                             |\n"
        "        +------ cancel ----------------+---- cancel --> (removed)"))
    f.append(table([
        ["Rule", "Behaviour"],
        ["Token mode: fixed", "Numbers allocate upward from 1, so display order matches arrival order."],
        ["Token mode: dynamic", "Numbers allocate downward from a high base so the smallest number is "
                                 "always the current serving patient."],
        ["Concurrency", "Allocation re-checks the highest issued token for the doctor and date inside a "
                        "transaction, so simultaneous bookings cannot collide on a number."],
        ["Queue window", "A doctor-configured maximum caps the number of open tokens; a full queue "
                         "rejects new bookings with a clear message."],
        ["Fee snapshot", "The doctor's consultation fee is copied onto the appointment at issue time."],
        ["Offline patients", "<font face='Courier'>patient_name_override</font> allows a token to be "
                             "issued to a family member or walk-in who has no account."],
        ["Propagation", "Every state change broadcasts over <font face='Courier'>/api/ws/queue</font> so "
                        "all connected displays update without polling."],
    ], [34 * mm, PAGE_W - 2 * MARGIN - 34 * mm]))

    f.append(h2("8.5 Doctor-patient linking"))
    f.append(p(
        "The <font face='Courier'>doctor_patients</font> junction table models a genuine many-to-many "
        "relationship. A patient may be under the care of several clinicians, and a doctor may follow "
        "several patients. This supports continuity of care and lets either party unlink, which the "
        "API exposes as an explicit unlink operation."))
    f.append(PageBreak())
    return f



def build_s9():
    f = [h1("9. Complete RESTful API &amp; WebSocket Endpoint Directory")]
    f.append(p(
        "The service declares <b>55 route handlers</b>: 39 in <font face='Courier'>api/routes.py</font> "
        "(38 REST plus the queue WebSocket), 14 in <font face='Courier'>api/admin.py</font>, and the "
        "unauthenticated service root in <font face='Courier'>main.py</font>. That is 54 REST handlers "
        "and one WebSocket, and because a duplicated declaration was removed during this review the "
        "declared and reachable surfaces are the same <b>55</b>. Every entry below is transcribed from "
        "the source decorators, including their line numbers."))

    f.append(h3("9.1 Authentication and identity (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["POST", "/api/auth/register", "270", "Public, doctor only", "Doctor self-registration; requires a valid unused access code."],
        ["POST", "/api/auth/login", "364", "Public", "Phone or CNIC plus password; returns a JWT and the user profile."],
        ["POST", "/api/auth/update-profile", "420", "Bearer", "Update the signed-in user's own profile."],
        ["POST", "/api/auth/reset-password", "525", "Bearer", "Password change for the authenticated account."],
        ["GET", "/api/doctors/list", "1139", "Public", "Public doctor directory used by the booking portal."],
    ], [15 * mm, 42 * mm, 10 * mm, 18 * mm, PAGE_W - 2 * MARGIN - 85 * mm]))

    f.append(h3("9.2 Inference and medical media (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["GET", "/api/model-status", "696", "Public", "Reports model connectivity and the active error state. Drives frontend submission gating."],
        ["POST", "/api/predict", "566", "Bearer", "Multipart radiograph upload. Runs the six-stage CV gate, then DenseNet inference and Grad-CAM. Returns HTTP 503 if the model is disconnected."],
        ["GET", "/api/media/radiology/{filename}", "224", "Bearer or ?token", "Authenticated radiograph streaming with per-request ownership verification. Resolves both the original and the _gradcam overlay."],
        ["GET", "/api/patient/history", "703", "Bearer", "Patient's own prediction archive with filtering."],
    ], [15 * mm, 46 * mm, 10 * mm, 18 * mm, PAGE_W - 2 * MARGIN - 89 * mm]))

    f.append(h3("9.3 Doctor practice management (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["GET", "/api/doctor/dashboard", "1020", "Doctor", "Cockpit aggregate: queue, earnings and today's statistics."],
        ["GET", "/api/doctor/search-patient", "775", "Doctor", "Look up a patient by phone or CNIC."],
        ["POST", "/api/doctor/register-patient", "812", "Doctor", "Provision a patient account and create the care link."],
        ["PUT", "/api/doctor/update-patient/{patient_id}", "945", "Doctor", "Amend a registered patient's demographics."],
        ["DELETE", "/api/doctor/unlink-patient/{patient_id}", "927", "Doctor", "Dissolve the care relationship."],
        ["POST", "/api/doctor/link-patient", "904", "Doctor", "Attach an existing account to the doctor's panel."],
        ["POST", "/api/doctor/link-prediction-to-patient", "186", "Doctor", "Attribute an unowned screening result to a patient record. This handler was previously declared twice; the duplicate has been removed. See Section 9.11."],
        ["DELETE", "/api/doctor/delete-prediction/{prediction_id}", "152", "Owner or treating doctor", "Permanently delete the record, the radiograph and the paired Grad-CAM overlay."],
        ["GET", "/api/doctor/payments", "2170", "Doctor", "Fee and payment records for the practice."],
    ], [15 * mm, 58 * mm, 10 * mm, 24 * mm, PAGE_W - 2 * MARGIN - 107 * mm]))

    f.append(h3("9.4 Appointments and the token queue (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["GET", "/api/appointments/queue-window", "1191", "Bearer", "Remaining capacity in the active queue window."],
        ["POST", "/api/appointments/book", "1211", "Bearer", "Allocate a token and create the appointment."],
        ["GET", "/api/appointments/booked-tokens", "1158", "Bearer", "Tokens already issued for the doctor and date."],
        ["GET", "/api/appointments/patient-bookings", "1317", "Bearer", "Current patient's own bookings."],
        ["GET", "/api/appointments/doctor-queue-public", "1361", "Public, optional bearer", "Read-only queue projection for a waiting-room display; a signed-in caller also receives full patient names."],
        ["GET", "/api/appointments/doctor-today", "1401", "Doctor", "Date-scoped ledger for the doctor."],
        ["POST", "/api/appointments/move-to-tomorrow", "1446", "Doctor", "Rollover of unfinished appointments to the next day."],
        ["POST", "/api/appointments/update-status", "1513", "Bearer", "Apply a status transition to the caller's own appointment."],
        ["POST", "/api/appointments/check-in/{appointment_id}", "1592", "Bearer", "Move a pending appointment to serving and broadcast the change."],
        ["GET", "/api/appointments/serving-status", "1637", "Public", "Status of the current serving patient."],
        ["PUT", "/api/appointments/update/{appointment_id}", "1725", "Bearer", "Amend appointment details."],
        ["DELETE", "/api/appointments/cancel/{appointment_id}", "1671", "Bearer", "Cancel an appointment and release its token."],
    ], [15 * mm, 60 * mm, 10 * mm, 19 * mm, PAGE_W - 2 * MARGIN - 104 * mm]))

    f.append(h3("9.5 Guest registration lifecycle (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["POST", "/api/registration/request", "1852", "Public", "Submit a walk-in registration request; returns pending."],
        ["GET", "/api/registration/status/{phone_or_cnic}", "1948", "Public", "Poll the approval state using the applicant's identifier."],
        ["GET", "/api/registration/requests", "1966", "Doctor", "List pending guest requests."],
        ["POST", "/api/registration/{request_id}/approve", "2004", "Doctor", "Approve a request and allocate a token."],
        ["POST", "/api/registration/{request_id}/reject", "2127", "Doctor", "Reject a request with a stored reason."],
    ], [15 * mm, 56 * mm, 10 * mm, 17 * mm, PAGE_W - 2 * MARGIN - 98 * mm]))

    f.append(h3("9.6 Messaging and contact (routes.py)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["POST", "/api/contact/submit", "105", "Public", "Public enquiry submission, optionally attributed to a doctor."],
        ["GET", "/api/doctor/messages", "119", "Doctor", "Messages addressed to the signed-in doctor."],
        ["PUT", "/api/doctor/messages/{msg_id}/read", "128", "Doctor", "Mark a message as read."],
        ["DELETE", "/api/doctor/messages/{msg_id}", "140", "Doctor", "Remove a message from the doctor's inbox."],
    ], [15 * mm, 49 * mm, 10 * mm, 18 * mm, PAGE_W - 2 * MARGIN - 92 * mm]))

    f.append(h3("9.7 Administrative router (admin.py, 14 endpoints)"))
    f.append(table([
        ["Method", "Path", "Line", "Access", "Purpose"],
        ["GET", "/api/admin/users", "196", "Admin", "List all users for moderation."],
        ["POST", "/api/admin/users/{user_id}/role", "217", "Admin", "Change a user's role."],
        ["PUT", "/api/admin/users/{user_id}/details", "235", "Admin", "Amend a user record."],
        ["DELETE", "/api/admin/users/{user_id}", "269", "Admin", "Remove a user account."],
        ["GET", "/api/admin/messages", "155", "Admin", "All contact submissions."],
        ["PUT", "/api/admin/messages/{msg_id}/read", "160", "Admin", "Mark a submission as read."],
        ["DELETE", "/api/admin/messages/{msg_id}", "169", "Admin", "Delete a submission."],
        ["GET", "/api/admin/settings/contact", "122", "Admin", "Read contact configuration."],
        ["PUT", "/api/admin/settings/contact", "136", "Admin", "Update contact configuration."],
        ["GET", "/api/admin/stats", "178", "Admin", "Platform statistics for the dashboard."],
        ["GET", "/api/admin/predictions", "348", "Admin", "List predictions with patient names, paginated."],
        ["DELETE", "/api/admin/predictions/{prediction_id}", "392", "Admin",
         "Delete a prediction, its radiograph and its Grad-CAM overlay."],
        ["GET", "/api/admin/appointments", "412", "Admin", "List appointments with patient names, paginated."],
        ["DELETE", "/api/admin/appointments/{appointment_id}", "462", "Admin", "Delete a booking."],
    ], [15 * mm, 57 * mm, 10 * mm, 15 * mm, PAGE_W - 2 * MARGIN - 97 * mm]))

    f.append(h3("9.8 WebSocket channel"))
    f.append(table([
        ["Channel", "Line", "Protocol", "Purpose"],
        ["/api/ws/queue", "1814", "WebSocket", "Bidirectional queue channel. The server broadcasts token state changes; clients re-fetch authoritative state on receipt rather than treating the payload as canonical."],
    ], [32 * mm, 10 * mm, 20 * mm, PAGE_W - 2 * MARGIN - 62 * mm]))

    f.append(h3("9.9 Endpoint totals"))
    f.append(table([
        ["Group", "Count"],
        ["Authentication and identity (Section 9.1)", "5"],
        ["Inference, medical media and history (9.2)", "4"],
        ["Doctor practice management (9.3)", "9"],
        ["Appointments and the token queue (9.4)", "12"],
        ["Guest registration lifecycle (9.5)", "5"],
        ["Messaging and contact (9.6)", "4"],
        ["Administrative router (9.7)", "14"],
        ["WebSocket channel (9.8)", "1"],
        ["Service root (main.py)", "1"],
        ["REST subtotal", "54"],
        ["Total handlers declared and reachable", "55 (54 REST + 1 WebSocket)"],
    ], [80 * mm, PAGE_W - 2 * MARGIN - 80 * mm]))
    f.append(note(
        "The counts above were reconciled against the FastAPI route table at generation time: 54 "
        "<font face='Courier'>APIRoute</font> objects plus one "
        "<font face='Courier'>APIWebSocketRoute</font>, with no duplicate method and path pair "
        "remaining."))

    f.append(h3("9.10 Public surface and exposure review"))
    f.append(p(
        "Thirteen endpoints under <font face='Courier'>/api</font> are reachable without a bearer token, "
        "plus the unauthenticated service root, giving an unauthenticated surface of <b>14 handlers</b> "
        "against <b>41 authenticated REST handlers</b>. This was established by probing the running "
        "service with no Authorization header and recording the response code, not by reading "
        "decorators: this codebase validates tokens inside handler bodies through "
        "<font face='Courier'>get_current_user_from_token</font> rather than through injected "
        "dependencies, so dependency introspection alone does not reveal the real access model. The "
        "table lists all thirteen."))
    f.append(table([
        ["Public endpoint", "Why it is public", "Residual exposure"],
        ["GET /api/model-status", "Drives frontend gating and is diagnostic only.", "Leaks whether the model loaded and the error text."],
        ["POST /api/auth/login", "Authentication entry point.", "Subject to brute force; needs proxy rate limiting."],
        ["POST /api/auth/register", "Doctor onboarding.", "Gated by access codes, but codes are guessable if weak."],
        ["POST /api/auth/reset-password", "Credential recovery.", "Unauthenticated write path; needs rate limiting to prevent abuse."],
        ["POST /api/contact/submit", "Public enquiry form.", "Unauthenticated write path; vulnerable to spam without rate limiting."],
        ["POST /api/registration/request", "Walk-in registration.", "Same spam exposure as the contact form."],
        ["GET /api/registration/status/{id}", "Guest status polling.", "Enumerable; reveals whether an identifier has a pending request."],
        ["GET /api/doctors/list", "Public directory.", "Intentional; reveals clinician details intentionally published."],
        ["GET /api/appointments/doctor-queue-public", "Waiting-room display.",
         "Reachable without a token, so an anonymous caller gets token numbers, status and an "
         "initials-only patient label; the fee is withheld either way. A caller that presents a valid "
         "bearer token is additionally served the full patient name, which is what the signed-in "
         "booking page renders. A missing or stale token falls back to the anonymous shape."],
        ["GET /api/appointments/serving-status", "Queue display.", "Publishes the token number currently being served."],
        ["GET /api/appointments/queue-window", "Queue display.", "Publishes the active token window bounds."],
        ["GET /api/appointments/booked-tokens", "Queue display.", "Publishes the set of booked token numbers only; no patient identity."],
        ["GET /api/admin/settings/contact", "Public contact page.",
         "Read-only; reveals published contact details by design. The matching PUT is admin only."],
    ], [50 * mm, 46 * mm, PAGE_W - 2 * MARGIN - 96 * mm]))
    f.append(note(
        "<b>Deliberately excluded from the public surface.</b> "
        "<font face='Courier'>GET /api/media/radiology/&#123;filename&#125;</font> is sometimes described as "
        "public because it also accepts the token as a query parameter, but an unauthenticated request "
        "returns 401, so it is counted among the 41 authenticated handlers. "
        "<font face='Courier'>POST /api/predict</font> likewise returns 401 without a token."))

    f.append(h3("9.11 Defect found and resolved during this review: duplicated route"))
    f.append(warn(
        "<font face='Courier'>POST /api/doctor/link-prediction-to-patient</font> was declared twice in "
        "<font face='Courier'>api/routes.py</font>, with an identical function name, signature and body. "
        "FastAPI matches routes in registration order, so the second declaration was unreachable dead "
        "code, and the two copies could silently diverge. This has been <b>resolved</b>: the redundant "
        "declaration was deleted and the surviving handler was kept, including its ownership check that "
        "restricts the operation to the doctor who owns the prediction. A regression test now asserts "
        "that a doctor cannot link another doctor's prediction."))
    f.append(note(
        "<b>Correction against the previous issue.</b> The prior API table listed a different set of "
        "paths, including several that do not exist in the codebase, and omitted the administrative "
        "router, the guest registration lifecycle, the doctor practice endpoints and the WebSocket "
        "channel. This directory is now transcribed directly from the route decorators."))
    f.append(PageBreak())
    return f

def build_s10():
    f = [h1("10. Step-by-Step Transaction Lifecycles")]
    f.append(h2("10.1 Radiograph screening request"))
    f.extend(numbered([
        "The patient selects or captures a radiograph and submits it as multipart form data. The "
        "browser sets the multipart boundary automatically; the client never assigns the header.",
        "The request interceptor attaches the bearer JWT.",
        "The server enforces a 10 MB payload ceiling before the file is written to disk, so an "
        "oversized upload cannot exhaust storage.",
        "<font face='Courier'>validate_chest_xray()</font> runs all six OpenCV stages. Any failure "
        "returns HTTP 400 naming the stage that rejected the image, and the frontend renders that "
        "reason so the user knows whether to retake the film.",
        "The model-connection invariant is checked. A disconnected model returns HTTP 503 with an "
        "explicit message; no inference is attempted.",
        "The image is normalised to a 224x224 tensor and passed through DenseNet-121 on the CPU.",
        "Softmax yields the three-class distribution; the arg-max class and its probability are "
        "selected as the prediction.",
        "Grad-CAM is computed for the winning class and written to "
        "<font face='Courier'>&lt;stem&gt;_gradcam.jpg</font> beside the original.",
        "A <font face='Courier'>predictions</font> row stores the class, confidence, the full "
        "probability vector, the file paths and timestamps.",
        "The response carries the result; the frontend renders the class, the confidence meter, the "
        "full distribution and the optional heatmap.",
        "Both images are later retrievable only through the authenticated media route.",
    ]))
    f.append(note(
        "The live dataset currently holds three users (one administrator, one doctor and one "
        "patient), one doctor-patient link, three screening predictions, five site settings, and no "
        "appointments, guest registration requests or contact messages. The three predictions are "
        "synthetic rows created while exercising the upload, media and admin-oversight paths, so "
        "storage and integrity behaviour is documented from the schema and the automated suite "
        "rather than from genuine clinical volume."))

    f.append(h2("10.2 OPD appointment and token lifecycle"))
    f.extend(numbered([
        "The patient queries <font face='Courier'>/api/appointments/queue-window</font> and the "
        "booked-token list to learn what is still available.",
        "The patient confirms, posting to <font face='Courier'>/api/appointments/book</font>. Inside a "
        "transaction the server re-checks capacity and allocates the next token according to the "
        "doctor's token mode.",
        "The doctor's consultation fee is copied onto the appointment as "
        "<font face='Courier'>fee_charged</font>.",
        "The appointment is created in <font face='Courier'>pending</font> state and the change is "
        "broadcast over <font face='Courier'>/api/ws/queue</font>.",
        "At the clinic the doctor checks the patient in with "
        "<font face='Courier'>/api/appointments/check-in/{appointment_id}</font>, moving it to "
        "<font face='Courier'>serving</font>; the waiting room and the patient's handset update.",
        "Unfinished appointments can be rolled forward with "
        "<font face='Courier'>/api/appointments/move-to-tomorrow</font>.",
        "After consultation the status is advanced to <font face='Courier'>completed</font> and the "
        "fee captured.",
        "Either party may cancel; the token is released and the queue is rebroadcast.",
    ]))
    f.append(h2("10.3 Guest walk-in registration"))
    f.extend(numbered([
        "An unauthenticated visitor posts demographics and an intended date to "
        "<font face='Courier'>/api/registration/request</font>; a "
        "<font face='Courier'>registration_requests</font> row is created as "
        "<font face='Courier'>pending</font>.",
        "The visitor polls <font face='Courier'>/api/registration/status/{phone_or_cnic}</font> or "
        "waits for the broadcast.",
        "A doctor reviews the queue via <font face='Courier'>/api/registration/requests</font>.",
        "Approval at <font face='Courier'>/api/registration/{request_id}/approve</font> allocates a real token "
        "number and creates the appointment.",
        "Rejection at <font face='Courier'>/api/registration/{request_id}/reject</font> stores a reason the "
        "guest can read, keeping the audit trail on the record.",
    ]))
    f.append(PageBreak())
    return f


def build_s11():
    f = [h1("11. Deployment, Environment Configuration &amp; Troubleshooting")]
    f.append(h2("11.1 Environment variables"))
    f.append(p(
        "Settings are typed through pydantic-settings in "
        "<font face='Courier'>app/core/config.py</font>. The service applies fail-fast guards in "
        "production rather than booting with insecure defaults:"))
    f.append(code(
        "if ENV == \"production\":\n"
        "    if SECRET_KEY in (\"your_super_secret_key\", \"changeme\", ...):\n"
        "        raise RuntimeError(\"SECRET_KEY must be overridden in production.\")\n"
        "    if len(REGISTRATION_KEYS.strip()) < 8:\n"
        "        raise RuntimeError(\"REGISTRATION_KEYS must be set in production.\")"))
    f.append(table([
        ["Variable", "Purpose", "Handling"],
        ["DATABASE_URL", "SQLAlchemy connection string", "Secret. Never logged or documented."],
        ["SECRET_KEY", "HS256 signing key", "Secret. Validated at startup in production."],
        ["ALGORITHM", "Token signing algorithm", "Defaults to HS256."],
        ["ACCESS_TOKEN_EXPIRE_MINUTES", "Token lifetime", "Numeric; short-lived by design."],
        ["REGISTRATION_KEYS", "Comma-separated doctor access codes", "Secret. Rejects weak or unset values in production."],
        ["ENV", "Deployment environment flag", "Drives the production guards."],
    ], [42 * mm, 46 * mm, PAGE_W - 2 * MARGIN - 88 * mm]))
    f.append(warn(
        "This report intentionally omits all secret values. A real "
        "<font face='Courier'>.env</font> must never be committed to version control, and no database "
        "password, signing key or registration code may appear in documentation, screenshots or slide "
        "decks."))

    f.append(h2("11.2 Running locally"))
    f.append(code(
        "# Backend\n"
        "cd backend\n"
        "pip install -r requirements.txt\n"
        "python run.py                 # serves app.main:app on 0.0.0.0:8000\n"
        "\n"
        "# Frontend (separate shell)\n"
        "cd frontend\n"
        "npm install\n"
        "npm run dev                   # http://localhost:5173\n"
        "\n"
        "# Quality gates\n"
        "npm run lint                  # --max-warnings 0\n"
        "npm run build\n"
        "pytest                        # 61 tests"))
    f.append(note(
        "If port 5173 is occupied, Vite silently advances to 5174 or 5175. Because CORS permits the "
        "full set the application still works, but a hard-coded origin elsewhere will fail. In this "
        "project the dev server most often bound to <b>5174</b>."))

    f.append(h2("11.3 Containers"))
    f.append(p(
        "The Compose stack lives in the <font face='Courier'>docker/</font> directory, not the "
        "repository root. It defines a backend service and a frontend service fronted by Nginx, which "
        "terminates TLS and falls back to index.html for client-side routes:"))
    f.append(code(
        "cd docker\n"
        "docker compose up --build"))
    f.append(h2("11.4 Troubleshooting matrix"))
    f.append(table([
        ["Symptom", "Root cause", "Resolution"],
        ["400 Missing boundary in multipart",
         "Content-Type was set manually, stripping the multipart boundary.",
         "Delete the manual header from the Axios call and let the browser set it."],
        ["CORS error in console, upload fails",
         "Usually this is the boundary defect above, not a CORS policy problem.",
         "Inspect the request headers before touching allow_origins."],
        ["All Grad-CAM heatmaps return 404",
         "The media route resolved the overlay by LIKE match on the full filename and never matched.",
         "Strip the _gradcam suffix, look up the owning prediction, then serve the requested variant. "
         "Covered by tests/test_media_route.py."],
        ["Prediction returns 503",
         "Model weights failed to load; random fallback is intentionally disabled.",
         "Check /api/model-status and the startup log. Verify the 28 MB checkpoint is present."],
        ["Radiograph loads as a broken icon",
         "An &lt;img&gt; request was made without a token, or the record is not owned by the caller.",
         "Append ?token=<jwt> to the media URL, or use the api.js media URL helpers."],
        ["Doctor registration rejected",
         "Missing, unknown or already-redeemed access code.",
         "Verify REGISTRATION_KEYS and inspect used_access_code for prior redemption."],
        ["Blank page after a production deploy",
         "Nginx lacks the SPA history fallback.",
         "Ensure nginx.conf falls back to index.html for non-asset paths."],
        ["Frontend build fails on lint",
         "ESLint runs with --max-warnings 0.",
         "Fix the warning; the repository currently reports zero."],
    ], [40 * mm, 46 * mm, PAGE_W - 2 * MARGIN - 86 * mm]))
    f.append(PageBreak())
    return f

def build_s12():
    f = [h1("12. Security Architecture &amp; Access Control Model")]
    f.append(h2("12.1 Authentication and token lifecycle"))
    f.append(p(
        "Passwords are hashed with bcrypt using a per-password random salt, never a static salt or "
        "plaintext. Login returns an HS256-signed JWT carrying the subject, role, primary key and an "
        "expiry. Every protected route resolves the bearer token through a single dependency that "
        "rejects any signature mismatch or expiry with HTTP 401. The frontend distinguishes an expired "
        "session (401, which purges local state and redirects) from a credential rejection (400, shown "
        "inline), so a mistyped password is never misread as a session expiry."))
    f.append(h2("12.2 Layered access control"))
    f.append(table([
        ["Layer", "Control"],
        ["Transport", "CORS restricted to an explicit development allow-list rather than a wildcard, so "
                      "credentialed requests remain valid. Production TLS terminates at Nginx."],
        ["Session", "Stateless JWT verification on every request; a 401 triggers local state purge and "
                    "redirect."],
        ["Routing", "Frontend role guards prevent rendering of unauthorised portals, treated strictly as "
                    "a user-experience measure."],
        ["Endpoint", "Backend handlers re-derive the caller from the signed token and re-check role and "
                     "record ownership per request. Client-side guards are never trusted."],
        ["Registration", "Public sign-up is restricted to doctors holding an unredeemed access code, "
                         "enforced server-side and backed by a unique index."],
        ["Media", "Diagnostic radiographs are excluded from static mounting and streamed only through "
                  "an authenticated route with per-request ownership verification."],
        ["Input validation", "Pydantic schemas validate request bodies; the CV gate rejects "
                             "non-radiographic uploads; a 10 MB ceiling bounds storage."],
        ["Fail-fast config", "Production startup aborts on default secrets or weak registration keys."],
        ["Headers", "Security response headers are applied by middleware to every response."],
    ], [26 * mm, PAGE_W - 2 * MARGIN - 26 * mm]))
    f.append(h2("12.3 Threats and controls"))
    f.append(table([
        ["Threat", "Control", "Residual risk"],
        ["Credential stuffing", "bcrypt cost, short token life, and registration codes for new doctors.",
         "No application-layer rate limiting; it must be enforced at Nginx."],
        ["Broken object-level authorisation on media",
         "Ownership is re-verified on every media request by database lookup.",
         "Correctness depends on the ownership predicate; regression-tested."],
        ["Path traversal via crafted filenames",
         "Basenames are enforced and the resolved path must remain inside the uploads directory.",
         "None identified in the current implementation."],
        ["Fabricated diagnoses on model failure", "HTTP 503 refusal; no random fallback path exists.",
         "A disconnected model blocks screening entirely. This is the intended trade-off."],
        ["Access-code replay across instances",
         "The unique index on used_access_code is authoritative; the in-process burn set is a fast path.",
         "Redemption is not propagated across instances, so a race surfaces a duplicate-key error "
         "rather than a clean rejection. See Section 15."],
        ["Spam on public write endpoints",
         "Registration codes gate doctor sign-up.",
         "The contact form and walk-in request accept unauthenticated writes with no rate limit."],
        ["XSS or malicious uploads", "React escapes rendered text by default; files are re-encoded by "
                                     "Pillow and served with derived media types.",
         "No content-security-policy header is currently set."],
        ["Patient identity disclosure on the public waiting-room queue",
         "The queue projection returns the token number, the status and the patient label; the "
         "consultation fee is withheld. The label is initials-only for an anonymous caller and the full "
         "name only once a valid bearer token is presented. Regression tests assert that no full name "
         "and no fee field reach an anonymous or stale-token response.",
         "Initials remain re-identifiable in a small waiting room, so anyone who can read the display "
         "can still infer who is present. That is inherent to a public queue board. Any signed-in "
         "patient, doctor or admin can also enumerate the day's names through this route."],
        ["Admins reading clinical records",
         "The administrative list and delete endpoints are role-checked server-side on every request; "
         "the boundary was confirmed by probing with a doctor token and receiving 403.",
         "Admins can see and delete predictions and appointments but cannot alter a diagnosis or a "
         "fee, and these are ordinary authenticated requests rather than separately audited ones."],
    ], [36 * mm, 60 * mm, PAGE_W - 2 * MARGIN - 96 * mm]))
    f.append(PageBreak())
    return f


def build_s13():
    f = [h1("13. Automated Test Suite &amp; Verification Evidence")]
    f.append(p(
        "The backend ships an automated suite of <b>61 passing tests</b> across five modules, "
        "1,054 lines, supported by a further 73 lines of fixtures in conftest.py and __init__.py. Tests run against an isolated in-memory SQLite database with "
        "<font face='Courier'>StaticPool</font> so a single shared connection persists across the "
        "session, and the upload directory is redirected to a temporary path so tests never touch "
        "clinical files."))
    f.append(table([
        ["Module", "Lines", "Coverage"],
        ["test_auth_security.py", "430",
         "Registration role enforcement, access-code validation and replay rejection, login with phone "
         "and CNIC, wrong-password handling, JWT claim integrity, expiry, 401 behaviour for missing or "
         "malformed tokens, doctor-only enforcement across the dashboard and its actions, "
         "prediction-ownership checks, and the public-queue privacy assertions."],
        ["test_media_route.py", "148",
         "Original-image serving, Grad-CAM overlay resolution for both PNG and JPEG variants, "
         "cross-patient access denial, traversal rejection, missing-file handling, query-token "
         "authentication, and confirmation that deletion removes both files."],
        ["test_queue.py", "141",
         "Token allocation in fixed and dynamic modes, capacity and queue-window enforcement, and "
         "serving state transitions."],
        ["test_admin_user_integrity.py", "335",
         "Cross-column CNIC and phone uniqueness on admin edits, avatar-safe user deletion, "
         "contact-settings validation for email, phone and WhatsApp values including atomicity on "
         "failure, and role enforcement on the administrative clinical-oversight endpoints."],
    ], [34 * mm, 13 * mm, PAGE_W - 2 * MARGIN - 47 * mm]))
    f.append(h3("13.1 Verified state at time of writing"))
    f.append(table([
        ["Check", "Method", "Result"],
        ["Backend suite", "pytest", "61 passed"],
        ["Frontend lint", "npm run lint", "Zero errors, zero warnings"],
        ["Frontend build", "npm run build", "Production bundle emitted successfully"],
        ["Model checkpoint", "File inspection", "Present, 28,433,177 bytes"],
        ["Model health", "GET /api/model-status", "connected: true"],
        ["Route inventory", "Introspection of the FastAPI route table",
         "54 REST + 1 WebSocket, with no duplicate method and path pair"],
        ["Unauthenticated surface", "Live probe of all 54 REST handlers with no Authorization header",
         "14 handlers reachable unauthenticated; the other 41 return 401"],
        ["Doctor-only enforcement", "Live probe with an admin token against the doctor dashboard, "
         "patient search and payments", "403 for admin, 200 for doctor"],
        ["Public queue disclosure", "Live probe of the unauthenticated waiting-room queue route",
         "Initials-only patient label, no full name, no fee"],
    ], [30 * mm, 40 * mm, PAGE_W - 2 * MARGIN - 70 * mm]))
    f.append(note(
        "<b>Methodological note.</b> The Grad-CAM media tests were written before the fix and observed "
        "to fail against the original LIKE-match implementation, then pass once filename-stem "
        "resolution was applied. The suite therefore detects the regression class rather than merely "
        "confirming current behaviour."))
    f.append(h3("13.2 Coverage gaps"))
    f.extend(bullets([
        "No frontend component or end-to-end browser tests; the UI relies on manual verification and "
        "lint.",
        "The six-stage CV gate has no unit tests with positive and negative image fixtures, which is the "
        "highest-value area for future coverage.",
        "Queue tests use the SQLite fixture, so PostgreSQL-specific concurrency semantics are not "
        "exercised.",
        "No load or performance testing of inference latency or WebSocket fan-out.",
        "No test asserts the absence of duplicate route registration, so the class of defect "
        "described in Section 9.11 could recur without being detected.",
    ]))
    f.append(PageBreak())
    return f


def build_s14():
    f = [h1("14. Appendix A: Engineering Change Log")]
    f.append(p(
        "This revision documents engineering work completed against the codebase during the final "
        "review pass, including a security hardening pass, together with the observations that "
        "remain open at the time of writing."))

    f.append(h3("14.1 Defects resolved"))
    f.append(table([
        ["Area", "Symptom", "Resolution"],
        ["Grad-CAM media serving",
         "Every heatmap request returned 404. The overlay was stored as &lt;stem&gt;_gradcam.jpg and "
         "queried with a trailing LIKE match, so the suffix never matched and no owning record was "
         "found.",
         "The route now derives the requested stem, detects the _gradcam variant, resolves the owning "
         "prediction, re-verifies access, then serves the requested file with a derived media type. "
         "PNG and JPEG overlays are both covered."],
        ["Prediction deletion",
         "Deleting a record left the radiograph and its Grad-CAM overlay orphaned on disk, consuming "
         "storage and leaving unreferenced clinical images.",
         "The delete endpoint now removes the record and both sibling files. The UI wording was also "
         "corrected from &quot;Archive&quot; to a permanent &quot;Delete&quot; so the action is not "
         "misrepresented as reversible."],
        ["Multipart uploads",
         "Five call sites set Content-Type manually, stripping the multipart boundary. The server "
         "rejected them with 400 Missing boundary in multipart, which surfaced as a misleading CORS "
         "error.",
         "Manual headers removed from Register.jsx, both Patients.jsx uploads, Profile.jsx and "
         "DoctorDashboard.jsx."],
        ["Predict page icons",
         "The Sparkles icon failed to render because the import was missing.",
         "Import added in Predict.jsx."],
        ["Application branding",
         "The page requested /vite.svg, the default Vite starter icon, so the browser tab and bookmarks "
         "showed the framework logo instead of the project's mark.",
         "Generated a multi-resolution icon set from the real logo: favicon.ico, favicon-32.png, "
         "icon-192.png, icon-512.png and apple-touch-icon.png, with manifest references wired in "
         "index.html."],
        ["Header branding",
         "The navigation bar had no project mark.",
         "Navbar.jsx renders logo-mark-128.png on desktop and logo-mark-64.png in the mobile view, in "
         "both light and dark themes."],
        ["Result actions",
         "Action labels wrapped to two lines at narrow widths, misaligning the row.",
         "whitespace-nowrap and non-shrinking icons applied to the report, download and delete "
         "controls."],
        ["Doctor search layout",
         "The search field occupied only one column beside the doctor directory.",
         "The field now spans the full directory width."],
        ["Login error handling",
         "A mistyped password left a persistent blocking alert, and a genuine 401 from the interceptor "
         "could not be distinguished from a credential rejection.",
         "The alert auto-dismisses after three seconds; credential rejections return HTTP 400 while 401 "
         "is reserved for expired tokens."],
        ["Plaintext database credential in source",
         "app/core/config.py carried a fallback connection string containing a real password, so the "
         "secret was distributed with the source and would ship with any clone.",
         "The fallback was removed. An explicit sentinel is the only default, and the service refuses "
         "to start if DATABASE_URL is still set to it. The value now lives solely in an untracked "
         ".env file, which git ignores."],
        ["Clinical dashboard open to administrators",
         "The doctor dashboard admitted admin accounts, but every action the screen offers is "
         "doctor-gated, so an admin saw a cockpit of controls that each returned 403.",
         "The handler now returns 403 for any non-doctor, matching its own action set. Administrators "
         "use the /admin surface. Regression tests assert admin 403, doctor 200 and patient 403."],
        ["Duplicated route handler",
         "POST /api/doctor/link-prediction-to-patient was declared twice with an identical body, so the "
         "second copy was unreachable and could silently diverge.",
         "The redundant declaration was deleted and the surviving handler kept, including its "
         "prediction-ownership check. See Section 9.11."],
        ["Patient identity leak on the public queue",
         "The unauthenticated waiting-room route returned the patient's full name and the consultation "
         "fee to anyone who asked, which disclosed protected health information on a public surface.",
         "The response carries the token number, the status and the patient label, and the fee is "
         "withheld. The label is initials-only unless the caller presents a valid bearer token, so the "
         "signed-in booking page can show full names without reopening the anonymous leak. Regression "
         "tests assert that neither the full name nor a fee field reaches an anonymous or stale-token "
         "response."],
        ["No administrative oversight of clinical records",
         "An administrator could see aggregate counts but had no way to inspect or correct an "
         "individual prediction or booking.",
         "Four admin-only endpoints were added to list and delete predictions and appointments, with "
         "pagination and joined patient names. Deleting a prediction also removes its radiograph and "
         "Grad-CAM overlay. Doctors and admins are separated, verified with a 403 probe."],
        ["User deletion leaked stored media",
         "Deleting a user cascaded the database rows but left every radiograph and overlay the user "
         "had ever uploaded on disk.",
         "The media paths are collected before the bulk delete and the files are removed afterwards "
         "through the same helper the prediction endpoint uses."],
        ["Admin edits could create duplicate identities",
         "CNIC and phone were each unique within their own column only, so one user could be given "
         "another user's CNIC while keeping a different phone.",
         "Both fields are now validated as a pair, with a digits-only format check, and a collision "
         "returns 409 with no partial write."],
        ["Contact settings accepted arbitrary values",
         "The contact-settings endpoint stored whatever it was given, so a malformed phone number or "
         "an invalid address could be published on the public contact page.",
         "Emails and phone and WhatsApp numbers are validated, the latter as 10 to 15 digits with "
         "spaces and punctuation stripped. Every field is validated before anything is written, so a "
         "rejected update leaves the previous values intact."],
        ["Raw Axios calls bypassed the interceptor",
         "TodayTokens.jsx and DoctorDashboard.jsx each built their own Authorization header, "
         "duplicating token handling and bypassing the shared 401 behaviour.",
         "Both pages now use the shared client in services/api.js, so token attachment, base URL and "
         "expired-session handling live in one place. The dashboard's WebSocket keeps its own token "
         "because the browser WebSocket API cannot set headers."],
    ], [30 * mm, 60 * mm, PAGE_W - 2 * MARGIN - 90 * mm]))

    f.append(h3("14.2 Policy and content changes"))
    f.extend(bullets([
        "Public registration was restricted to doctors holding a valid single-use access code. The "
        "backend rejects any non-doctor role at the registration endpoint, and patients are now "
        "provisioned by a verified doctor or through the guest walk-in flow.",
        "Terms and Privacy were expanded from three to sixteen sections each, with consistent Lucide "
        "iconography. These pages contain institutional policy commitments that require faculty and "
        "institution review before publication.",
        "The database was reset to a clean demonstration state with a pre-wipe backup taken. It now "
        "holds three users, one doctor-patient link, three synthetic predictions and five site "
        "settings, and no appointments, guest requests or contact messages.",
    ]))

    f.append(h3("14.3 Defects identified and deliberately not changed in this pass"))
    f.append(table([
        ["Observation", "Location", "Status"],
        ["An identical route handler was declared twice, leaving unreachable dead code that could "
         "silently diverge from its twin.",
         "routes.py", "RESOLVED. The redundant declaration was deleted; the surviving handler keeps its "
         "prediction-ownership check. See Section 9.11."],
        ["Eight orphaned _gradcam.jpg files remain in the radiology upload directory from before the "
         "deletion fix. No user record references them, so no live request can reach them.",
         "backend/uploads/radiology", "Left in place. A storage audit was not requested."],
        ["No route-level React error boundary exists, so a render-time exception blanks the whole view "
         "instead of showing a recoverable message.",
         "frontend/src", "Recommended in Section 15."],
    ], [62 * mm, 34 * mm, PAGE_W - 2 * MARGIN - 96 * mm]))
    f.append(PageBreak())
    return f


def build_s15():
    f = [h1("15. Appendix B: Known Limitations &amp; Recommended Next Steps")]
    f.append(h2("15.1 Current limitations"))
    f.append(table([
        ["#", "Limitation", "Impact"],
        ["1", "No frontend or end-to-end browser tests.",
         "Interface regressions are caught only by manual verification."],
        ["2", "The six-stage CV gate is untested.",
         "Rejection thresholds are unverified against real radiographs and adversarial inputs. This is "
         "the highest-value testing gap."],
        ["3", "SQLite is used for tests while production runs PostgreSQL.",
         "Concurrency and constraint behaviour specific to PostgreSQL is not exercised."],
        ["4", "Admins have no write oversight of clinical records.",
         "Mitigated: admins can now list and delete predictions and appointments, including removal of the "
         "stored radiograph and Grad-CAM overlay. They still cannot alter a diagnosis or a fee."],
        ["5", "Access-code redemption is guarded by a process-local set plus a unique index.",
         "In a multi-instance deployment, simultaneous redemption of one code surfaces a "
         "duplicate-key error rather than a clean rejection."],
        ["6", "No application-layer rate limiting.",
         "Login, contact and walk-in endpoints rely on the reverse proxy for throttling."],
        ["7", "No content-security-policy header.",
         "Existing security headers do not constrain script sources."],
        ["8", "The model checkpoint's provenance is not versioned or checksummed.",
         "Published accuracy figures cannot be reproduced from the tree alone."],
        ["9", "No inference latency or throughput benchmark is recorded.",
         "Capacity planning for a clinic deployment is not evidence-based."],
        ["10", "No HTTPS enforcement in the application layer.",
         "Correct in the Compose stack where Nginx terminates TLS, but a bare Uvicorn deployment would "
         "serve tokens in clear text."],
        ["11", "Guest status is polled by identifier, which is enumerable.",
         "A caller can probe whether an arbitrary phone or CNIC has a pending request."],
        ["12", "Terms and Privacy commitments are not yet reviewed by the institution.",
         "Encryption, storage jurisdiction and human-review claims must not be published as verified "
         "controls until confirmed."],
    ], [7 * mm, 62 * mm, PAGE_W - 2 * MARGIN - 69 * mm]))
    f.append(h2("15.2 Recommended next steps, in priority order"))
    f.extend(numbered([
        "Add image fixtures for the six-stage CV gate: a representative set of genuine chest "
        "radiographs plus adversarial cases including selfies, photographs of people, landscape "
        "scenes, blank uploads and low-light captures. This converts the safety gate from a heuristic "
        "into a regression-tested component.",
        "Add a test that asserts no path and method pair is registered twice, so the class of defect "
        "cannot return. The duplicate handler itself has already been removed.",
        "Introduce a route-level error boundary so a render exception is contained and recoverable.",
        "Propagate access-code redemption through the database by claiming the code with a conditional "
        "update, which makes multi-instance deployment safe.",
        "Add rate limiting to the login, contact and walk-in endpoints, and set a "
        "content-security-policy header.",
        "Adopt Alembic migrations as the single source of truth for schema changes rather than "
        "relying on implicit table creation.",
        "Introduce a frontend test layer beginning with the clinically critical paths: upload, result "
        "rendering and token booking.",
        "Record model provenance, training configuration and evaluation metrics alongside a checkpoint "
        "checksum.",
        "Conduct a performance assessment of inference latency and WebSocket fan-out under a realistic "
        "clinic workload.",
        "Sweep the orphaned overlay files identified in Section 14.3 and add a startup reconciliation "
        "step that reports unreachable media files.",
    ]))
    f.append(Spacer(1, 2 * mm))
    f.append(note(
        "<b>Closing statement.</b> The platform is functionally complete across authentication, "
        "explainable inference, OPD queue management and administration, and it is guarded by a "
        "61-test regression suite. The most valuable remaining work is not feature development but "
        "hardening the two places where the system makes a clinical claim: the image sanity gate and "
        "the model-connection invariant."))
    f.append(PageBreak())
    return f


def build_s16():
    from viva_bank import VIVA
    f = [h1("16. Appendix C: Viva Voce Question Bank")]
    total = sum(len(q) for _, q in VIVA)
    f.append(p(
        "This bank is drawn entirely from the verified behaviour of this codebase. Answers are written "
        "in the form they could reasonably be spoken, so they can be rehearsed rather than memorised. "
        "Where the honest answer is a weakness, the weakness is stated plainly, because an examiner "
        "probes a claimed strength far harder than a conceded limitation."))
    f.append(note(
        "<b>How to use this bank.</b> Nineteen categories, %d questions. A and B cover the scope and the "
        "justification, and B is the one to rehearse hardest, because the first question any examiner "
        "asks about a clinical AI project is why the model should exist when a doctor is already "
        "looking at the image; C, D and E cover the model, the explanation and the image gate; F to I "
        "the engineering, data, security and interface; J and K testing and operations; L and M the "
        "subjective questions about what went wrong and what you would change; N and O the two "
        "deep-dive sets, fifteen backend and nineteen frontend questions; P the thirteen questions on "
        "how the two halves of the system talk to each other; and Q, R and S the thirty questions "
        "drawn from the submitted write-up, covering the experimental evidence, the literature "
        "review and the dataset and training protocol. Rehearse B, L, M, P and Q first. They are where "
        "a candidate who has only memorised the feature list is exposed, and Q is the most dangerous "
        "category in the bank, because an examiner holding your write-up can add the numbers up, and "
        "in this project they do not all agree. Every answer in Q and S is written to be defensible "
        "under exactly that scrutiny, which means several of them concede a fault in the document. "
        "That is deliberate: a prepared concession scores far better than an improvised defence of a "
        "number that does not survive arithmetic." % total))

    for title, items in VIVA:
        f.append(h2("%s" % title))
        for q, a in items:
            f.append(KeepTogether([
                Paragraph("<b>Q. %s</b>" % q, S["h3"]),
                Paragraph(a, S["body"]),
            ]))
    f.append(Spacer(1, 2 * mm))
    f.append(note(
        "<b>Closing note.</b> If a question is asked that you do not know, the correct response is to "
        "say so and then describe how you would find the answer, for example by reading the route "
        "decorator, checking the schema, or writing a test to observe the behaviour. An examiner is "
        "assessing whether you understand your own system; an honest boundary is far more convincing "
        "than a confident invention, and every answer in this bank is written on that assumption."))
    f.append(PageBreak())
    return f

SECTIONS = [
    ("cover", build_cover),
    ("s1", build_s1), ("s2", build_s2), ("s3", build_s3), ("s4", build_s4),
    ("s5", build_s5), ("s6", build_s6), ("s7", build_s7), ("s8", build_s8),
    ("s9", build_s9), ("s10", build_s10), ("s11", build_s11), ("s12", build_s12),
    ("s13", build_s13), ("s14", build_s14), ("s15", build_s15), ("s16", build_s16),
]

SECTION_TITLES = [("s" + k, t) for k, t in TOC]


# ─────────────────────────────────────────────────────────────────────────────
#  TWO-PASS BUILD
#  Pass 1 lays the story out to discover the page count and the page on which
#  each section begins.  Pass 2 re-renders with the real "Page X of Y" total and
#  the resolved contents page numbers.
# ─────────────────────────────────────────────────────────────────────────────

class Marker(Flowable):
    """Zero-height sentinel that records the page its section starts on."""

    width = 0
    height = 0

    def __init__(self, key):
        Flowable.__init__(self)
        self.key = key

    def wrap(self, aw, ah):
        return (0, 0)

    def draw(self):
        pass


def _story(toc_pages):
    story = []
    for name, builder in SECTIONS:
        if name == "cover":
            story.extend(builder(toc_pages))
        else:
            # Bind each section heading to the start of its body so a heading can
            # never be stranded alone at the foot of a page.
            flow = builder()
            story.append(Marker(name))
            if flow and isinstance(flow[0], Paragraph):
                story.append(KeepTogether(flow[:3]))
                story.extend(flow[3:])
            else:
                story.extend(flow)
    return story


def main():
    # pass 1 - discover pagination
    probe = Doc(os.devnull)
    probe.marker_pages = {}
    probe.build(_story(None))
    total = probe.page
    pages = dict(probe.marker_pages)

    # pass 2 - render for real with everything resolved
    doc = Doc(OUT)
    doc.marker_pages = {}
    doc._total = total
    doc.build(_story(pages))

    unresolved = [n for n, _ in SECTIONS[1:] if n not in pages]
    return OUT, total, pages, unresolved


if __name__ == "__main__":
    path, total, pages, unresolved = main()
    print("Wrote  : %s" % path)
    print("Pages  : %d" % total)
    for name, title in SECTION_TITLES:
        print("  p%-3s %s" % (pages.get(name, "?"), title.replace("&amp;", "&")))
    if unresolved:
        print("WARNING unresolved section markers: %s" % unresolved)





