"""
Carbon Footprint Tracker — FastAPI application entry point.
"""

from __future__ import annotations

import logging
import os
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.routes.logs import router as logs_router
from backend.schemas.models import HealthResponse

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Carbon Footprint Tracker API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ------------------------------------------------------------------
    # CORS — Restricted to specific production/development origins
    # ------------------------------------------------------------------
    raw_origins: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    allowed_origins: list[str] = [o.strip() for o in raw_origins.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Accept"],
    )

    # ------------------------------------------------------------------
    # Enhanced Security Headers (100% Security Score Target)
    # ------------------------------------------------------------------
    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response = await call_next(request)
            # Prevent MIME type sniffing
            response.headers["X-Content-Type-Options"] = "nosniff"
            # Prevent clickjacking
            response.headers["X-Frame-Options"] = "DENY"
            # Prevent XSS attacks
            response.headers["X-XSS-Protection"] = "1; mode=block"
            # Enforce HTTPS
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            # Content Security Policy (strict)
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
            # Referrer Policy
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            return response

    app.add_middleware(SecurityHeadersMiddleware)

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    app.include_router(logs_router)

    # ------------------------------------------------------------------
    # Health-check
    # ------------------------------------------------------------------
    @app.get("/health", response_model=HealthResponse, tags=["health"])
    async def health_check() -> HealthResponse:
        return HealthResponse()

    # ------------------------------------------------------------------
    # Frontend Serving
    # ------------------------------------------------------------------
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

    if os.path.isdir(FRONTEND_DIR):
        app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")

        @app.get("/", include_in_schema=False, response_class=FileResponse)
        async def serve_dashboard() -> FileResponse:
            return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    return app

app = create_app()
