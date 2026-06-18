# 🌍 Carbon Trace System: Footprint Tracker

> **Hack2skill PromptWars Hackathon Submission**
> **Category: Challenge 3 - Carbon Footprint Awareness Platform**
> 
> An AI-powered sustainability platform designed to solve the challenge of tracking and reducing personal carbon emissions. Log daily activities in plain English and get real-time carbon footprint insights, environmental impact analytics, and personalized mitigation eco-actions — powered by Google Gemini 1.5 Flash.

## 🎯 Problem Statement Alignment: Challenge 3
This project is a direct solution for **Challenge 3: Carbon Footprint Awareness Platform** in the **PromptWars Hackathon** by **Hack2skill & Google for Developers**. 

**How it aligns with the core requirements:**
1. **Awareness:** It translates natural language daily activities into quantifiable CO2e metrics using Google Gemini 1.5 Flash.
2. **Actionable Recommendations:** It generates personalized, feasible daily commitments to reduce the user's carbon footprint.
3. **Tracking:** Features a gamified dashboard with a 'Sustainable Action Tracker Hub', Weekly Trends, and Milestone Badges to ensure long-term user retention and genuine environmental impact.

## 🧠 Prompt Engineering Architecture
As part of the **PromptWars** challenge, the core logic relies on highly optimized System Prompts fed to Google Gemini 1.5 Flash. 
- **Zero-Shot & Few-Shot Prompting:** Used to enforce strict JSON output formatting from the AI, ensuring the API never crashes.
- **Context Grounding:** The AI is given a strict persona ("You are an expert environmental scientist") to calculate accurate CO2e emissions and prevent hallucinations.
- **Chain of Thought:** The prompt instructs the AI to first analyze the activity, then calculate raw values, and finally generate actionable tips.

---

## Directory Structure

```text
Footprint Platform/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app factory + Uvicorn entry point
│   ├── routes/
│   │   ├── __init__.py
│   │   └── logs.py              # POST /api/logs/analyse endpoint
│   ├── services/
│   │   ├── __init__.py
│   │   └── ai_service.py        # Async Gemini 1.5 Flash integration
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── models.py            # Pydantic request/response models
│   └── tests/
│       ├── __init__.py
│       └── test_api.py          # 6 pytest unit tests (all mocked)
├── frontend/
│   ├── index.html               # Semantic HTML5, Tailwind CSS, Chart.js
│   └── app.js                   # Vanilla JS dashboard logic
├── .env.example                 # Template — copy to .env
├── .gitignore
├── pytest.ini
├── requirements.txt
└── README.md
