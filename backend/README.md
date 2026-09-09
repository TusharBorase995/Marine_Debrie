# PS 26057 - FastAPI Backend Application Layer

This directory contains the FastAPI backend for **PS 26057** (AI-powered marine debris detection from side-scan sonar imagery).

## Quickstart

```bash
# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```

- REST Docs: `http://localhost:8000/docs`
- Live WebSocket Stream: `ws://localhost:8000/ws/live-feed`

## ML Integration Point
All mock data is isolated inside `mock_data.py` (top comment: `# TODO: Replace this mock generator with real inference pipeline output...`).
The pipeline uses the abstract `InferenceProvider` class (`app/ml/base.py`). To integrate real YOLO + U-Net models, implement `RealInferenceProvider(InferenceProvider)` without changing API routes or frontend code.
