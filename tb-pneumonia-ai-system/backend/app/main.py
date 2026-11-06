from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.routes import router as api_router
from .api.admin import router as admin_router
from .api.dicom_routes import router as dicom_router
from .db.database import engine, Base, SessionLocal
import os

PUBLIC_UPLOAD_SUBDIR = "profiles"

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TB & Pneumonia AI System")

# WebSocket auth has no request-scoped DB dependency, so expose a session factory.
app.state.db_factory = SessionLocal

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(api_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(dicom_router, prefix="/api")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_uploads_dir = os.path.join(BASE_DIR, "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
_profiles_dir = os.path.join(_uploads_dir, PUBLIC_UPLOAD_SUBDIR)
os.makedirs(_profiles_dir, exist_ok=True)

# Mount public profile avatars safely (radiology images are strictly served via authenticated /api/media/radiology)
app.mount(
    "/uploads/profiles",
    StaticFiles(directory=_profiles_dir),
    name="profiles",
)

@app.get("/")
async def root():
    return {"message": "Welcome to TB & Pneumonia AI System API"}
