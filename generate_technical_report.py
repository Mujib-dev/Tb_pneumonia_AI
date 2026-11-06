import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress running header/footer on cover page

        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#475569"))

        # Top Running Header
        self.drawString(54, 11 * 72 - 36, "TB & PNEUMONIA AI MEDICAL SCREENING SYSTEM")
        self.setFont("Helvetica", 7.5)
        self.drawRightString(8.5 * 72 - 54, 11 * 72 - 36, "FULL TECHNICAL ARCHITECTURE & OPERATION SPECIFICATION")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)

        # Bottom Running Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 54, 34, page_text)
        self.drawString(54, 34, "CONFIDENTIAL & PROPRIETARY — FINAL YEAR PROJECT COMPREHENSIVE REPORT")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 44, 8.5 * 72 - 54, 44)

        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Color Palette Definitions
    primary_navy = colors.HexColor("#0F172A")
    brand_blue = colors.HexColor("#1D4ED8")
    accent_cyan = colors.HexColor("#0284C7")
    slate_dark = colors.HexColor("#1E293B")
    body_text_color = colors.HexColor("#334155")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    highlight_bg = colors.HexColor("#EFF6FF")
    highlight_border = colors.HexColor("#93C5FD")
    success_bg = colors.HexColor("#F0FDF4")
    success_border = colors.HexColor("#86EFAC")

    # Typography Styles
    cover_super = ParagraphStyle('CoverSuper', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=brand_blue, alignment=1, spaceAfter=14)
    cover_title = ParagraphStyle('CoverTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=24, leading=29, textColor=primary_navy, alignment=1, spaceAfter=12)
    cover_sub = ParagraphStyle('CoverSub', parent=styles['Normal'], fontName='Helvetica', fontSize=12, leading=17, textColor=colors.HexColor("#475569"), alignment=1, spaceAfter=20)

    h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=13.5, leading=17.5, textColor=brand_blue, spaceBefore=11, spaceAfter=4.5, keepWithNext=True)
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=primary_navy, spaceBefore=8, spaceAfter=3, keepWithNext=True)
    h3_style = ParagraphStyle('H3', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=8.8, leading=12, textColor=accent_cyan, spaceBefore=4.5, spaceAfter=2, keepWithNext=True)

    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11.8, textColor=body_text_color, spaceAfter=4)
    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11.5, textColor=body_text_color, leftIndent=14, firstLineIndent=-9, spaceAfter=2.5)
    code_block = ParagraphStyle('CodeBlock', parent=styles['Normal'], fontName='Courier', fontSize=7, leading=9.5, textColor=primary_navy)
    callout_text = ParagraphStyle('Callout', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, leading=11.5, textColor=colors.HexColor("#1E3A8A"))
    
    table_cell = ParagraphStyle('TCell', parent=styles['Normal'], fontName='Helvetica', fontSize=7, leading=9.2, textColor=body_text_color)
    table_cell_bold = ParagraphStyle('TCellB', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7, leading=9.2, textColor=primary_navy)
    table_header = ParagraphStyle('THeader', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.2, leading=9.8, textColor=colors.white)

    story = []

    # =========================================================
    # PAGE 1: COVER PAGE
    # =========================================================
    story.append(Spacer(1, 25))
    story.append(Paragraph("ACADEMIC & TECHNICAL ARCHITECTURE REPORT", cover_super))
    story.append(Paragraph("Automated Chest Radiograph Diagnostic System for Tuberculosis & Pneumonia", cover_title))
    story.append(Paragraph("A Deep Learning, Real-Time OPD Token Queue & Tele-Radiology Web Ecosystem", cover_sub))
    story.append(HRFlowable(width="70%", thickness=2.5, color=brand_blue, spaceAfter=22, spaceBefore=4))

    cover_meta = [
        [Paragraph("Project Title:", table_cell_bold), Paragraph("TB & Pneumonia AI Medical Screening and Clinic Management System", table_cell)],
        [Paragraph("System Domain:", table_cell_bold), Paragraph("Medical Imaging, Computer Vision, Telehealth & OPD Workflow Automation", table_cell)],
        [Paragraph("AI Backbone & Training:", table_cell_bold), Paragraph("DenseNet-121 Trained on 30,000 Balanced Radiographs (Normal, TB, Pneumonia)", table_cell)],
        [Paragraph("Computer Vision:", table_cell_bold), Paragraph("OpenCV: Monochromatic RGB Variance Filter + Laplacian Blur Detection", table_cell)],
        [Paragraph("Backend Core:", table_cell_bold), Paragraph("FastAPI (Python 3.9+), Uvicorn ASGI, WebSockets, SQLAlchemy ORM", table_cell)],
        [Paragraph("Frontend Core:", table_cell_bold), Paragraph("React 18 (Vite), Tailwind CSS, Framer Motion, Axios Interceptors", table_cell)],
        [Paragraph("Database Stack:", table_cell_bold), Paragraph("PostgreSQL 13/18 (Production) / SQLite3 (Local Dev & Testing)", table_cell)],
        [Paragraph("Security Architecture:", table_cell_bold), Paragraph("OAuth2 Password Flow, HS256 JWT Bearer Tokens, Bcrypt Password Salts", table_cell)],
        [Paragraph("Academic Origin:", table_cell_bold), Paragraph("BS Software Engineering Final Year Project, University of Swat", table_cell)],
    ]
    t_cover = Table(cover_meta, colWidths=[150, 310])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_cover)
    story.append(Spacer(1, 25))

    abstract_content = [
        [Paragraph("<b>Executive Overview:</b> This document provides an exhaustive technical specification of the entire project repository. It details every layer of the architecture: how the React frontend interfaces with the FastAPI backend, authentication token lifecycle, model training methodology (30,000 images, Adam, ReduceLROnPlateau, transfer learning on DenseNet-121), computer vision pre-screening filters, relational schema definitions, real-time WebSocket queue synchronization, detailed page-by-page operational analysis, and deployment procedures.", callout_text)]
    ]
    t_abs = Table(abstract_content, colWidths=[460])
    t_abs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), highlight_bg),
        ('BOX', (0,0), (-1,-1), 1, highlight_border),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(t_abs)
    story.append(PageBreak())

    # =========================================================
    # PAGE 2: TABLE OF CONTENTS & EXECUTIVE SUMMARY
    # =========================================================
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    toc_items = [
        ("1. High-Level System Architecture & Design Philosophy", "Section 1"),
        ("2. Complete Technology Stack Matrix (Frontend, Backend, AI, Database, DevOps)", "Section 2"),
        ("3. How Frontend and Backend Connect (Axios Interceptors, JWT, WebSockets, Multipart, CORS)", "Section 3"),
        ("4. Deep Learning Model Training Pipeline & Computer Vision Quality Sanity Gate", "Section 4"),
        ("5. Relational Database Design, Schema ERD & Cascading Integrity", "Section 5"),
        ("6. File-by-File Repository Breakdown & Architectural Map", "Section 6"),
        ("7. Comprehensive Frontend Page-by-Page Breakdown (Patients, Payments, Predict, TodayTokens, etc.)", "Section 7"),
        ("8. Role-Based Portals & Functional Workflows (Patient, Doctor, Administrator)", "Section 8"),
        ("9. Comprehensive RESTful API & WebSocket Endpoint Directory", "Section 9"),
        ("10. Step-by-Step Transaction Lifecycles (Diagnostic Execution & Real-Time OPD Queue)", "Section 10"),
        ("11. Deployment, Environment Configuration & Operational Troubleshooting Guide", "Section 11"),
    ]
    toc_data = [[Paragraph(f"<b>{title}</b>", table_cell), Paragraph(f"<b>{page}</b>", ParagraphStyle('TRight', parent=table_cell, alignment=2))] for title, page in toc_items]
    t_toc = Table(toc_data, colWidths=[380, 80])
    t_toc.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_toc)
    story.append(Spacer(1, 14))

    story.append(Paragraph("Executive Summary & Clinical Rationale", h2_style))
    story.append(Paragraph(
        "Tuberculosis (TB) and Pneumonia remain two of the leading causes of infectious disease mortality globally. Early radiographic detection via chest X-rays (CXR) is standard clinical practice, yet interpreting these images requires specialized radiologist expertise, which is severely strained in developing regions and overburdened hospitals. Misdiagnosis or delayed diagnosis leads to increased morbidity, transmission, and healthcare costs.",
        body_style
    ))
    story.append(Paragraph(
        "The <b>TB & Pneumonia AI System</b> addresses this critical bottleneck by providing an end-to-end medical triage solution. It does not merely serve as an isolated machine learning model; it delivers a comprehensive clinical operating system that unifies <b>automated radiograph validation</b>, <b>instant deep neural classification</b>, <b>real-time outpatient department (OPD) queue token orchestration</b>, and <b>multi-role collaboration</b> between patients, doctors, and hospital administrators.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================
    # SECTION 1: HIGH-LEVEL ARCHITECTURE
    # =========================================================
    story.append(Paragraph("1. High-Level System Architecture & Design Philosophy", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "The system follows a modern decoupled, multi-tier micro-service-ready architecture. The presentation tier (React SPA) is completely isolated from the application tier (FastAPI), communicating strictly through standardized RESTful JSON payloads, multipart file streams, and bidirectional WebSocket events.",
        body_style
    ))

    arch_diag = [
        [Paragraph(
            "<font face='Courier' size='7'>"
            "+-----------------------------------------------------------------------------------------+<br/>"
            "|                                  PRESENTATION TIER (CLIENT)                             |<br/>"
            "|  React 18 + Vite SPA | Tailwind CSS Glassmorphism | Framer Motion | Lucide Medical Icons |<br/>"
            "|  Portals: Patient Workspace | Doctor OPD Cockpit | Admin CMS & User Management         |<br/>"
            "+-----------------------------------------------------------------------------------------+<br/>"
            "                                    |               ^<br/>"
            "           HTTPS / REST (JSON &amp; Multipart) |               | WebSockets (ws://.../queue)<br/>"
            "           JWT Bearer Auth Headers          |               | Real-Time Queue Broadcasts<br/>"
            "                                    v               |<br/>"
            "+-----------------------------------------------------------------------------------------+<br/>"
            "|                                 APPLICATION TIER (FASTAPI ASGI)                         |<br/>"
            "|  Uvicorn Server | Dependency Injection | OAuth2 Password Bearer Auth | Security Headers  |<br/>"
            "|  APIs: /api/auth | /api/predict | /api/doctor | /api/appointments | /api/admin          |<br/>"
            "+-----------------------------------------------------------------------------------------+<br/>"
            "               |                                            |<br/>"
            "               v                                            v<br/>"
            "+-----------------------------+              +--------------------------------------------+<br/>"
            "|    INTELLIGENCE TIER (AI)   |              |         PERSISTENCE TIER (DATABASE)        |<br/>"
            "|  OpenCV: Color &amp; Blur Gate  |              |  SQLAlchemy ORM Connection Pool            |<br/>"
            "|  PyTorch: DenseNet-121 CNN  |              |  PostgreSQL 13/18 (Production Database)    |<br/>"
            "|  3-Class Softmax Evaluator  |              |  Tables: users, predictions, appointments  |<br/>"
            "+-----------------------------+              +--------------------------------------------+"
            "</font>", code_block)]
    ]
    t_diag = Table(arch_diag, colWidths=[460])
    t_diag.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0F172A")),
        ('BOX', (0,0), (-1,-1), 1, brand_blue),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_diag)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Key Architectural Tenets:", h2_style))
    story.append(Paragraph("• <b>Stateless Web Core:</b> The API server maintains no in-memory user sessions. Authentication is entirely encapsulated in signed JSON Web Tokens (JWT) verified on every incoming request.", bullet_style))
    story.append(Paragraph("• <b>Fail-Fast Medical Sanity Gate:</b> Low-quality, corrupted, or non-radiological photos are rejected within 15 milliseconds by OpenCV before invoking heavy neural inference.", bullet_style))
    story.append(Paragraph("• <b>Real-Time Event Broadcast:</b> Waiting room displays, doctor call registers, and patient phones synchronize instantaneously via WebSockets without requiring database polling.", bullet_style))
    story.append(Paragraph("• <b>Role-Based Access Control (RBAC):</b> Explicit role checks on both frontend router guards and backend FastAPI route dependencies prevent privilege escalation.", bullet_style))
    story.append(PageBreak())

    # =========================================================
    # SECTION 2: TECHNOLOGY STACK MATRIX
    # =========================================================
    story.append(Paragraph("2. Complete Technology Stack Matrix", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "Every dependency in the codebase was deliberately selected to balance high computational speed, medical UI clarity, enterprise security, and long-term maintainability:",
        body_style
    ))

    stack_data = [
        [Paragraph("Layer", table_header), Paragraph("Technology", table_header), Paragraph("Version / Library", table_header), Paragraph("Role & Clinical Justification", table_header)],
        # Frontend
        [Paragraph("Frontend UI", table_cell_bold), Paragraph("React", table_cell), Paragraph("v18.2.0+", table_cell), Paragraph("Modular component architecture, concurrent UI rendering, hooks-driven state.", table_cell)],
        [Paragraph("Frontend Build", table_cell_bold), Paragraph("Vite", table_cell), Paragraph("v5.x+", table_cell), Paragraph("Native ES module development server, sub-second HMR, optimized Rollup bundling.", table_cell)],
        [Paragraph("Frontend Style", table_cell_bold), Paragraph("Tailwind CSS", table_cell), Paragraph("v3.x+", table_cell), Paragraph("Glassmorphism aesthetic, accessible high-contrast medical palettes, dark/light mode.", table_cell)],
        [Paragraph("Animation", table_cell_bold), Paragraph("Framer Motion", table_cell), Paragraph("v11.x+", table_cell), Paragraph("Hardware-accelerated card transitions, diagnostic progress meters, smooth modals.", table_cell)],
        [Paragraph("Icons", table_cell_bold), Paragraph("Lucide React", table_cell), Paragraph("Latest", table_cell), Paragraph("Pixel-perfect healthcare iconography (stethoscopes, lungs, user badges).", table_cell)],
        [Paragraph("HTTP Client", table_cell_bold), Paragraph("Axios", table_cell), Paragraph("v1.6.x+", table_cell), Paragraph("Configured with custom request/response interceptors for automatic JWT injection.", table_cell)],
        [Paragraph("Client Routing", table_cell_bold), Paragraph("React Router", table_cell), Paragraph("v6.x+", table_cell), Paragraph("Client-side routing, protected route guards, smart dashboard auto-redirects.", table_cell)],
        # Backend
        [Paragraph("Backend Web", table_cell_bold), Paragraph("FastAPI", table_cell), Paragraph("v0.104.x+", table_cell), Paragraph("Asynchronous Python framework, auto OpenAPI/Swagger documentation, DI engine.", table_cell)],
        [Paragraph("ASGI Server", table_cell_bold), Paragraph("Uvicorn", table_cell), Paragraph("v0.24.x+", table_cell), Paragraph("Lightning-fast ASGI production server built on uvloop and httptools.", table_cell)],
        [Paragraph("ORM Engine", table_cell_bold), Paragraph("SQLAlchemy", table_cell), Paragraph("v2.0.x+", table_cell), Paragraph("Python SQL toolkit, database agnostic connection pooling, relational mappings.", table_cell)],
        [Paragraph("Validation", table_cell_bold), Paragraph("Pydantic", table_cell), Paragraph("v2.x+", table_cell), Paragraph("Strict runtime payload schema validation, serialization, and typing enforcement.", table_cell)],
        [Paragraph("Password Hash", table_cell_bold), Paragraph("Bcrypt / Passlib", table_cell), Paragraph("Latest", table_cell), Paragraph("Salted cryptographic hashing of passwords using Blowfish key derivation.", table_cell)],
        [Paragraph("JWT Tokens", table_cell_bold), Paragraph("Python-Jose", table_cell), Paragraph("Latest", table_cell), Paragraph("Cryptographically signs and decodes HS256 JWT tokens for stateless auth.", table_cell)],
        # AI / CV
        [Paragraph("Deep Learning", table_cell_bold), Paragraph("PyTorch", table_cell), Paragraph("v2.1.x+", table_cell), Paragraph("Dynamic computation graph framework executing DenseNet-121 forward pass.", table_cell)],
        [Paragraph("Vision Models", table_cell_bold), Paragraph("Torchvision", table_cell), Paragraph("v0.16.x+", table_cell), Paragraph("Pretrained model definitions, standard radiographic image tensor transformations.", table_cell)],
        [Paragraph("Computer Vision", table_cell_bold), Paragraph("OpenCV (cv2)", table_cell), Paragraph("v4.8.x+", table_cell), Paragraph("Monochromatic color differential check, Laplacian variance blur detection.", table_cell)],
        # DB & DevOps
        [Paragraph("Primary Database", table_cell_bold), Paragraph("PostgreSQL", table_cell), Paragraph("v13 / v18", table_cell), Paragraph("Enterprise ACID relational database with robust indexing and foreign keys.", table_cell)],
        [Paragraph("Containers", table_cell_bold), Paragraph("Docker Compose", table_cell), Paragraph("v3.8 Compose", table_cell), Paragraph("Multi-container orchestration packaging DB, FastAPI backend, and Nginx frontend.", table_cell)],
    ]
    t_stack = Table(stack_data, colWidths=[75, 80, 75, 230])
    t_stack.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_stack)
    story.append(PageBreak())

    # =========================================================
    # SECTION 3: HOW FRONTEND AND BACKEND CONNECT
    # =========================================================
    story.append(Paragraph("3. How Frontend and Backend Connect (In-Depth Technical Mechanics)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "The interaction between React and FastAPI is engineered for zero-latency, high reliability, and airtight session security. The integration is governed by five primary architectural pillars:",
        body_style
    ))

    story.append(Paragraph("3.1 Dynamic API Endpoint Resolution", h2_style))
    story.append(Paragraph(
        "In <code>frontend/src/services/api.js</code>, the client resolves the backend URL via environment variables. When running locally, Vite falls back to <code>http://localhost:8000/api</code>. In Docker or cloud production, <code>VITE_API_URL</code> points to the production domain.",
        body_style
    ))

    story.append(Paragraph("3.2 Axios Interceptors & JWT Authentication Protocol", h2_style))
    story.append(Paragraph(
        "Communication security relies on JSON Web Tokens. The login transaction flows as follows:",
        body_style
    ))
    story.append(Paragraph("1. User submits identifier (Phone or CNIC) + Password to <code>/api/auth/login</code>.", bullet_style))
    story.append(Paragraph("2. Server verifies salted Bcrypt hash. Upon success, FastAPI issues an HS256-signed JWT containing <code>{ 'sub': phone, 'role': user.role, 'id': user.id, 'exp': timestamp }</code>.", bullet_style))
    story.append(Paragraph("3. React stores this token in <code>localStorage.getItem('token')</code>.", bullet_style))
    story.append(Paragraph("4. <b>Axios Request Interceptor:</b> Every outgoing HTTP call intercepts the configuration and injects: <code>config.headers.Authorization = 'Bearer ' + token</code>.", bullet_style))
    story.append(Paragraph("5. <b>Axios Response Interceptor:</b> If any API call returns HTTP 401 Unauthorized (e.g. token expired), the interceptor automatically purges <code>localStorage</code> and redirects the browser to <code>/login</code> without throwing uncaught UI crashes.", bullet_style))

    code_snippet_interceptor = [
        [Paragraph("<font face='Courier' size='6.8'>// 1. Outgoing Request Interceptor: Attach Bearer JWT Token<br/>"
                   "api.interceptors.request.use((config) =&gt; {<br/>"
                   "&nbsp;&nbsp;const token = localStorage.getItem('token');<br/>"
                   "&nbsp;&nbsp;if (token) { config.headers.Authorization = `Bearer ${token}`; }<br/>"
                   "&nbsp;&nbsp;return config;<br/>"
                   "});<br/><br/>"
                   "// 2. Incoming Response Interceptor: Handle Token Expiration Globally<br/>"
                   "api.interceptors.response.use(<br/>"
                   "&nbsp;&nbsp;(response) =&gt; response,<br/>"
                   "&nbsp;&nbsp;(error) =&gt; {<br/>"
                   "&nbsp;&nbsp;&nbsp;&nbsp;if (error.response &amp;&amp; error.response.status === 401) {<br/>"
                   "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;localStorage.removeItem('token'); localStorage.removeItem('user');<br/>"
                   "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;window.location.href = '/login';<br/>"
                   "&nbsp;&nbsp;&nbsp;&nbsp;}<br/>"
                   "&nbsp;&nbsp;&nbsp;&nbsp;return Promise.reject(error);<br/>"
                   "&nbsp;&nbsp;}<br/>"
                   ");</font>", code_block)]
    ]
    t_snippet2 = Table(code_snippet_interceptor, colWidths=[460])
    t_snippet2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_snippet2)
    story.append(Spacer(1, 6))

    story.append(Paragraph("3.3 Binary Multipart/Form-Data File Streaming", h2_style))
    story.append(Paragraph(
        "For medical image screening (<code>/api/predict</code>) and doctor avatar updates (<code>/api/auth/update-profile</code>), standard JSON payloads are bypassed. The client constructs a <code>FormData</code> object appending the binary image stream. Axios sets the header to <code>multipart/form-data</code>. FastAPI asynchronously streams the raw bytes via <code>UploadFile = File(...)</code>, writing them to disk without memory overflow.",
        body_style
    ))

    story.append(Paragraph("3.4 Real-Time WebSockets Engine (/api/ws/queue)", h2_style))
    story.append(Paragraph(
        "To synchronize patient token calls without polling, a WebSocket channel is maintained by <code>ConnectionManager</code> in <code>backend/app/api/websockets.py</code>. Connected client screens receive events in ~10ms and trigger an automated re-fetch of the queue state.",
        body_style
    ))

    story.append(Paragraph("3.5 CORS & Static File Headers", h2_style))
    story.append(Paragraph(
        "Cross-Origin Resource Sharing is enabled for <code>http://localhost:5173</code> via FastAPI's <code>CORSMiddleware</code>. Static image directories (<code>/uploads</code>) are mounted using a custom <code>CORSStaticFiles</code> subclass that forcibly appends <code>Access-Control-Allow-Origin: *</code>, allowing frontend canvas rendering, medical image cropping, and report printing without browser security blocks.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================
    # SECTION 4: AI & DEEP LEARNING MODEL TRAINING PIPELINE
    # =========================================================
    story.append(Paragraph("4. Deep Learning Model Training Pipeline & Quality Sanity Gate", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "This section details the formal training methodology, dataset distribution, loss functions, optimization strategies, and hyperparameter configurations utilized to train the core <b>DenseNet-121</b> diagnostic model.",
        body_style
    ))

    story.append(Paragraph("4.1 Dataset Curation, Balancing & Experimental Splitting", h2_style))
    story.append(Paragraph(
        "To prevent algorithmic bias toward any dominant class, an aggregated repository of <b>30,000 digital chest radiographs</b> was systematically curated and perfectly balanced across three diagnostic categories: <b>10,000 Normal</b>, <b>10,000 Tuberculosis (TB)</b>, and <b>10,000 Pneumonia</b> radiographs.",
        body_style
    ))

    dataset_table = [
        [Paragraph("Experimental Partition", table_header), Paragraph("Split Ratio (%)", table_header), Paragraph("Samples per Class", table_header), Paragraph("Total Partition Volume", table_header), Paragraph("Role in Optimization", table_header)],
        [Paragraph("<b>Training Set</b>", table_cell_bold), Paragraph("70%", table_cell), Paragraph("7,000 per class", table_cell), Paragraph("<b>21,000 images</b>", table_cell_bold), Paragraph("Backpropagation gradient descent & weight parameter updates.", table_cell)],
        [Paragraph("<b>Validation Set</b>", table_cell_bold), Paragraph("15%", table_cell), Paragraph("1,500 per class", table_cell), Paragraph("<b>4,500 images</b>", table_cell_bold), Paragraph("Hyperparameter tuning, LR scheduling, and early stopping checkpointing.", table_cell)],
        [Paragraph("<b>Testing Set</b>", table_cell_bold), Paragraph("15%", table_cell), Paragraph("1,500 per class", table_cell), Paragraph("<b>4,500 images</b>", table_cell_bold), Paragraph("Unseen, hold-out final diagnostic metric evaluation.", table_cell)],
        [Paragraph("<b>Total Repository</b>", table_cell_bold), Paragraph("100%", table_cell), Paragraph("10,000 per class", table_cell), Paragraph("<b>30,000 images</b>", table_cell_bold), Paragraph("Fully balanced benchmark dataset.", table_cell)],
    ]
    t_dataset = Table(dataset_table, colWidths=[90, 65, 85, 95, 125])
    t_dataset.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_dataset)
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.2 Image Preprocessing & Data Augmentation Pipeline", h2_style))
    story.append(Paragraph("• <b>CLAHE Contrast Enhancement:</b> Contrast Limited Adaptive Histogram Equalization (CLAHE) was applied to enhance local radiographic contrast across soft lung tissues, accentuating subtle pulmonary opacities.", bullet_style))
    story.append(Paragraph("• <b>Dynamic Data Augmentations:</b> Random horizontal flips (p=0.5), random affine rotations (+/- 10 degrees), subtle scaling (0.9 to 1.1), and shear transforms were applied dynamically per batch to prevent memorization and simulate varying radiological acquisition angles.", bullet_style))
    story.append(Paragraph("• <b>Spatial Resizing & Normalization:</b> All images were resized to 224x224 pixels and normalized across RGB channels using ImageNet distribution parameters: Mean = [0.485, 0.456, 0.406] and Std = [0.229, 0.224, 0.225].", bullet_style))

    story.append(Paragraph("4.3 Model Architecture & Transfer Learning Strategy", h2_style))
    story.append(Paragraph(
        "DenseNet-121 was selected over VGG16 (138 million parameters) and ResNet-50 (25 million parameters). DenseNet-121's compact footprint (~8 million parameters, ~28 MB) allows direct feature reuse across dense blocks while enabling rapid real-time inference on hospital CPU workstations without requiring expensive dedicated GPUs. A custom classification head was attached: Global Average Pooling (GAP) produces a 1024-dimensional feature vector, followed by a <b>Dropout layer (rate = 0.5)</b>, and a final fully connected layer (<code>nn.Linear(1024, 3)</code>) yielding class probabilities via <b>Softmax</b>.",
        body_style
    ))

    story.append(Paragraph("4.4 Optimization Strategy & Hyperparameter Configuration", h2_style))
    
    hyper_table = [
        [Paragraph("Hyperparameter", table_header), Paragraph("Configured Strategy / Value", table_header), Paragraph("Optimization Purpose & Mechanics", table_header)],
        [Paragraph("<b>Initial Learning Rate (&alpha;)</b>", table_cell_bold), Paragraph("1 &times; 10<sup>-4</sup> (0.0001)", table_cell), Paragraph("Prevents destructive updates to pre-trained ImageNet backbone weights.", table_cell)],
        [Paragraph("<b>Optimization Algorithm</b>", table_cell_bold), Paragraph("Adam (Adaptive Moment Estimation)", table_cell), Paragraph("Accelerates convergence using adaptive first and second momentum gradients.", table_cell)],
        [Paragraph("<b>Loss Function Objective</b>", table_cell_bold), Paragraph("Categorical Cross-Entropy Loss (L<sub>CCE</sub>)", table_cell), Paragraph("Quantifies multi-class divergence: L = -&sum; y<sub>i</sub> log(&#375;<sub>i</sub>).", table_cell)],
        [Paragraph("<b>Mini-Batch Size</b>", table_cell_bold), Paragraph("32 samples", table_cell), Paragraph("Balances gradient estimation stability with GPU memory constraints.", table_cell)],
        [Paragraph("<b>Maximum Epochs</b>", table_cell_bold), Paragraph("50 Epochs", table_cell), Paragraph("Upper bound on full training iterations.", table_cell)],
        [Paragraph("<b>Learning Rate Scheduler</b>", table_cell_bold), Paragraph("ReduceLROnPlateau (Factor=0.5, Patience=3)", table_cell), Paragraph("Halves learning rate when validation loss plateaus for 3 epochs.", table_cell)],
        [Paragraph("<b>Early Stopping Callback</b>", table_cell_bold), Paragraph("Patience = 5 Epochs (Validation Loss)", table_cell), Paragraph("Halts training when validation loss ceases improving; restores best checkpoint.", table_cell)],
        [Paragraph("<b>Dropout Regularization</b>", table_cell_bold), Paragraph("Rate = 0.5", table_cell), Paragraph("Mitigates co-adaptation between neurons in the final dense layer.", table_cell)],
    ]
    t_hyper = Table(hyper_table, colWidths=[120, 150, 190])
    t_hyper.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_hyper)
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.5 Stage 1 Pre-Inference Quality Sanity Gate (OpenCV)", h2_style))
    story.append(Paragraph(
        "Before an uploaded image touches the trained neural network, OpenCV executes two validation checks in under 15ms: (1) <b>Monochromatic Check:</b> Rejects non-radiological photos or selfies where channel variance <code>(|R-G| + |G-B| + |R-B|) / 3.0 &gt; 50.0</code>; (2) <b>Blur Check:</b> Rejects out-of-focus scans where <code>cv2.Laplacian(gray, cv2.CV_64F).var() &lt; 50.0</code>.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # =========================================================
    # SECTION 5: DATABASE ARCHITECTURE & SCHEMA
    # =========================================================
    story.append(Paragraph("5. Relational Database Design & Schema ERD", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "The relational schema is defined declaratively using SQLAlchemy ORM (<code>backend/app/db/models.py</code>). The database models establish full referential integrity, foreign key indexes, and bidirectional ORM relationships:",
        body_style
    ))

    db_details = [
        [Paragraph("Model / Table", table_header), Paragraph("Primary / Foreign Keys", table_header), Paragraph("Field Attributes & Types", table_header), Paragraph("Relational Role & Business Logic", table_header)],
        [Paragraph("<b>User</b><br/>(<code>users</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>Indexes: <code>phone</code>, <code>cnic</code>", table_cell), Paragraph("<code>name, phone (UQ), cnic (UQ), hashed_password, role, profile_pic, specialization, clinic_name, address, gender, age, token_mode, max_tokens, about, timetable, consultation_fee, used_access_code, created_at</code>", table_cell), Paragraph("Represents all human actors: Patients, Doctors, and Administrators. Stores demographic data, doctor credentials, and practice parameters.", table_cell)],
        [Paragraph("<b>Prediction</b><br/>(<code>predictions</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>FK: <code>user_id -&gt; users.id</code><br/>FK: <code>doctor_id -&gt; users.id</code>", table_cell), Paragraph("<code>image_path, result ('Normal'|'TB'|'Pneumonia'), confidence (Float), all_scores (JSON string), created_at</code>", table_cell), Paragraph("Stores every AI diagnostic event. Maintains dual ownership: patient owner and treating doctor. Preserves full probability distribution.", table_cell)],
        [Paragraph("<b>Appointment</b><br/>(<code>appointments</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>FK: <code>doctor_id -&gt; users.id</code><br/>FK: <code>patient_id -&gt; users.id</code>", table_cell), Paragraph("<code>booking_date, token_number, status ('pending'|'serving'|'completed'), fee_charged, patient_name_override, created_at</code>", table_cell), Paragraph("Manages clinic queue slots. Locks doctor's fee at time of booking. Supports walk-in patients via <code>patient_name_override</code>.", table_cell)],
        [Paragraph("<b>DoctorPatient</b><br/>(<code>doctor_patients</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>FK: <code>doctor_id -&gt; users.id</code><br/>FK: <code>patient_id -&gt; users.id</code>", table_cell), Paragraph("Association table for many-to-many relationship.", table_cell), Paragraph("Links registered patients to their treating doctors, enabling patient discovery and longitudinal tracking.", table_cell)],
        [Paragraph("<b>RegistrationRequest</b><br/>(<code>registration_requests</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>FK: <code>doctor_id -&gt; users.id</code>", table_cell), Paragraph("<code>name, phone, cnic, gender, age, booking_date, token_number, status, rejection_reason, created_at</code>", table_cell), Paragraph("Facilitates Guest Booking for unregistered patients. Holds unverified token requests until doctor approval.", table_cell)],
        [Paragraph("<b>SiteSettings</b><br/>(<code>site_settings</code>)", table_cell_bold), Paragraph("PK: <code>id</code><br/>Index: <code>setting_key (UQ)</code>", table_cell), Paragraph("<code>setting_key, setting_value</code>", table_cell), Paragraph("Key-value CMS store allowing administrators to dynamically alter contact numbers, addresses, emails, and hero banners.", table_cell)],
        [Paragraph("<b>ContactMessage</b><br/>(<code>contact_messages</code>)", table_cell_bold), Paragraph("PK: <code>id</code>", table_cell), Paragraph("<code>name, email, subject, message, is_read (0|1), created_at</code>", table_cell), Paragraph("Persists public inquiries submitted through the Contact Us form, accessible via the Admin inbox.", table_cell)],
    ]
    t_db_models = Table(db_details, colWidths=[80, 95, 145, 140])
    t_db_models.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_db_models)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Cascading Integrity & Cleanup Protocols:", h2_style))
    story.append(Paragraph(
        "To prevent database corruption and orphaned records, account deletion via <code>/api/admin/users/{id}</code> executes an atomic transaction that: (1) deletes all prediction records and unlinks raw image files from the <code>uploads/</code> directory, (2) purges all appointments where the user is patient or doctor, (3) removes registration requests and doctor-patient associations, and (4) deletes the user entity.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================
    # SECTION 6: FILE-BY-FILE REPOSITORY BREAKDOWN
    # =========================================================
    story.append(Paragraph("6. File-by-File Repository Breakdown & Architectural Map", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "Below is the complete architectural mapping of source code files across the backend and frontend codebases:",
        body_style
    ))

    repo_files = [
        [Paragraph("Path in Codebase", table_header), Paragraph("Primary Role & Internal Mechanics", table_header)],
        # Backend Files
        [Paragraph("<b>backend/run.py</b>", table_cell_bold), Paragraph("Entry point for ASGI server; initializes Uvicorn on host 0.0.0.0:8000 with auto-reload.", table_cell)],
        [Paragraph("<b>backend/app/main.py</b>", table_cell_bold), Paragraph("FastAPI app instantiation, CORS setup, security headers middleware, static file mounting with CORSStaticFiles.", table_cell)],
        [Paragraph("<b>backend/app/core/config.py</b>", table_cell_bold), Paragraph("Pydantic BaseSettings loading .env: DATABASE_URL, SECRET_KEY, REGISTRATION_KEYS, JWT expiry.", table_cell)],
        [Paragraph("<b>backend/app/db/database.py</b>", table_cell_bold), Paragraph("SQLAlchemy engine initialization, SessionLocal sessionmaker, and get_db() dependency generator.", table_cell)],
        [Paragraph("<b>backend/app/db/models.py</b>", table_cell_bold), Paragraph("Declarative SQLAlchemy ORM models: User, Prediction, Appointment, DoctorPatient, RegistrationRequest, SiteSettings, ContactMessage.", table_cell)],
        [Paragraph("<b>backend/app/api/auth_utils.py</b>", table_cell_bold), Paragraph("Cryptographic utilities: Bcrypt hashing/verification, create_access_token(), and get_current_user_from_token().", table_cell)],
        [Paragraph("<b>backend/app/api/routes.py</b>", table_cell_bold), Paragraph("Primary API router containing over 30 endpoints for authentication, AI predictions, doctor dashboard, and appointments.", table_cell)],
        [Paragraph("<b>backend/app/api/admin.py</b>", table_cell_bold), Paragraph("Administrative router: system KPIs, user CRUD with cascading deletions, site settings CMS, contact message management.", table_cell)],
        [Paragraph("<b>backend/app/api/websockets.py</b>", table_cell_bold), Paragraph("ConnectionManager broadcasting real-time queue update events over WebSocket connections.", table_cell)],
        [Paragraph("<b>backend/app/services/predict.py</b>", table_cell_bold), Paragraph("PyTorch DenseNet-121 inference service: loads chest_xray_densenet121.pth, applies transforms, and returns Softmax scores.", table_cell)],
        # Frontend Files
        [Paragraph("<b>frontend/src/App.jsx</b>", table_cell_bold), Paragraph("React root router, route definitions, SmartHome auto-redirector, and ProtectedRoute RBAC wrapper.", table_cell)],
        [Paragraph("<b>frontend/src/services/api.js</b>", table_cell_bold), Paragraph("Axios client configuration, Bearer token injection interceptor, global 401 redirect interceptor, API helper methods.", table_cell)],
        [Paragraph("<b>frontend/src/services/AuthContext.jsx</b>", table_cell_bold), Paragraph("React Context provider managing user state, login(), logout(), updateUser(), and token persistence.", table_cell)],
        [Paragraph("<b>frontend/src/pages/Patients.jsx</b>", table_cell_bold), Paragraph("Clinical patient directory: badge grid, live CNIC/Phone search, walk-in register modal, link modal, and full medical dossier.", table_cell)],
        [Paragraph("<b>frontend/src/pages/Payments.jsx</b>", table_cell_bold), Paragraph("Doctor financial analytics: collected consultation fees, completed appointment tallies, and revenue breakdowns.", table_cell)],
        [Paragraph("<b>frontend/src/pages/Predict.jsx</b>", table_cell_bold), Paragraph("AI diagnostic screening UI: file dropzone, live patient search, today's queue selector, and ResultCard render.", table_cell)],
        [Paragraph("<b>frontend/src/pages/TodayTokens.jsx</b>", table_cell_bold), Paragraph("Real-time OPD queue manager: next patient caller, FeeModal (full/half/free), walk-in token creator, and WebSocket sync.", table_cell)],
        [Paragraph("<b>frontend/src/pages/DoctorDashboard.jsx</b>", table_cell_bold), Paragraph("Doctor cockpit: linked patients list, Recharts area/pie disease distribution charts, appointment metrics, and practice summary.", table_cell)],
        [Paragraph("<b>frontend/src/pages/History.jsx</b>", table_cell_bold), Paragraph("Diagnostic archives: search filters, full image modal viewer, condition badges, and client-side A4 PDF medical report export.", table_cell)],
        [Paragraph("<b>frontend/src/pages/BookAppointment.jsx</b>", table_cell_bold), Paragraph("Patient booking interface: doctor directory browser, calendar date selection, and visual token slot selector.", table_cell)],
        [Paragraph("<b>frontend/src/pages/GuestBooking.jsx</b>", table_cell_bold), Paragraph("Unregistered patient portal to request appointments and check approval status by CNIC/phone.", table_cell)],
        [Paragraph("<b>frontend/src/pages/AdminDashboard.jsx</b>", table_cell_bold), Paragraph("Admin portal: platform stats, user management (role change/delete), contact messages inbox, and dynamic CMS settings.", table_cell)],
        [Paragraph("<b>frontend/src/pages/Profile.jsx</b>", table_cell_bold), Paragraph("Account and clinic settings: Monday-Sunday weekly timetable editor, consultation fee, token mode, and profile avatar.", table_cell)],
        [Paragraph("<b>frontend/src/components/UploadBox.jsx</b>", table_cell_bold), Paragraph("Drag-and-drop file upload component with instant image thumbnail preview and client-side format validation.", table_cell)],
        [Paragraph("<b>frontend/src/components/ResultCard.jsx</b>", table_cell_bold), Paragraph("Diagnostic result card displaying prediction badge, animated confidence bars, clinical advice, and print/export buttons.", table_cell)],
    ]
    t_repo = Table(repo_files, colWidths=[150, 310])
    t_repo.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_repo)
    story.append(PageBreak())

    # =========================================================
    # SECTION 7: FRONTEND PAGE-BY-PAGE DEEP DIVE
    # =========================================================
    story.append(Paragraph("7. Comprehensive Frontend Page-by-Page Architecture & Operation", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "This section provides an exhaustive analysis of every user interface page in the system, detailing its clinical purpose, interactive components, client-side validation rules, and backend communication endpoints.",
        body_style
    ))

    # 7.1 Patients.jsx
    story.append(Paragraph("7.1 Patients.jsx — The Clinical Patient Directory & Dossier", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/Patients.jsx</code> (53.3 KB) | <b>Role:</b> Doctor &amp; Admin",
        h3_style
    ))
    story.append(Paragraph(
        "<code>Patients.jsx</code> serves as the doctor's comprehensive patient management cockpit. It displays all patients linked to the doctor in an animated, responsive badge matrix. Key functionalities include:",
        body_style
    ))
    story.append(Paragraph("• <b>Live Multi-Field Search & Date Filter:</b> Instant filtering across Name, 13-digit CNIC, and Phone number. Includes a date-tracker card toggling between 'Today\\'s Load' and 'All-Time Registry'.", bullet_style))
    story.append(Paragraph("• <b>Walk-in Patient Registration Modal (handleRegister):</b> Enforces strict identity standards: CNIC must be exactly 13 digits (<code>/^\d{13}$/</code>) and Phone must be an 11-digit mobile starting with '03' (<code>/^03\d{9}$/</code>). If the patient already exists in the database, it automatically catches the 400 error and switches directly into 'Linking Mode'.", bullet_style))
    story.append(Paragraph("• <b>'Link Existing Patient' Modal (handleLink):</b> Searches the hospital directory by CNIC/Phone and creates a record in <code>doctor_patients</code>, associating existing accounts with the doctor.", bullet_style))
    story.append(Paragraph("• <b>Patient Medical Dossier Modal:</b> Clicking any patient badge opens a full overlay detailing demographics, CNIC, phone, registration date, and a complete <b>Clinical Screening History</b> timeline. Each past scan displays an X-ray thumbnail, date, condition badge (Normal / TB / Pneumonia), and percentage score. Direct action buttons allow the doctor to immediately <b>'Start AI Screening'</b> (pre-filling <code>Predict.jsx</code>) or <b>'Book Token'</b>.", bullet_style))
    story.append(Paragraph("• <b>Card Hover Quick-Actions:</b> Direct buttons on each tile to Edit patient profile (calls <code>PUT /api/doctor/update-patient/{id}</code>), Remove/Unlink patient (calls <code>DELETE /api/doctor/unlink-patient/{id}</code>), or Book Token.", bullet_style))

    # 7.2 Payments.jsx
    story.append(Paragraph("7.2 Payments.jsx — Clinic Financials & Fee Tracking", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/Payments.jsx</code> (10.8 KB) | <b>Role:</b> Doctor &amp; Admin",
        h3_style
    ))
    story.append(Paragraph(
        "<code>Payments.jsx</code> tracks doctor revenues and consultation fee collections. It calculates earnings exclusively from completed appointments:",
        body_style
    ))
    story.append(Paragraph("• <b>Financial KPI Cards:</b> Three real-time summary cards: <i>All-Time Revenue</i> (cumulative PKR collected), <i>This Month\\'s Revenue</i> (current calendar month total), and <i>Today\\'s Earnings</i>.", bullet_style))
    story.append(Paragraph("• <b>Grouped Transaction History Table:</b> Chronological ledger grouping consultations by date with daily totals (e.g. <code>📅 Today (Daily Total: Rs. 14,000)</code>). Displays patient name, phone, token number, completion badge, and exact fee collected.", bullet_style))
    story.append(Paragraph("• <b>Filtering & Search:</b> Live date-picker filter and patient name search with instant 'Clear Filters' capability.", bullet_style))
    story.append(Paragraph("• <b>API Integration:</b> Queries <code>GET /api/doctor/payments</code> with JWT Bearer authentication.", bullet_style))

    # 7.3 Predict.jsx
    story.append(Paragraph("7.3 Predict.jsx — AI Diagnostic Screening Workspace", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/Predict.jsx</code> (11.5 KB) | <b>Role:</b> Patient, Doctor, Admin",
        h3_style
    ))
    story.append(Paragraph(
        "The core diagnostic center where chest X-rays are uploaded and evaluated by the neural network:",
        body_style
    ))
    story.append(Paragraph("• <b>Dual Mode Setup:</b> For patients, it provides a simple drag-and-drop dropzone. For doctors, it features a live patient identity verification search bar and a dropdown selector populated with today\\'s scheduled OPD patients.", bullet_style))
    story.append(Paragraph("• <b>Computer Vision Quality Sanity Alerts:</b> Catches server-side OpenCV 400 responses: alerts the user if an uploaded image is a colored photo/selfie (non-monochromatic) or if the image is too blurry/out-of-focus (Laplacian variance &lt; 50).", bullet_style))
    story.append(Paragraph("• <b>ResultCard.jsx Presentation:</b> Renders the primary condition banner, animated probability bars for Normal, TB, and Pneumonia, clinical triage guidance, and full-resolution print capabilities.", bullet_style))
    story.append(PageBreak())

    # 7.4 TodayTokens.jsx
    story.append(Paragraph("7.4 TodayTokens.jsx — Live OPD Queue & Waiting Room Cockpit", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/TodayTokens.jsx</code> (23.5 KB) | <b>Role:</b> Doctor &amp; Admin",
        h3_style
    ))
    story.append(Paragraph(
        "Manages active clinic sessions and real-time waiting room token flow:",
        body_style
    ))
    story.append(Paragraph("• <b>Queue Status Progression:</b> Manages appointments transitioning through <code>pending</code> &rarr; <code>serving</code> &rarr; <code>completed</code>.", bullet_style))
    story.append(Paragraph("• <b>FeeModal Component:</b> When a doctor marks an appointment complete, an interactive popup presents presets: <i>Full Fee</i> (standard rate), <i>Half Fee</i> (discounted follow-up), <i>Free (Rs. 0)</i> (waived fee), or <i>Custom Fee</i>. The confirmed fee is persisted to the database.", bullet_style))
    story.append(Paragraph("• <b>Shift Controls:</b> Includes <i>'Move to Tomorrow'</i> (reschedules an individual patient with the next available token) and <i>'End Shift'</i> (moves all remaining pending patients to tomorrow in bulk).", bullet_style))
    story.append(Paragraph("• <b>Print Token Slip:</b> Generates a formatted physical token receipt containing doctor name, clinic address, patient details, date, and token number.", bullet_style))
    story.append(Paragraph("• <b>Real-Time Synchronization:</b> Combines a 15-second background poll with a live WebSocket listener (<code>/api/ws/queue</code>) to push status updates instantly to waiting room monitors.", bullet_style))

    # 7.5 DoctorDashboard.jsx
    story.append(Paragraph("7.5 DoctorDashboard.jsx — Doctor Operations Command Center", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/DoctorDashboard.jsx</code> (60.6 KB) | <b>Role:</b> Doctor &amp; Admin",
        h3_style
    ))
    story.append(Paragraph(
        "The primary landing dashboard for authenticated medical practitioners:",
        body_style
    ))
    story.append(Paragraph("• <b>Clinical Analytics & Recharts Visualization:</b> Renders Area Charts tracking patient inflow trends and Pie Charts displaying the diagnostic breakdown of Normal vs TB vs Pneumonia cases.", bullet_style))
    story.append(Paragraph("• <b>Active Queue Monitor:</b> Displays the currently serving token and the upcoming queue directly on the dashboard home screen.", bullet_style))
    story.append(Paragraph("• <b>Embedded Diagnostic Quick-Scan:</b> Allows doctors to analyze an X-ray on the spot without leaving the dashboard.", bullet_style))
    story.append(Paragraph("• <b>Recent Screenings Feed:</b> Chronological list of latest diagnoses with image thumbnails and instant report links.", bullet_style))

    # 7.6 History.jsx
    story.append(Paragraph("7.6 History.jsx — Diagnostic Archives & PDF Report Generator", h2_style))
    story.append(Paragraph(
        "<b>File Path:</b> <code>frontend/src/pages/History.jsx</code> (58.3 KB) | <b>Role:</b> Patient, Doctor, Admin",
        h3_style
    ))
    story.append(Paragraph(
        "Comprehensive screening history and clinical documentation generator:",
        body_style
    ))
    story.append(Paragraph("• <b>Role-Adaptive View:</b> Patients view their personal chronological scans; doctors view scans across all their registered patients, grouped neatly by patient profile.", bullet_style))
    story.append(Paragraph("• <b>Full-Resolution Radiograph Viewer:</b> Modal inspection tool allowing doctors to view the original uncompressed radiograph with contrast enhancement to detect subtle lung infiltrates.", bullet_style))
    story.append(Paragraph("• <b>Client-Side A4 Medical Report Generation (downloadPDF):</b> Uses <code>html2pdf.js</code> with CORS-injected image headers to compile an official hospital diagnostic report. Formatted strictly for A4 print dimensions with hospital header, patient demographics, AI confidence meters, and physician signature space.", bullet_style))
    story.append(Paragraph("• <b>Record Management:</b> Doctors can permanently delete erroneous scans, triggering cascading database deletion and disk image cleanup.", bullet_style))

    # 7.7 BookAppointment.jsx & GuestBooking.jsx
    story.append(Paragraph("7.7 BookAppointment.jsx & GuestBooking.jsx — OPD Appointment Engines", h2_style))
    story.append(Paragraph(
        "<b>File Paths:</b> <code>BookAppointment.jsx</code> (68.6 KB) &amp; <code>GuestBooking.jsx</code> (26.9 KB)",
        h3_style
    ))
    story.append(Paragraph("• <b>BookAppointment.jsx (Registered Users):</b> Patients select a doctor from the clinical directory, pick an upcoming date, and view an interactive visual token matrix. Booked slots appear locked; available slots can be reserved with one click. Locks consultation fee at booking time.", bullet_style))
    story.append(Paragraph("• <b>GuestBooking.jsx (Public / Unregistered):</b> Allows first-time walk-in patients without an account to request an appointment slot. Submits a registration request to the doctor's queue (<code>registration_requests</code> table) and provides a live status inquiry tool checking approval by CNIC or Phone.", bullet_style))

    # 7.8 AdminDashboard.jsx & Profile.jsx
    story.append(Paragraph("7.8 AdminDashboard.jsx & Profile.jsx — Management & Configuration", h2_style))
    story.append(Paragraph(
        "<b>File Paths:</b> <code>AdminDashboard.jsx</code> (41.6 KB) &amp; <code>Profile.jsx</code> (33.6 KB)",
        h3_style
    ))
    story.append(Paragraph("• <b>AdminDashboard.jsx:</b> Platform governance portal. Features system KPI counters, full user directory management (role elevation/demotion, cascading account deletion), dynamic CMS site settings editor (contact numbers, addresses, hero banners), and contact form message inbox.", bullet_style))
    story.append(Paragraph("• <b>Profile.jsx:</b> Personal and clinic practice settings. Doctors configure their standard consultation fee, token mode (Fixed daily limit vs Dynamic), weekly timetable (Monday-Sunday opening/closing hours), specialization, clinic address, and biography.", bullet_style))

    # 7.9 Authentication & Informational Pages
    story.append(Paragraph("7.9 Authentication & Informational Pages", h2_style))
    story.append(Paragraph("• <b>Login.jsx (5.0 KB):</b> Dual-identifier authentication supporting either Phone number or CNIC paired with password.", bullet_style))
    story.append(Paragraph("• <b>Register.jsx (9.8 KB):</b> Dual-role registration. Doctor signups require authorized medical access codes validated against <code>REGISTRATION_KEYS</code>.", bullet_style))
    story.append(Paragraph("• <b>ForgotPassword.jsx (5.6 KB):</b> Identity verification matching Phone + CNIC before permitting password resets.", bullet_style))
    story.append(Paragraph("• <b>Home.jsx, About.jsx, Contact.jsx, Terms.jsx, Privacy.jsx:</b> Responsive public landing pages with disease epidemiology, medical disclaimers, and interactive contact forms.", bullet_style))
    story.append(Spacer(1, 10))

    # =========================================================
    # SECTION 8: ROLE-BASED PORTALS & FUNCTIONAL WORKFLOWS
    # =========================================================
    story.append(Paragraph("8. Role-Based Portals & Functional Workflows", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "The system enforces strict role-based separation of concerns across three user classes:",
        body_style
    ))

    story.append(Paragraph("8.1 Patient Experience & Workflow", h2_style))
    story.append(Paragraph("• <b>Dual-Identity Registration:</b> Patients register with Name, Phone, and National ID (CNIC). Login accepts either Phone or CNIC paired with their password.", bullet_style))
    story.append(Paragraph("• <b>Self-Screening Upload:</b> Patients upload their CXR scan in <code>/predict</code>. The AI renders instant triage results with visual confidence meters and recommends whether to consult a pulmonologist.", bullet_style))
    story.append(Paragraph("• <b>Screening Archive:</b> In <code>/history</code>, patients can review past diagnostic scans, filter by date or result (Normal, TB, Pneumonia), and view high-resolution image previews.", bullet_style))
    story.append(Paragraph("• <b>Appointment Booking:</b> In <code>/book</code>, patients browse doctors, select dates, view booked vs free tokens, and instantly lock a slot. Token numbers are issued consecutively.", bullet_style))

    story.append(Paragraph("8.2 Doctor Workspace & Clinical Workflow", h2_style))
    story.append(Paragraph("• <b>Authorized Registration:</b> Doctors can only register by supplying a valid access code matching the comma-separated <code>REGISTRATION_KEYS</code> environment variable.", bullet_style))
    story.append(Paragraph("• <b>In-Clinic Diagnostic Workspace:</b> Doctors screen X-rays on behalf of patients. An intelligent live search field verifies patients by CNIC or Phone in real time, automatically associating the scan with that patient's permanent record.", bullet_style))
    story.append(Paragraph("• <b>Today's Live OPD Queue:</b> In <code>/today-tokens</code>, doctors manage their active clinic queue. Doctors can advance tokens to <b>Serving</b>, mark them <b>Completed</b>, check in patients, or move overflow patients to tomorrow's queue.", bullet_style))
    story.append(Paragraph("• <b>Walk-in & Family Tokens:</b> Doctors can assign appointments with a <code>patient_name_override</code> to cater to walk-in patients or families sharing a single phone number.", bullet_style))
    story.append(Paragraph("• <b>Practice & Token Settings:</b> In <code>/profile</code>, doctors configure their consultation fees, token mode (fixed vs dynamic daily limits), timetable, clinic address, and biography.", bullet_style))
    story.append(Paragraph("• <b>Financial Tracking:</b> Accessible via <code>/payments</code>, providing analytics on total collected consultation fees, daily revenues, and completed patient tallies.", bullet_style))

    story.append(Paragraph("8.3 Administrator Management & CMS Operations", h2_style))
    story.append(Paragraph("• <b>Executive KPI Statistics:</b> Total registered users, doctor count, patient count, total AI predictions executed, and total booked appointments.", bullet_style))
    story.append(Paragraph("• <b>User Directory Management:</b> Ability to view all users, edit demographic data, promote/demote user roles (Patient &harr; Doctor &harr; Admin), and perform clean deletions.", bullet_style))
    story.append(Paragraph("• <b>Dynamic Site Content CMS:</b> Real-time configuration of support emails, hotline numbers, WhatsApp links, physical clinic addresses, and landing page hero copy without code changes.", bullet_style))
    story.append(Paragraph("• <b>Contact Message Center:</b> View, mark as read, and delete inquiries submitted through the public Contact page.", bullet_style))
    story.append(PageBreak())

    # =========================================================
    # SECTION 9: RESTFUL API & WEBSOCKET ENDPOINT DIRECTORY
    # =========================================================
    story.append(Paragraph("9. Comprehensive RESTful API & WebSocket Endpoint Directory", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "The following matrix documents all endpoints provided by the backend API routers (<code>routes.py</code> and <code>admin.py</code>):",
        body_style
    ))

    api_matrix = [
        [Paragraph("Endpoint & HTTP Method", table_header), Paragraph("Authorization", table_header), Paragraph("Payload / Parameters", table_header), Paragraph("Behavior & Clinical Operation", table_header)],
        # Authentication
        [Paragraph("POST /api/auth/register", table_cell_bold), Paragraph("Public", table_cell), Paragraph("JSON: name, phone, cnic, password, role, access_code", table_cell), Paragraph("Registers user; checks uniqueness; validates doctor access code; hashes password.", table_cell)],
        [Paragraph("POST /api/auth/login", table_cell_bold), Paragraph("Public", table_cell), Paragraph("JSON: identifier, password", table_cell), Paragraph("Authenticates via phone/CNIC; returns signed JWT Bearer token and user profile.", table_cell)],
        [Paragraph("POST /api/auth/update-profile", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Multipart Form-Data", table_cell), Paragraph("Updates user details, clinic address, fees, timetable, and profile photo.", table_cell)],
        [Paragraph("POST /api/auth/reset-password", table_cell_bold), Paragraph("Public", table_cell), Paragraph("JSON: phone, cnic, new_password", table_cell), Paragraph("Verifies phone and CNIC identity match before updating hashed password.", table_cell)],
        # Diagnostic & Predictions
        [Paragraph("POST /api/predict", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Multipart: file (image), patient_identifier", table_cell), Paragraph("Runs OpenCV sanity checks & DenseNet121 inference; saves record to DB.", table_cell)],
        [Paragraph("GET /api/patient/history", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Bearer Token", table_cell), Paragraph("Fetches chronological screening history with image URLs and confidence scores.", table_cell)],
        [Paragraph("DELETE /api/doctor/delete-prediction/{id}", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("Path: prediction_id", table_cell), Paragraph("Deletes screening entry from DB and unlinks image file from disk storage.", table_cell)],
        [Paragraph("POST /api/doctor/link-prediction-to-patient", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("JSON: prediction_id, patient_id", table_cell), Paragraph("Reassigns an unlinked screening record to a specific patient's profile.", table_cell)],
        # Doctor Operations
        [Paragraph("GET /api/doctor/search-patient", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("Query: ?identifier=", table_cell), Paragraph("Searches patient by CNIC or phone; returns existence and demographic data.", table_cell)],
        [Paragraph("POST /api/doctor/register-patient", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("Multipart / Form-Data", table_cell), Paragraph("Creates patient record on-spot during clinic visit and links to doctor.", table_cell)],
        [Paragraph("GET /api/doctor/dashboard", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("Bearer Token", table_cell), Paragraph("Returns summary metrics, today's queue count, and linked patient registry.", table_cell)],
        [Paragraph("GET /api/doctor/payments", table_cell_bold), Paragraph("Doctor Only", table_cell), Paragraph("Bearer Token", table_cell), Paragraph("Computes total earned revenue, completed appointment counts, and daily fees.", table_cell)],
        # Appointments & Queue
        [Paragraph("GET /api/doctors/list", table_cell_bold), Paragraph("Public", table_cell), Paragraph("None", table_cell), Paragraph("Returns list of registered doctors with specialty, fee, and clinic details.", table_cell)],
        [Paragraph("GET /api/appointments/booked-tokens", table_cell_bold), Paragraph("Public", table_cell), Paragraph("Query: ?doctor_id=&date=", table_cell), Paragraph("Returns array of allocated token integers for specific doctor and date.", table_cell)],
        [Paragraph("POST /api/appointments/book", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("JSON: doctor_id, date, token_number", table_cell), Paragraph("Reserves appointment slot; locks current fee; triggers WebSocket queue push.", table_cell)],
        [Paragraph("GET /api/appointments/doctor-today", table_cell_bold), Paragraph("Doctor/Admin", table_cell), Paragraph("Query: ?date=", table_cell), Paragraph("Returns all scheduled patient tokens for the doctor's active clinic session.", table_cell)],
        [Paragraph("POST /api/appointments/update-status", table_cell_bold), Paragraph("Doctor/Admin", table_cell), Paragraph("JSON: appointment_id, status", table_cell), Paragraph("Updates token status (pending/serving/completed); broadcasts WS update.", table_cell)],
        [Paragraph("POST /api/appointments/move-to-tomorrow", table_cell_bold), Paragraph("Doctor/Admin", table_cell), Paragraph("JSON: appointment_id", table_cell), Paragraph("Reschedules token to next date with auto-allocated sequential token number.", table_cell)],
        [Paragraph("WS /api/ws/queue", table_cell_bold), Paragraph("Public", table_cell), Paragraph("Bidirectional WS connection", table_cell), Paragraph("Live socket delivering queue advancement events to waiting room displays.", table_cell)],
        # Admin Operations
        [Paragraph("GET /api/admin/stats", table_cell_bold), Paragraph("Admin Only", table_cell), Paragraph("Bearer Token", table_cell), Paragraph("Aggregates system-wide analytics: users, doctors, predictions, appointments.", table_cell)],
        [Paragraph("GET /api/admin/users", table_cell_bold), Paragraph("Admin Only", table_cell), Paragraph("Bearer Token", table_cell), Paragraph("Returns full user directory excluding hashed passwords.", table_cell)],
        [Paragraph("POST /api/admin/users/{id}/role", table_cell_bold), Paragraph("Admin Only", table_cell), Paragraph("JSON: role ('patient'|'doctor'|'admin')", table_cell), Paragraph("Promotes or demotes user role; prevents admin self-revocation.", table_cell)],
        [Paragraph("DELETE /api/admin/users/{id}", table_cell_bold), Paragraph("Admin Only", table_cell), Paragraph("Path: user_id", table_cell), Paragraph("Performs cascading deletion across predictions, appointments, and disk files.", table_cell)],
        [Paragraph("GET /api/admin/settings/contact", table_cell_bold), Paragraph("Public / Admin", table_cell), Paragraph("None", table_cell), Paragraph("Fetches dynamic site settings (contact numbers, emails, addresses, banners).", table_cell)],
        [Paragraph("PUT /api/admin/settings/contact", table_cell_bold), Paragraph("Admin Only", table_cell), Paragraph("JSON: key-value settings", table_cell), Paragraph("Updates dynamic CMS settings persisted in site_settings table.", table_cell)],
    ]
    t_api_matrix = Table(api_matrix, colWidths=[115, 70, 125, 150])
    t_api_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_api_matrix)
    story.append(PageBreak())

    # =========================================================
    # SECTION 10: STEP-BY-STEP TRANSACTION LIFECYCLES
    # =========================================================
    story.append(Paragraph("10. Step-by-Step Transaction Lifecycles", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "To illustrate the runtime execution path, this section traces the two primary clinical operations in the system:",
        body_style
    ))

    story.append(Paragraph("10.1 Transaction 1: AI Diagnostic Screening Execution Trace", h2_style))
    tx1_steps = [
        Paragraph("<b>1. Image Selection:</b> User drops CXR image onto <code>UploadBox.jsx</code>. File is verified client-side for MIME type (image/jpeg, image/png).", bullet_style),
        Paragraph("<b>2. Diagnostic Metadata Binding:</b> If doctor is screening, doctor inputs patient CNIC/phone in <code>Predict.jsx</code>. Asynchronous call to <code>/api/doctor/search-patient</code> confirms patient record.", bullet_style),
        Paragraph("<b>3. Multipart HTTP Dispatch:</b> <code>runAnalysis()</code> constructs <code>FormData</code>, appends file and patient_identifier, and issues POST request to <code>/api/predict</code> with JWT Bearer header.", bullet_style),
        Paragraph("<b>4. File Persistence:</b> FastAPI receives stream, validates extension, generates UUID filename (e.g. <code>f47ac10b-...png</code>), and saves bytes into <code>uploads/</code>.", bullet_style),
        Paragraph("<b>5. OpenCV Quality Gate:</b> OpenCV inspects image. If channel differences &gt; 50.0 (non-grayscale photo) or Laplacian variance &lt; 50.0 (blurry scan), file is unlinked and HTTP 400 exception is returned.", bullet_style),
        Paragraph("<b>6. PyTorch Inference:</b> Image is resized to 224x224, normalized via ImageNet parameters, and passed through DenseNet-121. Softmax produces probability scores: <code>{ 'Normal': 0.04, 'Pneumonia': 0.02, 'TB': 0.94 }</code>.", bullet_style),
        Paragraph("<b>7. Database Commitment:</b> Record is inserted into <code>predictions</code> table with result, confidence, all_scores, user_id, and doctor_id.", bullet_style),
        Paragraph("<b>8. Visual Presentation:</b> <code>ResultCard.jsx</code> displays animated confidence bars, clinical recommendations, and options to print or view full-screen.", bullet_style),
    ]
    for s in tx1_steps: story.append(s)

    story.append(Spacer(1, 8))
    story.append(Paragraph("10.2 Transaction 2: OPD Token Booking & Live Waiting Room Broadcast Trace", h2_style))
    tx2_steps = [
        Paragraph("<b>1. Availability Fetch:</b> Patient navigates to <code>BookAppointment.jsx</code>. Component queries <code>/api/appointments/booked-tokens?doctor_id=X&date=YYYY-MM-DD</code>.", bullet_style),
        Paragraph("<b>2. Interactive Slot Selection:</b> Booked tokens appear greyed out; available tokens appear clickable. Patient selects Token #12.", bullet_style),
        Paragraph("<b>3. Reservation Request:</b> Client dispatches POST to <code>/api/appointments/book</code> with selected slot and doctor ID.", bullet_style),
        Paragraph("<b>4. Atomic Record Locking:</b> Server checks token conflict. If slot is open, appointment record is created with <code>status = 'pending'</code> and doctor's current fee is locked into <code>fee_charged</code>.", bullet_style),
        Paragraph("<b>5. WebSocket Event Broadcast:</b> Route triggers <code>manager.broadcast({ 'action': 'queue_update', 'doctor_id': X, 'date': 'YYYY-MM-DD' })</code>.", bullet_style),
        Paragraph("<b>6. Real-Time Waiting Room Update:</b> All connected clinic monitors and patient handsets receive payload, immediately re-fetching queue state without user refresh.", bullet_style),
        Paragraph("<b>7. Doctor Consultation:</b> Doctor opens <code>TodayTokens.jsx</code>, clicks 'Serve', advancing status to <code>serving</code>, triggering another WebSocket broadcast.", bullet_style),
    ]
    for s in tx2_steps: story.append(s)
    story.append(PageBreak())

    # =========================================================
    # SECTION 11: DEPLOYMENT & TROUBLESHOOTING GUIDE
    # =========================================================
    story.append(Paragraph("11. Deployment, Environment Configuration & Troubleshooting", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=8))

    story.append(Paragraph(
        "This section provides complete operational guidance for setting up, running, and troubleshooting the platform in local and production environments.",
        body_style
    ))

    story.append(Paragraph("11.1 Environment Variables Reference (.env)", h2_style))
    env_vars = [
        [Paragraph("Variable Name", table_header), Paragraph("Default Value / Example", table_header), Paragraph("Operational Purpose", table_header)],
        [Paragraph("<b>DATABASE_URL</b>", table_cell_bold), Paragraph("<code>postgresql://postgres:pass@localhost:5432/tb_pneumonia_db</code>", table_cell), Paragraph("Database connection string. Supports PostgreSQL and SQLite (e.g. <code>sqlite:///./medical_db.sqlite</code>).", table_cell)],
        [Paragraph("<b>SECRET_KEY</b>", table_cell_bold), Paragraph("<code>your_super_secret_key_change_in_prod</code>", table_cell), Paragraph("Cryptographic key used to sign HS256 JWT access tokens.", table_cell)],
        [Paragraph("<b>ALGORITHM</b>", table_cell_bold), Paragraph("<code>HS256</code>", table_cell), Paragraph("Symmetric encryption algorithm for JWT encoding and decoding.", table_cell)],
        [Paragraph("<b>ACCESS_TOKEN_EXPIRE_MINUTES</b>", table_cell_bold), Paragraph("<code>10080</code> (7 days)", table_cell), Paragraph("Token lifespan before requiring re-authentication.", table_cell)],
        [Paragraph("<b>REGISTRATION_KEYS</b>", table_cell_bold), Paragraph("<code>DOC123,PULMO2024,1002,1003</code>", table_cell), Paragraph("Comma-separated medical access codes authorized for Doctor account creation.", table_cell)],
        [Paragraph("<b>VITE_API_URL</b> (Frontend)", table_cell_bold), Paragraph("<code>http://localhost:8000</code>", table_cell), Paragraph("Base URL pointing React client to FastAPI server.", table_cell)],
    ]
    t_env = Table(env_vars, colWidths=[140, 160, 160])
    t_env.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_env)
    story.append(Spacer(1, 4))

    story.append(Paragraph("11.2 Step-by-Step Local Execution", h2_style))
    story.append(Paragraph("<b>Backend API:</b> <code>cd backend &amp;&amp; pip install -r requirements.txt &amp;&amp; python run.py</code> (Port 8000)<br/>"
                           "<b>Frontend Client:</b> <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run dev</code> (Port 5173)<br/>"
                           "<b>Docker Compose:</b> <code>cd docker &amp;&amp; docker-compose up --build -d</code> (Automated Full Cluster)", body_style))
    story.append(Spacer(1, 4))

    story.append(Paragraph("11.3 Common Operational Issues & Prescribed Solutions", h2_style))

    troubleshoot_data = [
        [Paragraph("Symptom / Error", table_header), Paragraph("Root Cause", table_header), Paragraph("Prescribed Solution", table_header)],
        [Paragraph("<b>CORS Error in Browser</b><br/><code>Access to XMLHttpRequest blocked</code>", table_cell_bold), Paragraph("Frontend origin missing from FastAPI CORSMiddleware.", table_cell), Paragraph("Verify <code>http://localhost:5173</code> is in <code>allow_origins</code> in <code>backend/app/main.py</code>.", table_cell)],
        [Paragraph("<b>Invalid Access Code on Register</b>", table_cell_bold), Paragraph("Entered access code does not match REGISTRATION_KEYS.", table_cell), Paragraph("Check <code>.env</code> in backend or use valid code (e.g. <code>1002</code>, <code>DOC123</code>).", table_cell)],
        [Paragraph("<b>'Image is too blurry' HTTP 400</b>", table_cell_bold), Paragraph("Laplacian variance of uploaded image is &lt; 50.0.", table_cell), Paragraph("Upload a clear, high-resolution, focused chest X-ray image without camera shake.", table_cell)],
        [Paragraph("<b>'Invalid image format' HTTP 400</b>", table_cell_bold), Paragraph("Color differential check &gt; 50.0 (non-grayscale photo).", table_cell), Paragraph("Upload an authentic medical radiograph instead of a selfie or color photograph.", table_cell)],
        [Paragraph("<b>Database Connection Refused</b>", table_cell_bold), Paragraph("PostgreSQL service not running on port 5432.", table_cell), Paragraph("Start PostgreSQL service or switch <code>DATABASE_URL</code> to SQLite fallback: <code>sqlite:///./medical_db.sqlite</code>.", table_cell)],
    ]
    t_trouble = Table(troubleshoot_data, colWidths=[120, 150, 190])
    t_trouble.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg])
    ]))
    story.append(t_trouble)
    story.append(Spacer(1, 6))

    final_signoff = [
        [Paragraph("<b>Engineering Signoff & Concluding Statement:</b> The TB & Pneumonia AI Medical Screening System is fully assembled, validated, and documented. This comprehensive technical report serves as the complete academic and operational guide for evaluators, software engineers, and clinical stakeholders.", callout_text)]
    ]
    t_signoff = Table(final_signoff, colWidths=[460])
    t_signoff.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), success_bg),
        ('BOX', (0,0), (-1,-1), 1, success_border),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(t_signoff)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated comprehensive PDF: {filename}")

if __name__ == '__main__':
    target_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "TB_Pneumonia_AI_System_Complete_Documentation.pdf")
    build_pdf(target_path)
