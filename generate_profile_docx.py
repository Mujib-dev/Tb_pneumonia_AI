import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_template_doc(output_path, project_title="PneumoTB AI"):
    doc = docx.Document()

    # Page Margins: 0.75 in (54 pt) all around to match the single-page/two-page clean flyer layout
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Palette matching screenshot
    PRIMARY_TEAL = RGBColor(14, 74, 96)      # #0E4A60 (Dark Teal / Navy for Headings & Title)
    ACCENT_TEAL = RGBColor(14, 116, 144)     # #0E7490 (Medium Cyan/Teal for Subtitle & Bullets)
    DARK_SLATE = RGBColor(30, 41, 59)        # #1E293B (Bold feature names)
    BODY_COLOR = RGBColor(51, 65, 85)        # #334155 (Clean readable body text)
    BAR_COLOR = RGBColor(71, 85, 105)        # Slate for the vertical bar

    # 1. Title Block (Centered)
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)

    # Stylized vertical bar
    r_bar = p_title.add_run("| ")
    r_bar.bold = True
    r_bar.font.name = "Arial"
    r_bar.font.size = Pt(26)
    r_bar.font.color.rgb = ACCENT_TEAL

    r_title = p_title.add_run(project_title)
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(24)
    r_title.font.color.rgb = PRIMARY_TEAL

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)

    r_sub = p_sub.add_run("Integrated Tuberculosis and Pneumonia Screening & Clinic Workflow System")
    r_sub.italic = True
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(10.5)
    r_sub.font.color.rgb = ACCENT_TEAL

    # Helper function for section headings
    def add_heading(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.bold = True
        r.font.name = "Arial"
        r.font.size = Pt(13)
        r.font.color.rgb = PRIMARY_TEAL
        return p

    # Helper function for body paragraphs
    def add_body(runs_data):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        for text, is_bold in runs_data:
            r = p.add_run(text)
            r.bold = is_bold
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.color.rgb = DARK_SLATE if is_bold else BODY_COLOR
        return p

    # Helper function for key features bullet
    def add_feature_bullet(feature_name, description):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.2)
        p.paragraph_format.first_line_indent = Inches(-0.2)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3.5)
        p.paragraph_format.line_spacing = 1.12

        # Teal bullet dot
        r_bullet = p.add_run("• ")
        r_bullet.bold = True
        r_bullet.font.name = "Arial"
        r_bullet.font.size = Pt(10)
        r_bullet.font.color.rgb = ACCENT_TEAL

        # Feature title (bold)
        r_name = p.add_run(f"{feature_name}: ")
        r_name.bold = True
        r_name.font.name = "Arial"
        r_name.font.size = Pt(9.5)
        r_name.font.color.rgb = DARK_SLATE

        # Feature description (regular)
        r_desc = p.add_run(description)
        r_desc.font.name = "Arial"
        r_desc.font.size = Pt(9.5)
        r_desc.font.color.rgb = BODY_COLOR
        return p

    # --- SECTION 1: Project Overview ---
    add_heading("Project Overview")
    add_body([
        ("PneumoTB AI is a deep learning-based medical imaging and clinic management system developed by ", False),
        ("Mujib Ur Rahman and Akhtar Shah", True),
        (" as their Final Year Project (FYP) for the BS Software Engineering program at the University of Swat in 2026, under the supervision of ", False),
        ("Prof. Kiramat Rahman, Professor", True),
        (". The platform integrates automated chest radiograph classification (Normal, Tuberculosis, and Pneumonia), Explainable AI (Grad-CAM) lesion visualization, and real-time outpatient department (OPD) queue token orchestration into a single clinical workflow, enabling medical practitioners and healthcare facilities to screen patients rapidly, verify diagnostic evidence, manage appointments, and track patient history efficiently.", False)
    ])

    # --- SECTION 2: Key Features ---
    add_heading("Key Features")
    features = [
        ("Automated Radiograph Classification", 
         "A fine-tuned DenseNet-121 convolutional neural network trained on 30,000 balanced chest radiographs classifies scans into Normal, Tuberculosis, and Pneumonia categories with 96.65% diagnostic accuracy and 0.988 ROC-AUC."),
        ("Explainable AI (Grad-CAM)", 
         "Native gradient-weighted class activation mapping highlights pathological thoracic regions (such as apical cavitations or consolidation) directly on radiographs to support clinician trust and validation."),
        ("Pre-Inference Quality Sanity Gate", 
         "Automated dual-stage OpenCV algorithms analyze RGB chromatic variance and Laplacian blur in under 15ms, intercepting non-radiological photos, corrupted files, and blurred scans before model inference."),
        ("Real-Time OPD Token Queue", 
         "WebSocket-powered live queue synchronization broadcasts real-time token status updates between doctor consultation rooms, patient devices, and waiting hall displays without manual page refreshes."),
        ("Multi-Role Accounts & Access Control", 
         "Secure authentication and role-based access control (RBAC) powered by OAuth2 and JWT tokens provide tailored workspaces for patients, doctors, and hospital administrators."),
        ("Doctor Consultation Panel", 
         "Doctor-side tools allow clinicians to inspect uploaded X-rays and Grad-CAM overlays, review diagnostic confidence scores, modify diagnoses, prescribe treatments, and log clinical notes."),
        ("Patient Tele-Radiology Workspace", 
         "Patients can book consultation tokens, upload chest X-rays, track real-time queue position, and access longitudinal diagnostic reports securely."),
        ("DICOM PACS Gateway Integration", 
         "Simulated medical imaging network integration using standard DICOM protocols (pydicom, C-STORE/C-ECHO) facilitates interoperability with hospital radiological archives."),
        ("Administrative Analytics & Reports", 
         "Hospital administrators can monitor patient flow, token distributions, doctor schedules, disease prevalence statistics, and system audit logs."),
    ]
    for feat_name, feat_desc in features:
        add_feature_bullet(feat_name, feat_desc)

    # --- SECTION 3: Technology Stack ---
    add_heading("Technology Stack")
    add_body([
        ("The system was developed using ", False),
        ("Python, PyTorch, Torchvision, OpenCV, FastAPI, Uvicorn, WebSockets, SQLAlchemy, PostgreSQL, React 18, Vite, Tailwind CSS, Framer Motion, and pydicom", True),
        (", providing low-latency CPU inference (118ms), interactive user interfaces, real-time clinical synchronization, and enterprise-grade data security.", False)
    ])

    # --- SECTION 4: Commercialization Opportunities ---
    add_heading("Commercialization Opportunities")
    add_body([
        ("PneumoTB AI has substantial potential to become a regional clinical screening solution for hospitals, rural basic health units (BHUs), and diagnostic centers in Swat and surrounding areas, where specialized radiologists are scarce. Its key differentiator is the seamless integration of lightweight, edge-deployable deep learning (118ms CPU inference without expensive GPUs) with complete outpatient token and patient workflow management. Potential revenue models include affordable SaaS subscriptions for private clinics and diagnostic labs, enterprise licensing for tertiary hospitals, and public-sector deployment through government tuberculosis and pneumonia control initiatives. Through pilot testing with local healthcare facilities (such as Saidu Teaching Hospital), clinician feedback, and prospective clinical validation, PneumoTB AI could grow into a certified, sustainable digital healthcare platform that assists medical practitioners and accelerates early disease detection for underserved communities.", False)
    ])

    doc.save(output_path)
    print(f"Template successfully generated at: {output_path}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    out_file1 = os.path.join(base_dir, "PneumoTB_AI_Project_Summary_Template.docx")
    create_template_doc(out_file1, project_title="PneumoTB AI")
    
    out_file2 = os.path.join(base_dir, "AI_Tuberculosis_Pneumonia_Detection_System_Summary.docx")
    create_template_doc(out_file2, project_title="TB & Pneumonia AI")

