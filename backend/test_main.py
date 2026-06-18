"""
Unit tests for the Carbon Footprint Tracker API.
Ensures health check and core endpoints are responsive.
"""
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    """Verify that the API health endpoint returns a 200 OK status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_frontend_serving():
    """Verify that the frontend root endpoint successfully serves the HTML."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
