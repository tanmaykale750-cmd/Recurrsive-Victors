"""Application settings, read from environment variables or a .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    # --- database -------------------------------------------------------
    database_url: str = "postgresql+psycopg://casecompass:casecompass@localhost:5432/casecompass"

    # --- auth -----------------------------------------------------------
    jwt_secret: str = "change-me-in-production-use-a-long-random-string"
    jwt_expire_minutes: int = 60 * 24 * 7

    # --- AI (Groq, OpenAI-compatible API) --------------------------------
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_timeout_seconds: float = 30.0
    ai_enabled: bool = True

    # --- document parsing -------------------------------------------------
    upload_dir: Path = BASE_DIR / "storage" / "uploads"
    max_upload_mb: int = 40
    #: a PDF page with fewer visible characters than this in its text layer is OCR'd
    text_layer_min_chars: int = 40

    # --- OCR (PaddleOCR) ----------------------------------------------------
    #: dates whose OCR confidence (0-100) is below this are quarantined, never guessed
    ocr_min_confidence: float = 85.0
    #: highest resolution scanned PDF pages are rendered at for OCR (lower-resolution scans are
    #: rendered at their own resolution)
    ocr_dpi: int = 300
    #: PaddleOCR model names (downloaded once, cached in ~/.paddlex or PADDLE_PDX_CACHE_HOME)
    ocr_det_model: str = "PP-OCRv6_small_det"
    ocr_rec_model: str = "PP-OCRv6_small_rec"
    #: local model folders for servers without internet (each holds inference.yml + weights)
    ocr_det_model_dir: str = ""
    ocr_rec_model_dir: str = ""
    ocr_orientation_model_dir: str = ""
    #: turn sideways or upside-down scans upright before reading (one extra small model)
    ocr_fix_rotation: bool = True
    #: "cpu", "gpu" or "gpu:0"; empty lets PaddleOCR pick
    ocr_device: str = ""
    #: inference engine passed to PaddleOCR; empty = Paddle Inference (the default)
    ocr_engine: str = ""
    ocr_enable_mkldnn: bool = True
    ocr_cpu_threads: int = 0  # 0 = PaddleOCR default
    #: where models download from first: huggingface | bos | modelscope | aistudio (others are fallbacks)
    ocr_model_source: str = ""
    #: load the OCR models in the background when the server starts, so the first scan is not slow
    ocr_preload: bool = True

    # --- app --------------------------------------------------------------
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    frontend_dist: Path = BASE_DIR.parent / "frontend" / "dist"

    @property
    def ai_available(self) -> bool:
        return self.ai_enabled and bool(self.groq_api_key.strip())

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    return s


settings = get_settings()
