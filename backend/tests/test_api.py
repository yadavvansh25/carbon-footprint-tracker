"""
Unit and integration tests for the Carbon Footprint Tracker API.

All external Gemini API calls are mocked, so the test suite runs instantly
without a live API key or network access.

Test inventory:
    1. test_health_check                    — Smoke test: GET /health returns 200.
    2. test_analyse_valid_activity          — Happy path: POST with valid text returns 200 + full body.
    3. test_analyse_empty_input_returns_422 — Pydantic rejects empty / too-short inputs with 422.
    4. test_analyse_too_long_input_returns_422  — Pydantic rejects inputs > 500 chars with 422.
    5. test_analyse_ai_runtime_error_returns_503 — RuntimeError from AI maps to HTTP 503.
    6. test_analyse_ai_bad_json_returns_400     — ValueError from AI maps to HTTP 400.

Run with:
    pytest backend/tests/test_api.py -v
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.models import (
    ActionableTip,
    ActivityLogResponse,
    CategoryBreakdown,
)
from backend.services.ai_service import AIService, get_ai_service

# ---------------------------------------------------------------------------
# Shared mock response fixture
# ---------------------------------------------------------------------------

MOCK_RESPONSE = ActivityLogResponse(
    estimated_co2=6.4,
    categories=CategoryBreakdown(food=3.1, transport=2.8, energy=0.3, other=0.2),
    habit_analysis=(
        "Your beef burger contributed significantly to today's footprint — "
        "beef production is one of the most carbon-intensive foods available. "
        "Driving alone in a petrol car adds substantial transport emissions that "
        "could be meaningfully reduced by switching commute modes."
    ),
    actionable_tips=[
        ActionableTip(
            id="tip_1",
            title="Swap your beef burger for chicken tomorrow",
            description=(
                "Replacing a single beef burger (~2.5 kg CO₂e) with a chicken "
                "alternative saves approximately 1.8 kg CO₂e per meal."
            ),
            co2_saving=1.8,
        ),
        ActionableTip(
            id="tip_2",
            title="Carpool your 15km commute once this week",
            description=(
                "Sharing your 15km petrol commute with one colleague cuts your "
                "transport emissions by roughly 50%, saving ~1.4 kg CO₂e per trip."
            ),
            co2_saving=1.4,
        ),
        ActionableTip(
            id="tip_3",
            title="Try a fully plant-based lunch on Friday",
            description=(
                "A fully plant-based meal can save up to 2.5 kg CO₂e compared "
                "to a red-meat equivalent — the easiest single swap you can make."
            ),
            co2_saving=2.5,
        ),
    ],
    raw_activity="I drove 15km to work in a petrol car and ate a beef burger.",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_ai_service() -> MagicMock:
    """
    Return a MagicMock ``AIService`` whose ``analyse_activity`` method
    is an ``AsyncMock`` returning ``MOCK_RESPONSE``.

    This ensures tests are isolated from live Gemini API calls.
    """
    service = MagicMock(spec=AIService)
    service.analyse_activity = AsyncMock(return_value=MOCK_RESPONSE)
    return service


@pytest.fixture()
def client(mock_ai_service: MagicMock) -> TestClient:
    """
    Override ``get_ai_service`` dependency with the mock and return a
    synchronous ``TestClient`` for the FastAPI application.

    Dependency override is cleared after each test to prevent pollution.
    """
    app.dependency_overrides[get_ai_service] = lambda: mock_ai_service
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 1 — Health-check endpoint (smoke test)
# ---------------------------------------------------------------------------


def test_health_check(client: TestClient) -> None:
    """
    Verify that ``GET /health`` returns HTTP 200 with ``status="ok"``.

    This is a smoke test confirming the FastAPI application starts correctly
    and the health endpoint is reachable before any AI calls are made.
    """
    response = client.get("/health")

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}"
    )
    body = response.json()
    assert body["status"] == "ok", f"Expected status='ok', got {body['status']}"
    assert "version" in body, "HealthResponse must include a 'version' field"
    assert "message" in body, "HealthResponse must include a 'message' field"


# ---------------------------------------------------------------------------
# Test 2 — Valid natural-language activity input (happy path)
# ---------------------------------------------------------------------------


def test_analyse_valid_activity(
    client: TestClient, mock_ai_service: MagicMock
) -> None:
    """
    Verify that ``POST /api/logs/analyse`` with a valid activity description:
    - Returns HTTP 200.
    - Returns a fully populated ``ActivityLogResponse`` body.
    - Contains all required top-level fields.
    - Contains exactly 3 actionable tips with required sub-fields.
    - Calls the AI service exactly once with the sanitized text.
    """
    payload = {
        "activity_text": "I drove 15km to work in a petrol car and ate a beef burger."
    }
    response = client.post("/api/logs/analyse", json=payload)

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code} — body: {response.text}"
    )
    body = response.json()

    # --- Top-level fields ---
    assert "estimated_co2" in body, "Response must contain 'estimated_co2'"
    assert body["estimated_co2"] == pytest.approx(6.4, rel=1e-3)
    assert "categories" in body, "Response must contain 'categories'"
    assert body["categories"]["food"] == pytest.approx(3.1, rel=1e-3)
    assert "habit_analysis" in body, "Response must contain 'habit_analysis'"
    assert len(body["habit_analysis"]) > 0, "habit_analysis must not be empty"

    # --- Exactly 3 actionable tips ---
    assert "actionable_tips" in body, "Response must contain 'actionable_tips'"
    assert len(body["actionable_tips"]) == 3, (
        f"Expected exactly 3 tips, got {len(body['actionable_tips'])}"
    )
    required_tip_fields = {"id", "title", "description", "co2_saving"}
    for i, tip in enumerate(body["actionable_tips"]):
        missing = required_tip_fields - tip.keys()
        assert not missing, f"Tip {i+1} is missing fields: {missing}"

    # --- AI service called exactly once ---
    mock_ai_service.analyse_activity.assert_called_once_with(payload["activity_text"])


# ---------------------------------------------------------------------------
# Test 3 — Empty / too-short input (Pydantic 422 validation)
# ---------------------------------------------------------------------------


def test_analyse_empty_input_returns_422(client: TestClient) -> None:
    """
    Verify that Pydantic rejects empty or too-short ``activity_text`` with
    HTTP 422 Unprocessable Entity, without ever calling the AI service.

    Inputs tested: empty string, whitespace-only, and a 4-char string
    (below the 5-character minimum).
    """
    bad_inputs = ["", "   ", "hi", "abc"]
    for bad_input in bad_inputs:
        response = client.post(
            "/api/logs/analyse", json={"activity_text": bad_input}
        )
        assert response.status_code == 422, (
            f"Expected 422 for input {repr(bad_input)}, "
            f"got {response.status_code}"
        )


# ---------------------------------------------------------------------------
# Test 4 — Excessively long input (max_length guard)
# ---------------------------------------------------------------------------


def test_analyse_too_long_input_returns_422(client: TestClient) -> None:
    """
    Verify that ``activity_text`` exceeding 500 characters is rejected
    with HTTP 422, preventing oversized payloads from reaching the AI.
    """
    long_text = "a" * 501
    response = client.post("/api/logs/analyse", json={"activity_text": long_text})
    assert response.status_code == 422, (
        f"Expected 422 for oversized input (501 chars), got {response.status_code}"
    )


# ---------------------------------------------------------------------------
# Test 5 — AI service RuntimeError maps to HTTP 503
# ---------------------------------------------------------------------------


def test_analyse_ai_runtime_error_returns_503(
    client: TestClient, mock_ai_service: MagicMock
) -> None:
    """
    Verify that when the AI service raises ``RuntimeError`` (e.g., Gemini API
    is down), the endpoint returns HTTP 503 Service Unavailable rather than a
    raw 500 Internal Server Error.
    """
    mock_ai_service.analyse_activity = AsyncMock(
        side_effect=RuntimeError("Gemini API is unreachable")
    )
    payload = {"activity_text": "I took a long-haul flight from London to New York."}
    response = client.post("/api/logs/analyse", json=payload)
    assert response.status_code == 503, (
        f"Expected 503 for AI RuntimeError, got {response.status_code}"
    )


# ---------------------------------------------------------------------------
# Test 6 — AI bad JSON maps to HTTP 400
# ---------------------------------------------------------------------------


def test_analyse_ai_bad_json_returns_400(
    client: TestClient, mock_ai_service: MagicMock
) -> None:
    """
    Verify that when the AI service raises ``ValueError`` (unparseable or
    structurally invalid JSON), the endpoint returns HTTP 400 Bad Request.
    """
    mock_ai_service.analyse_activity = AsyncMock(
        side_effect=ValueError("AI returned invalid JSON: ...")
    )
    payload = {"activity_text": "Cycled 10km and had a vegetarian stir-fry for dinner."}
    response = client.post("/api/logs/analyse", json=payload)
    assert response.status_code == 400, (
        f"Expected 400 for bad AI JSON, got {response.status_code}"
    )
