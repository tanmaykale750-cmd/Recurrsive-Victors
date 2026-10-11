"""CaseCompass API."""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .db import SessionLocal, init_db
from .glossary import GLOSSARY
from .routers import auth, cases, documents, exports, review

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.ocr_preload:
        from .parsing import ocr

        # first run downloads the PaddleOCR models; do it now, in the background, not on the first upload
        threading.Thread(target=ocr.warm_up, name="ocr-warm-up", daemon=True).start()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="CaseCompass API",
    version="1.0.0",
    description="Legal case timeline and action organizer. Organises the supplied record; not legal advice.",
)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Return the first human-readable validation message as `detail`."""
    errs = exc.errors()
    msg = "Check the form and try again."
    if errs:
        e = errs[0]
        msg = str(e.get("msg", msg)).removeprefix("Value error, ")
        field = ".".join(str(x) for x in e.get("loc", [])[1:])
        if field and "valid email" in msg:
            msg = "Enter a valid email address."
        elif field and msg.startswith(("String should", "Field required")):
            msg = f"{field.replace('_', ' ').capitalize()}: {msg.lower()}"
    return JSONResponse(status_code=422, content={"detail": msg, "errors": jsonable(errs)})


def jsonable(errs):
    return [{"loc": e.get("loc"), "msg": e.get("msg")} for e in errs]


for r in (auth.router, cases.router, documents.router, review.router, exports.router):
    app.include_router(r)




@app.get("/api/health")
def health():
    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    from .parsing import ocr

    return {"ok": db_ok, "database": "up" if db_ok else "down", "ocr": ocr.status(),
            "ai": {"provider": "groq", "available": settings.ai_available, "model": settings.groq_model if settings.ai_available else None}}


@app.get("/api/glossary")
def glossary():
    return GLOSSARY


# Serve the built frontend (single-container deployment)
if settings.frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=settings.frontend_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = settings.frontend_dist / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(settings.frontend_dist / "index.html")
