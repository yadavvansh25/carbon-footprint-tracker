"""
Activity log routes for the Carbon Footprint Tracker API.

Defines the ``POST /api/logs/analyse`` endpoint that accepts natural-language
activity descriptions and returns AI-generated carbon footprint analysis with
exactly 3 personalized actionable tips.

Error handling:
- ``422 Unprocessable Entity``: Pydantic validation failure (auto-handled).
- ``400 Bad Request``:          AI response could not be parsed.
- ``503 Service Unavailable``:  Gemini API is down or unreachable.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from backend.schemas.models import ActivityLogRequest, ActivityLogResponse
from backend.services.ai_service import AIService, get_ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])


# ---------------------------------------------------------------------------
# POST /api/logs/analyse
# ---------------------------------------------------------------------------


@router.post(
    "/analyse",
    response_model=ActivityLogResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse daily activities and return carbon footprint data",
    description=(
        "Accepts a natural-language description of the user's daily activities "
        "(5–500 characters), sends it to Gemini 1.5 Flash via the Google GenAI "
        "SDK, and returns a structured carbon footprint analysis with category "
        "breakdowns and exactly 3 personalised, actionable reduction tips."
    ),
    responses={
        200: {"description": "Successful AI analysis with full footprint breakdown."},
        400: {"description": "AI returned an unparseable or malformed response."},
        422: {"description": "Request validation failed (input too short/long/empty)."},
        503: {"description": "The Gemini AI service is temporarily unavailable."},
    },
)
async def analyse_activity(
    request: ActivityLogRequest,
    ai_service: Annotated[AIService, Depends(get_ai_service)],
) -> ActivityLogResponse:
    """
    POST /api/logs/analyse

    Validates the user's activity text via Pydantic, delegates AI analysis
    to the ``AIService``, and returns a structured ``ActivityLogResponse``.

    Args:
        request:    Pydantic-validated request body containing the activity text.
        ai_service: Injected ``AIService`` singleton (via FastAPI DI).

    Returns:
        ActivityLogResponse: Structured carbon footprint analysis.

    Raises:
        HTTPException 400: If the AI service cannot parse or structure the response.
        HTTPException 503: If the Gemini API is unreachable or returns an error.
    """
    logger.info(
        "Received activity log request (length=%d chars).",
        len(request.activity_text),
    )

    try:
        result = await ai_service.analyse_activity(request.activity_text)

    except ValueError as exc:
        logger.warning("AI response parsing error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Could not parse the AI's response: {exc}. "
                "Please try rephrasing your activity description."
            ),
        ) from exc

    except RuntimeError as exc:
        logger.error("AI service runtime error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The AI analysis service is temporarily unavailable. "
                "Please try again in a moment."
            ),
        ) from exc

    logger.info(
        "Analysis complete — estimated CO₂: %.2f kg CO₂e | tips: %d",
        result.estimated_co2,
        len(result.actionable_tips),
    )
    return result
