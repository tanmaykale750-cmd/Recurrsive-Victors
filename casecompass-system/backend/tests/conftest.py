import os

# use a separate database for tests (PostgreSQL by default; any SQLAlchemy URL works)
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://casecompass:casecompass@localhost:5432/casecompass_test"))
os.environ["GROQ_API_KEY"] = ""
os.environ.setdefault("OCR_PRELOAD", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402,F401  (register tables before drop_all)
from app.db import Base, engine, init_db  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    init_db()
    yield


@pytest.fixture(scope="session")
def client():
    from app.main import app
    from app.services import pipeline

    # run the pipeline inline instead of in the background worker
    from app.db import SessionLocal

    def inline(doc_id):
        db = SessionLocal()
        try:
            pipeline.process_document(db, doc_id)
        finally:
            db.close()

    pipeline.submit = inline  # the routers call pipeline.submit through the module, so this covers them
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth(client):
    r = client.post("/api/auth/register", json={"name": "Test Reviewer", "phone": "+91 98765 43210", "email": "t@example.in", "password": "secret123"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def bundle(tmp_path_factory):
    """Generated test documents (tests/fixtures/bundles.py): bundle("civil") -> list of file paths."""
    from tests.fixtures.bundles import build_set

    out = tmp_path_factory.mktemp("bundles")
    return lambda name: build_set(name, out)
