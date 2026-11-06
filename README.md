# TB & Pneumonia AI Detection System

An intelligent medical screening platform and Clinical Decision Support System (CDSS) powered by Deep Learning (DenseNet121) for automated detection of Tuberculosis and Pneumonia from chest radiographs (X-rays).

---

## 🌟 Key Features
- **Deep Learning Inference**: DenseNet121-based transfer learning model for multi-class chest X-ray classification (Normal, Tuberculosis, Pneumonia) with Grad-CAM heatmaps.
- **Modern Web Interface**: Responsive React frontend styled with Tailwind CSS, featuring glassmorphism design, appointment booking, patient history, and real-time inference feedback.
- **FastAPI Backend**: High-performance asynchronous RESTful APIs, JWT authentication, DICOM gateway integration, and role-based access control.
- **Hospital Workflow Integration**: Support for DICOM imaging pipelines, PACS integration, doctor-patient inquiries, and token management.
- **Comprehensive Documentation**: Complete software engineering pillars, architecture diagrams, viva preparation bank, and evaluation guides.

---

## 📁 Repository Structure

```
├── tb-pneumonia-ai-system/          # Core Application
│   ├── backend/                     # FastAPI backend application
│   │   ├── app/                     # API routes, models, database schemas, services
│   │   ├── ml_model/                # DenseNet121 model definitions
│   │   ├── tests/                   # Automated unit & integration tests
│   │   ├── requirements.txt         # Python dependencies
│   │   └── run.py                   # Application entry point
│   ├── frontend/                    # React + Vite frontend application
│   │   ├── src/                     # Components, pages, hooks, services
│   │   └── package.json             # Node.js dependencies
│   ├── database/                    # PostgreSQL schema & migration scripts
│   ├── docker/                      # Dockerfiles and docker-compose configurations
│   ├── docs/                        # DICOM setup, viva bank, and architecture docs
│   └── run_project.bat              # One-click Windows startup script
├── DataBase.sql                     # Full database snapshot
├── proposal.docx                    # FYP Project Proposal
├── AI_Tuberculosis_Pneumonia_Detection_System_Summary.docx
├── Final_Year_Project_Evaluation_and_Scholarship_Guide.docx
├── PneumoTB_AI_Software_Engineering_Documentation_Pillars.docx
├── TB_Pneumonia_AI_System_Complete_Documentation.pdf
└── generate_*.py                    # Automated technical report and doc generators
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.9+**
- **Node.js 18+** & npm
- **PostgreSQL 14+**

### Quick Start (Windows)
Run the automated batch script to launch both backend and frontend servers simultaneously:
```cmd
cd tb-pneumonia-ai-system
run_project.bat
```

---

### Manual Setup

#### 1. Backend Setup
```bash
cd tb-pneumonia-ai-system/backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env   # On Windows
# Edit .env with your PostgreSQL credentials and secrets

# Start backend server
python run.py
```
Backend will be available at: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

#### 2. Frontend Setup
```bash
cd tb-pneumonia-ai-system/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend will be available at: `http://localhost:5173`.

---

### Docker Deployment
```bash
cd tb-pneumonia-ai-system/docker
docker-compose up --build
```

---

## 📄 Documentation & Reports
Detailed technical specifications, software engineering documentation, and evaluation guides are available in the root directory and `tb-pneumonia-ai-system/docs/`.

---

## ⚖️ License
This project is developed as a Final Year Project (FYP) and is licensed under the MIT License.
