# 🌍 Carbon Trace System: Footprint Tracker
## 🎯 Problem Statement Alignment: Challenge 3
This project is a direct solution for **Challenge 3: Carbon Footprint Awareness Platform** in the **PromptWars Hackathon** by **Hack2skill & Google for Developers**. 

**How it aligns with the core requirements:**
1. **Awareness:** It translates natural language daily activities into quantifiable CO2e metrics using Google Gemini 1.5 Flash.
2. **Actionable Recommendations:** It generates personalized, feasible daily commitments to reduce the user's carbon footprint.
3. **Tracking:** Features a gamified dashboard with a 'Sustainable Action Tracker Hub', Weekly Trends, and Milestone Badges to ensure long-term user retention and genuine environmental impact.

> **Hack2skill PromptWars Hackathon Submission**
> **Category: Challenge 3 - Carbon Footprint Awareness Platform**
> 
> An AI-powered sustainability platform designed to solve the challenge of tracking and reducing personal carbon emissions. Log daily activities in plain English and get real-time carbon footprint insights, environmental impact analytics, and personalized mitigation eco-actions — powered by Google Gemini 1.5 Flash.

---

## Directory Structure

```
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
```

---

## Quick Start

### 1. Clone & enter the project
```bash
cd "Footprint Platform"
```

### 2. Create a virtual environment & install dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows
pip install -r requirements.txt
```

### 3. Configure your API key
```bash
cp .env.example .env
# Open .env and replace `your_gemini_api_key_here` with your actual key
# Get a key at: https://aistudio.google.com/
```

### 4. Start the backend
```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000
```
API docs available at → http://127.0.0.1:8000/docs

### 5. Serve the frontend
Open `frontend/index.html` directly in your browser, **or** use any static server:
```bash
# Option A — Python built-in
cd frontend && python3 -m http.server 3000

# Option B — Node live-server
npx live-server frontend --port=3000
```
Then visit → http://localhost:3000

---

## Running Tests

```bash
source .venv/bin/activate
pytest backend/tests/test_api.py -v
```

All 6 tests run **without a live API key** — the Gemini service is fully mocked.

| Test | Description |
|------|-------------|
| `test_health_check` | GET /health returns 200 + `{"status":"ok"}` |
| `test_analyse_valid_activity` | Valid input → 200 + full structured response |
| `test_analyse_empty_input_returns_422` | Empty/short text → Pydantic 422 |
| `test_analyse_too_long_input_returns_422` | >1000 chars → Pydantic 422 |
| `test_analyse_ai_runtime_error_returns_503` | Gemini down → 503 |
| `test_analyse_ai_bad_json_returns_400` | Bad AI JSON → 400 |

---

## API Reference

### `POST /api/logs/analyse`
```json
// Request
{ "activity_text": "I drove 15km to work in a petrol car and ate a beef burger." }

// Response
{
  "estimated_co2": 6.4,
  "categories": { "food": 3.1, "transport": 2.8, "energy": 0.3, "other": 0.2 },
  "habit_analysis": "Your beef burger contributed significantly...",
  "actionable_tips": [
    {
      "id": "tip_1",
      "title": "Swap beef burger for chicken tomorrow",
      "description": "Saves approximately 1.8 kg CO2e per meal.",
      "co2_saving": 1.8
    }
  ],
  "raw_activity": "I drove 15km..."
}
```

### `GET /health`
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.115, Uvicorn, Pydantic v2 |
| AI | Google GenAI SDK — Gemini 1.5 Flash |
| Frontend | Semantic HTML5, Vanilla JS, Tailwind CSS CDN |
| Charts | Chart.js 4.4 |
| Testing | pytest, pytest-asyncio, httpx TestClient |
| Security | `.env` secrets, CORS middleware, Pydantic input validation |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | — | Your Google AI Studio API key |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000,...` | Comma-separated CORS origins |
