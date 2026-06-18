"""
Carbon Footprint Tracker — FastAPI application entry point.

This module initializes the FastAPI application with:
- Strict CORS middleware (configurable via ``ALLOWED_ORIGINS`` env var)
- Structured ``uvicorn``-compatible logging
- API health-check endpoint (``GET /health``)
- Activity log router (``/api/logs``)
- Frontend static files serving
"""

from __future__ import annotations

import logging
import os
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.logs import router as logs_router
from backend.schemas.models import HealthResponse

# ---------------------------------------------------------------------------
# Bootstrap — load .env before anything else touches os.getenv
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
    """
    Create and configure the FastAPI application instance.

    Applies CORS middleware, registers the activity log router, and attaches
    the health-check endpoint before returning the configured ``FastAPI`` app.
    """
    app = FastAPI(
        title="Carbon Footprint Tracker API",
        description=(
            "AI-powered backend for the **Personalized Carbon Footprint Tracker**. "
            "Uses Google Gemini 1.5 Flash to analyse natural-language activity logs "
            "and return structured carbon footprint data with actionable, "
            "personalised sustainability tips.\n\n"
            "### Security\n"
            "- API key is read exclusively from the ``GEMINI_API_KEY`` environment variable.\n"
            "- Inputs are sanitized and length-limited via Pydantic validators.\n"
            "- CORS is restricted to the configured ``ALLOWED_ORIGINS``."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        contact={
            "name": "Footprint Team",
            "email": "support@footprint.app",
        },
        license_info={
            "name": "MIT",
        },
    )

    # ------------------------------------------------------------------
    # CORS — restrict to known frontend origins; configurable via env
    # ------------------------------------------------------------------
    raw_origins: str = os.getenv(
        "ALLOWED_ORIGINS",
        (
            "http://localhost:3000,"
            "http://127.0.0.1:3000,"
            "http://localhost:5500,"
            "http://127.0.0.1:5500,"
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "null"               # file:// origin for local HTML file open
        ),
    )
    allowed_origins: list[str] = [o.strip() for o in raw_origins.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,            # No cookies/sessions needed
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Accept"],
        expose_headers=["X-Request-ID"],
    )

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    app.include_router(logs_router)

    # ------------------------------------------------------------------
    # Health-check endpoint
    # ------------------------------------------------------------------
    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["health"],
        summary="Service health check",
    )
    async def health_check() -> HealthResponse:
        return HealthResponse()

    # ------------------------------------------------------------------
    # Frontend Serving (Vercel & Local)
    # ------------------------------------------------------------------
    # Compute the absolute path to the frontend directory
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

    # Ensure directory exists before mounting to avoid server startup errors
    if os.path.isdir(FRONTEND_DIR):
        app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")

        @app.get("/", include_in_schema=False)
        async def serve_dashboard():
            return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
    else:
        logger.warning(f"Frontend directory not found at {FRONTEND_DIR}. Dashboard will not be served.")

    logger.info("Carbon Footprint Tracker API initialised (v1.0.0).")
    return app


# ---------------------------------------------------------------------------
# Application instance — imported by Uvicorn / test client
# ---------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
