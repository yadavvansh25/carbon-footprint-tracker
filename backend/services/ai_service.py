"""
AI Service — handles all Gemini API interactions for the Carbon Footprint Tracker.

Uses the Google GenAI async client to call ``gemini-1.5-flash`` with structured
JSON output (``response_mime_type="application/json"``), ensuring fast, reliable,
and type-safe AI responses.

Design decisions:
- Singleton pattern via ``get_ai_service()`` avoids repeated client instantiation.
- Temperature is set to 0.3 for consistent, evidence-based estimates.
- The system prompt forces exactly 3 personalised tips referencing the user's
  specific activities — no generic advice.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

from google import genai
from google.genai import types

from backend.schemas.models import (
    ActionableTip,
    ActivityLogResponse,
    CategoryBreakdown,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — crafted for precision, personalisation, and JSON compliance
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a supportive and highly knowledgeable environmental \
advisor. A user has shared their daily activities with you.

Your task has two parts:

PART 1 — Carbon Footprint Estimation
Estimate the user's total carbon footprint in kg CO2 equivalent (kg CO2e) for \
today, and break it into these four categories:
- food (meals, snacks, drinks)
- transport (car, bus, train, plane, cycling, walking)
- energy (home heating, cooling, appliances, streaming)
- other (shopping, manufacturing, miscellaneous)

PART 2 — Personalised Micro-Actions
Analyse their SPECIFIC activities and generate exactly 3 highly personalised, \
simple, and immediately actionable micro-actions to reduce their footprint. \
Each tip MUST:
  a) Reference the user's exact activity by name (e.g. "your 15km petrol drive").
  b) Quantify the CO2e saving in kg (realistic, evidence-based).
  c) Be achievable TODAY or tomorrow — not a long-term lifestyle change.
  d) Be encouraging and non-judgmental in tone.
Do NOT give generic advice like "drive less" or "eat less meat" without \
specifics. Bad: "Consider cycling more." Good: "Swapping your 15km petrol \
commute for public transport tomorrow saves approximately 2.1 kg CO2e."

RESPONSE FORMAT
Respond ONLY with a single valid JSON object using EXACTLY these keys — no \
markdown, no explanation, no extra text:

{
  "estimated_co2": <number>,
  "categories": {
    "food": <number>,
    "transport": <number>,
    "energy": <number>,
    "other": <number>
  },
  "habit_analysis": "<2–4 sentence narrative about the user's habits>",
  "actionable_tips": [
    {
      "id": "tip_1",
      "title": "<action-oriented headline, ≤ 10 words>",
      "description": "<1–2 sentences referencing their exact activity + kg saving>",
      "co2_saving": <number>
    },
    {
      "id": "tip_2",
      "title": "...",
      "description": "...",
      "co2_saving": <number>
    },
    {
      "id": "tip_3",
      "title": "...",
      "description": "...",
      "co2_saving": <number>
    }
  ]
}

Use realistic, evidence-based CO2e estimates from peer-reviewed sources."""


# ---------------------------------------------------------------------------
# AI Service class
# ---------------------------------------------------------------------------


