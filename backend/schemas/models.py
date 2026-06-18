"""
Pydantic data models for the Carbon Footprint Tracker API.

These models enforce strict type validation and input sanitization for all
request/response payloads, preventing injection attacks and ensuring data
integrity throughout the application.

All models are Pydantic v2 compatible and leverage ``Field`` for metadata
and ``field_validator`` for custom sanitisation logic.
"""

from __future__ import annotations

import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ActivityLogRequest(BaseModel):
    """
    Represents a user's natural-language activity log submission.

    Attributes:
        activity_text: Free-form description of daily activities.
            Must be between 5 and 500 characters after sanitization.
    """

    activity_text: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Natural language description of the user's daily activities.",
        examples=[
            "I drove 15km to work in a petrol car and ate a beef burger for lunch."
        ],
    )

    @field_validator("activity_text", mode="before")
    @classmethod
    def sanitize_text(cls, value: str) -> str:
        """
        Strip whitespace, remove null bytes, and collapse excessive whitespace.

        Prevents null-byte injection and excessively padded inputs from
        bypassing the ``min_length`` / ``max_length`` Pydantic guards.

        Args:
            value: The raw input string from the user.

        Returns:
            Sanitized string safe for downstream AI processing.

        Raises:
            ValueError: If the value is not a string.
        """
        if not isinstance(value, str):
            raise ValueError("activity_text must be a string.")
        # Remove null bytes and non-printable control characters (except tabs/newlines)
        value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
        # Normalise multiple consecutive whitespace runs to a single space
        value = re.sub(r"[ \t]{2,}", " ", value)
        return value.strip()

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "activity_text": (
                        "I drove 15km to work in a petrol car and ate a beef burger for lunch. "
                        "Streamed 3 hours of Netflix in the evening."
                    )
                }
            ]
        }
    }


# ---------------------------------------------------------------------------
# Response models — AI-generated payload
# ---------------------------------------------------------------------------


class CategoryBreakdown(BaseModel):
    """
    CO₂ emissions broken down by lifestyle category (kg CO₂e).

    Attributes:
        food:      Emissions from food and diet choices (kg CO₂e).
        transport: Emissions from vehicle and air travel (kg CO₂e).
        energy:    Emissions from home energy consumption (kg CO₂e).
        other:     Miscellaneous emissions not fitting above categories (kg CO₂e).
    """

    food: float = Field(
        default=0.0,
        ge=0.0,
        description="Food-related CO₂ emissions in kg CO₂e.",
    )
    transport: float = Field(
        default=0.0,
        ge=0.0,
        description="Transport-related CO₂ emissions in kg CO₂e.",
    )
    energy: float = Field(
        default=0.0,
        ge=0.0,
        description="Home energy CO₂ emissions in kg CO₂e.",
    )
    other: float = Field(
        default=0.0,
        ge=0.0,
        description="Other miscellaneous CO₂ emissions in kg CO₂e.",
    )


class ActionableTip(BaseModel):
    """
    A single personalized, actionable micro-tip to reduce the user's footprint.

    Attributes:
        id:          Unique identifier for front-end task tracking (e.g. ``tip_1``).
        title:       Short headline for the tip (≤ 120 chars).
        description: Detailed explanation with quantified CO₂ savings (≤ 600 chars).
        co2_saving:  Estimated kg CO₂e saved per day if this action is adopted.
    """

    id: str = Field(
        ...,
        max_length=32,
        description="Unique tip identifier (e.g. 'tip_1').",
    )
    title: str = Field(
        ...,
        max_length=120,
        description="Short, action-oriented tip title.",
    )
    description: str = Field(
        ...,
        max_length=600,
        description="Detailed description with quantified CO₂ savings.",
    )
    co2_saving: float = Field(
        default=0.0,
        ge=0.0,
        description="Estimated kg CO₂e saved per day if adopted.",
    )


class ActivityLogResponse(BaseModel):
    """
    Full structured response returned by the ``/api/logs/analyse`` endpoint.

    Attributes:
        estimated_co2:   Total daily carbon footprint estimate in kg CO₂e.
        categories:      Breakdown of emissions by lifestyle category.
        habit_analysis:  Narrative summary of the user's current habits.
        actionable_tips: Exactly 3 personalized micro-actions.
        raw_activity:    Echo of the original activity text for front-end context.
    """

    estimated_co2: float = Field(
        ...,
        ge=0.0,
        description="Total estimated CO₂ in kg CO₂e for the day.",
    )
    categories: CategoryBreakdown
    habit_analysis: str = Field(
        ...,
        description="AI-generated narrative analysis of the user's habits.",
    )
    actionable_tips: List[ActionableTip] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="List of exactly 3 personalised reduction tips.",
    )
    raw_activity: Optional[str] = Field(
        default=None,
        description="Echo of the original activity text (for UI context).",
    )

    @model_validator(mode="after")
    def ensure_tips_count(self) -> "ActivityLogResponse":
        """
        Guarantee the response always contains exactly 3 actionable tips.

        Pads with a generic tip if the AI returned fewer than 3, and
        silently truncates to 3 if more were returned.

        Returns:
            Self — mutated in place.
        """
        tips = self.actionable_tips
        while len(tips) < 3:
            idx = len(tips) + 1
            tips.append(
                ActionableTip(
                    id=f"tip_{idx}",
                    title="Consider a low-carbon alternative",
                    description=(
                        "Small daily swaps — like choosing plant-based meals or "
                        "active travel — compound into significant annual CO₂ savings."
                    ),
                    co2_saving=0.5,
                )
            )
        self.actionable_tips = tips[:3]
        return self


# ---------------------------------------------------------------------------
# Health-check model
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """
    Simple health-check response payload.

    Attributes:
        status:  Always ``"ok"`` when the service is healthy.
        version: API semantic version string.
        message: Human-readable status message.
    """

    status: str = Field(default="ok", description="Service health status.")
    version: str = Field(default="1.0.0", description="API version string.")
    message: str = Field(
        default="Carbon Footprint Tracker API is running.",
        description="Human-readable status message.",
    )
