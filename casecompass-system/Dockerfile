# ---- build the frontend -------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- API + PaddleOCR + built frontend -----------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PADDLE_PDX_CACHE_HOME=/app/models \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
# libgomp1: Paddle's OpenMP runtime; libgl1 + libglib2.0-0: OpenCV, used by PaddleOCR
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# Bake the OCR models into the image so the container works offline.
# Build with --build-arg PRELOAD_OCR_MODELS=0 to skip; they then download on first start.
ARG PRELOAD_OCR_MODELS=1
RUN if [ "$PRELOAD_OCR_MODELS" = "1" ]; then python -m app.parsing.ocr || echo "OCR models will download on first start"; fi
COPY --from=web /web/dist /app/frontend/dist
ENV FRONTEND_DIST=/app/frontend/dist
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