class AIService:
    """
    Async service layer for all Gemini API interactions.

    Instantiates the Google GenAI async client once and reuses it across
    all requests for efficiency.

    Attributes:
        MODEL_ID: Gemini model identifier string (class-level constant).
        _client:  Configured Google GenAI async client instance.
    """

    MODEL_ID: str = "gemini-1.5-flash"

    def __init__(self) -> None:
        """
        Initialize the AI service, loading the API key from the environment.
        If missing, it operates in mock mode for testing.
        """
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            self._client = genai.Client(api_key=self.api_key)
            logger.info("AIService initialised with model: %s", self.MODEL_ID)
        else:
            self._client = None
            logger.warning("GEMINI_API_KEY missing. AIService will run in MOCK mode.")

    async def analyse_activity(self, activity_text: str) -> ActivityLogResponse:
        """
        Send user activity text to Gemini and parse the structured response.

        Calls ``gemini-1.5-flash`` with ``response_mime_type="application/json"``
        to force strict JSON output, then deserializes into ``ActivityLogResponse``.

        Args:
            activity_text: Sanitized natural-language activity description
                           (already validated by Pydantic in the route layer).

        Returns:
            ActivityLogResponse: Structured, validated carbon footprint analysis.

        Raises:
            ValueError:   If the model returns unparseable or structurally invalid JSON.
            RuntimeError: On any unexpected Gemini API error (network, quota, etc.).
        """
        if not self._client:
            # MOCK MODE
            import asyncio
            await asyncio.sleep(1.5)  # simulate latency
            mock_data = {
                "estimated_co2": 12.4,
                "categories": {
                    "food": 3.2,
                    "transport": 4.5,
                    "energy": 3.0,
                    "other": 1.7
                },
                "habit_analysis": "You have a balanced footprint today, but your transport emissions are the highest due to your petrol commute. Shifting to active or public transport could significantly lower your impact.",
                "actionable_tips": [
                    {
                        "id": "tip_1",
                        "title": "Use Public Transit",
                        "description": "Swapping your petrol commute for public transport saves approximately 2.1 kg CO2e.",
                        "co2_saving": 2.1
                    },
                    {
                        "id": "tip_2",
                        "title": "Plant-Based Lunch",
                        "description": "Choosing a vegan meal instead of beef can save 1.5 kg CO2e per meal.",
                        "co2_saving": 1.5
                    },
                    {
                        "id": "tip_3",
                        "title": "Reduce Screen Time",
                        "description": "Cutting 1 hour of streaming saves roughly 0.1 kg CO2e in energy.",
                        "co2_saving": 0.1
                    }
                ]
            }
            return _build_response(mock_data, activity_text)

        prompt = (
            f"User Input: {activity_text}\n\n"
            "Please analyse these activities and respond with the JSON object "
            "exactly as instructed in the system prompt."
        )

        logger.info(
            "Sending activity to Gemini (length=%d chars, model=%s).",
            len(activity_text),
            self.MODEL_ID,
        )

        try:
            response = await self._client.aio.models.generate_content(
                model=self.MODEL_ID,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.3,        # Low temperature → consistent CO2 estimates
                    max_output_tokens=1024,
                    candidate_count=1,
                ),
            )
        except Exception as exc:
            logger.exception("Gemini API call failed with exception: %s", exc)
            raise RuntimeError(f"Gemini API error: {exc}") from exc

        raw_text: str = (response.text or "").strip()
        logger.debug("Raw Gemini response (first 500 chars): %s", raw_text[:500])

        if not raw_text:
            raise ValueError("Gemini returned an empty response.")

        try:
            data: Dict[str, Any] = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "Failed to parse Gemini JSON. Raw (first 400 chars): %s",
                raw_text[:400],
            )
            raise ValueError(f"AI returned invalid JSON: {exc}") from exc

        return _build_response(data, activity_text)


# ---------------------------------------------------------------------------
# Private response builder
# ---------------------------------------------------------------------------


def _build_response(data: Dict[str, Any], original_text: str) -> ActivityLogResponse:
    """
    Convert the raw Gemini JSON dictionary into a validated ``ActivityLogResponse``.

    Applies defensive defaults so partial AI responses degrade gracefully
    rather than causing a hard 500 error.

    Args:
        data:          Parsed JSON dict from Gemini.
        original_text: Original activity text to echo in the response.

    Returns:
        ActivityLogResponse: Fully validated Pydantic model instance.

    Raises:
        ValueError: If required fields are missing or have incompatible types.
    """
    try:
        # ------------------------------------------------------------------ #
        # Categories
        # ------------------------------------------------------------------ #
        cats_raw: Dict[str, Any] = data.get("categories") or {}
        categories = CategoryBreakdown(
            food=float(cats_raw.get("food") or 0.0),
            transport=float(cats_raw.get("transport") or 0.0),
            energy=float(cats_raw.get("energy") or 0.0),
            other=float(cats_raw.get("other") or 0.0),
        )

        # ------------------------------------------------------------------ #
        # Actionable tips (exactly 3 enforced by model_validator)
        # ------------------------------------------------------------------ #
        tips_raw: list = data.get("actionable_tips") or []
        actionable_tips = [
            ActionableTip(
                id=str(tip.get("id") or f"tip_{i + 1}"),
                title=str(tip.get("title") or "Eco action"),
                description=str(tip.get("description") or ""),
                co2_saving=float(tip.get("co2_saving") or 0.0),
            )
            for i, tip in enumerate(tips_raw[:3])
        ]

        return ActivityLogResponse(
            estimated_co2=float(data.get("estimated_co2") or 0.0),
            categories=categories,
            habit_analysis=str(data.get("habit_analysis") or ""),
            actionable_tips=actionable_tips,
            raw_activity=original_text,
        )

    except (KeyError, TypeError, AttributeError) as exc:
        logger.error("Malformed AI response structure: %s | Data: %s", exc, str(data)[:300])
        raise ValueError(f"Malformed AI response structure: {exc}") from exc


# ---------------------------------------------------------------------------
# Singleton factory — cached after first instantiation
# ---------------------------------------------------------------------------

_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """
    Return a singleton ``AIService`` instance.

    FastAPI's dependency injection system calls this function for every
    request; the singleton pattern avoids re-creating the Gemini client
    and re-reading environment variables on each invocation.

    Returns:
        AIService: The shared, cached AI service instance.

    Raises:
        EnvironmentError: Propagated from ``AIService.__init__`` if the
            ``GEMINI_API_KEY`` is missing.
    """
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
