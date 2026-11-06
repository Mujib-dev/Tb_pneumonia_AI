from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import router as api_router
from app.db.database import Base, get_db
from app.db import models
from app.main import app


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def tomorrow() -> str:
    return (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")


@pytest.fixture()
def doctor(db_session):
    user = models.User(
        name="Dr Test",
        phone="03001234567",
        cnic="1234512345671",
        hashed_password="$2b$12$abcdefghijklmnopqrstuv",
        role="doctor",
        consultation_fee=1500,
        max_tokens=20,
        token_mode="dynamic",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


__all__ = ["api_router", "models", "client", "db_session", "doctor", "tomorrow"]
