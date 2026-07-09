# ─── Production AI Service Dockerfile ─────────────────────────
FROM python:3.11-slim AS base

# Security: non-root user
RUN groupadd -r droneos && useradd -r -g droneos droneos

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ─── Install Python deps ───────────────────────────────────────
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Runtime ──────────────────────────────────────────────────
FROM deps AS runtime
COPY --chown=droneos:droneos . .
USER droneos

EXPOSE 10000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request, os; urllib.request.urlopen(f\"http://localhost:{os.environ.get('PORT','10000')}/health\")" || exit 1

# Use shell form so $PORT is expanded at runtime (Render injects PORT env var)
CMD gunicorn --bind "0.0.0.0:${PORT:-10000}" \
     --workers 2 --threads 4 \
     --timeout 60 --access-logfile - \
     app:app
