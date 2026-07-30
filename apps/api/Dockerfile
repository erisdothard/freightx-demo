# FreightX API — Production Dockerfile
#
# INTERVIEW NOTE: Multi-stage builds are an interview favorite.
# "How do you optimize Docker images for Python?"
# Answer: Multi-stage build — install dependencies in a builder stage,
# copy only the installed packages to a slim runtime stage.
# This reduces image size from ~1GB to ~200MB.

# --- Stage 1: Builder ---
FROM python:3.12-slim AS builder

WORKDIR /build

# Install dependencies into a virtual environment
# INTERVIEW NOTE: Using --no-cache-dir reduces image size by ~30%
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Stage 2: Runtime ---
FROM python:3.12-slim AS runtime

# INTERVIEW NOTE: Running as non-root is a security best practice.
# If the container is compromised, the attacker can't escalate to root.
RUN useradd --create-home appuser
USER appuser

WORKDIR /app

# Copy installed dependencies from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# INTERVIEW NOTE: EXPOSE is documentation — it doesn't actually open the port.
# The port is opened by the CMD or docker-compose port mapping.
EXPOSE 8000

# INTERVIEW NOTE: Health check lets Docker/Kubernetes know if the container is alive.
# If /health returns non-200, the orchestrator restarts the container.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# INTERVIEW NOTE: Use exec form (JSON array), not shell form.
# Exec form makes uvicorn PID 1, so it receives SIGTERM directly for graceful shutdown.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
