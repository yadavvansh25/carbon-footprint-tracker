<div align="center">

# 🌿 Footprint — AI Carbon Tracker

**A production-ready, AI-powered Carbon Footprint Tracker built with FastAPI + Gemini 1.5 Flash**

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini%201.5%20Flash-AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Tests](https://img.shields.io/badge/Tests-6%2F6%20Passing-22c55e?style=for-the-badge&logo=pytest&logoColor=white)](backend/tests/test_api.py)
[![License](https://img.shields.io/badge/License-MIT-64748b?style=for-the-badge)](LICENSE)

> Type your day in plain English. Get your CO₂ footprint, personalised habit analysis, and 3 actionable eco-tasks — instantly.

![Footprint App Screenshot](https://via.placeholder.com/900x500/0f172a/22c55e?text=Footprint+%E2%80%94+AI+Carbon+Tracker)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗣️ **Natural Language Logging** | Type activities conversationally — "I drove 15km and had a beef burger" |
| 🤖 **Gemini AI Analysis** | Gemini 1.5 Flash estimates CO₂, breaks it into categories, and analyses your habits |
| 🎮 **Gamified Eco-Actions** | 3 personalised, checkable micro-tasks with quantified CO₂ savings |
| 📊 **Real-time Dashboard** | Animated score ring, category bars, doughnut chart, and 7-day trend |
| 🔥 **Streak Tracking** | Daily login streak persisted in localStorage |
| ♿ **Fully Accessible** | ARIA labels, keyboard navigation, live regions, semantic HTML5 |
| 🧪 **6 Pytest Tests** | Fully mocked — runs without an API key |

---

## 🏗️ Architecture

```
Footprint Platform/
├── backend/
│   ├── main.py                  # FastAPI app factory + CORS + health endpoint
│   ├── routes/
│   │   └── logs.py              # POST /api/logs/analyse
│   ├── schemas/
│   │   └── models.py            # Pydantic v2 request/response models
│   ├── services/
│   │   └── ai_service.py        # Gemini 1.5 Flash async integration
│   └── tests/
│       └── test_api.py          # 6 pytest tests (mocked)
├── frontend/
│   ├── index.html               # Semantic HTML5 + Tailwind CSS (CDN) + glassmorphism
│   └── app.js                   # Vanilla JS — charts, gamification, persistence
├── .env.example                 # Environment variable template
├── requirements.txt             # Python dependencies
└── pytest.ini                   # Pytest configuration
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/footprint-ai-carbon-tracker.git
cd footprint-ai-carbon-tracker
```

### 2. Install Dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> 🔑 Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey)

### 4. Run the Backend

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5. Serve the Frontend

Open a new terminal:
```bash
python3 -m http.server 5500 --directory frontend
```

**Open your browser:** [http://localhost:5500](http://localhost:5500)

---

## 🧪 Running Tests

The test suite is fully mocked — **no API key required**.

```bash
source .venv/bin/activate
pytest backend/tests/test_api.py -v
```

### Test Results

```
PASSED  test_health_check                        [ 16%]
PASSED  test_analyse_valid_activity              [ 33%]
PASSED  test_analyse_empty_input_returns_422     [ 50%]
PASSED  test_analyse_too_long_input_returns_422  [ 66%]
PASSED  test_analyse_ai_runtime_error_returns_503 [ 83%]
PASSED  test_analyse_ai_bad_json_returns_400     [100%]

============================== 6 passed in 0.69s ===============================
```

---

## 🌐 API Reference

### `GET /health`
```json
{
  "status": "ok",
  "version": "1.0.0",
  "message": "Carbon Footprint Tracker API is running."
}
```

### `POST /api/logs/analyse`

**Request Body:**
```json
{
  "activity_text": "I drove 15km to work in a petrol car and ate a beef burger for lunch."
}
```

**Response:**
```json
{
  "estimated_co2": 6.4,
  "categories": {
    "food": 3.1,
    "transport": 2.8,
    "energy": 0.3,
    "other": 0.2
  },
  "habit_analysis": "Your beef burger contributed significantly to today's footprint...",
  "actionable_tips": [
    {
      "id": "tip_1",
      "title": "Swap your beef burger for chicken tomorrow",
      "description": "Replacing a beef burger with chicken saves approximately 1.8 kg CO₂e per meal.",
      "co2_saving": 1.8
    },
    {
      "id": "tip_2",
      "title": "Carpool your 15km commute once this week",
      "description": "Sharing your commute with one colleague cuts transport emissions by ~50%, saving 1.4 kg CO₂e.",
      "co2_saving": 1.4
    },
    {
      "id": "tip_3",
      "title": "Try a fully plant-based lunch on Friday",
      "description": "A fully plant-based meal saves up to 2.5 kg CO₂e vs a red-meat equivalent.",
      "co2_saving": 2.5
    }
  ],
  "raw_activity": "I drove 15km to work in a petrol car and ate a beef burger for lunch."
}
```

**Interactive API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🔒 Security

- **API key** is read exclusively from `.env` — never hardcoded
- **CORS** restricted to configured origins via `ALLOWED_ORIGINS` env var
- **Input sanitization**: Pydantic strips null bytes, normalizes whitespace, enforces `min_length=5` / `max_length=500`
- **Error isolation**: `ValueError` → 400, `RuntimeError` → 503, Pydantic → 422

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, Uvicorn, Pydantic v2, python-dotenv |
| **AI** | Google GenAI SDK (`gemini-1.5-flash`) |
| **Frontend** | Semantic HTML5, Vanilla JavaScript, Tailwind CSS (CDN) |
| **Charts** | Chart.js (bar + doughnut) |
| **Testing** | Pytest, pytest-asyncio, httpx |
| **Fonts** | Inter (Google Fonts) |

---

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Your Google Gemini API key |
| `ALLOWED_ORIGINS` | ❌ | `localhost:3000,5500,5173` | Comma-separated CORS origins |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Built with ❤️ and 🌿 for a greener planet</p>
  <p><strong>Footprint</strong> — Know your impact. Change your habits. Save the planet.</p>
</div>
