"""
Carbon Footprint Tracker — FastAPI Entry Point.
Implements robust security headers, structured logging, and type-safe API routing.
"""

from __future__ import annotations

import logging
import os
from typing import Final

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from backend.routes.logs import router as logs_router
from backend.schemas.models import HealthResponse

# ---------------------------------------------------------------------------
# Configuration & Logging
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger: Final = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """
    Factory to create and configure the FastAPI application.

    Returns:
        FastAPI: The configured application instance.
    """
    app = FastAPI(
        title="Carbon Footprint Tracker API",
        version="1.0.0",
        description="High-performance AI backend for carbon tracking.",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # 1. CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Accept"],
    )

    # 2. Strict Security Middleware
    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next) -> Response:
            response: Response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
            return response

    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Routes
    app.include_router(logs_router)

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    async def health_check() -> HealthResponse:
        """Verifies service health."""
        return HealthResponse()

    # 4. Frontend Serving
    base_dir: Final = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_dir: Final = os.path.join(base_dir, "frontend")

    if os.path.isdir(frontend_dir):
        app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")

        @app.get("/", include_in_schema=False, response_class=FileResponse)
        async def serve_dashboard() -> FileResponse:
            """Serves the dashboard index file."""
            return FileResponse(os.path.join(frontend_dir, "index.html"))

    return app

app = create_app()
