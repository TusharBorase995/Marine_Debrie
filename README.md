# PS 26057 — AI-Powered Automated Underwater Marine Debris and Anomaly Detection System

A unified hydrographic survey and marine hazard detection dashboard designed to consume, store, visualize, review, and export ML-generated detections from side-scan sonar imagery.

---

## 🌐 Live Cloud Deployment

* **Production Web App (Vercel)**: [https://marine-debrie.vercel.app](https://marine-debrie.vercel.app)
* **Backend API Service (Render)**: [https://marine-debrie.onrender.com](https://marine-debrie.onrender.com)
* **Interactive Swagger Docs**: [https://marine-debrie.onrender.com/docs](https://marine-debrie.onrender.com/docs)
* **System Health Endpoint**: [https://marine-debrie.onrender.com/api/health](https://marine-debrie.onrender.com/api/health)
* **Cloud Database & Storage**: Neon Serverless PostgreSQL + Neon S3 Object Storage

---

## Quick Start

> 📖 **Looking for full step-by-step terminal commands, troubleshooting, and API testing?**
> Check out the complete [Terminal Run Guide](TERMINAL_RUN_GUIDE.md).

### One-Click Startup (Windows)
Double-click `run.bat` in the root folder, or run in PowerShell:
```powershell
.\run.bat
```
This automatically:
1. Launches the FastAPI backend on `http://127.0.0.1:8000`
2. Launches the Vite frontend dev server on `http://localhost:3000`
3. Opens the dashboard directly in your default web browser

---

## Manual Startup

### 1. Backend (FastAPI)
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Health Check: `http://127.0.0.1:8000/api/health`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite + Tailwind)
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000`

---

## Ingestion Modes

### Mode A: Live ML Stream
- **Endpoint**: `POST /api/detections`
- **Payload**: Single canonical detection JSON + optional evidence image
- **Real-time**: Broadcasts over WebSocket (`/ws/live-feed`) to the dashboard with radar ripple animation.

### Mode B: Mission Batch Import
- **Endpoint**: `POST /api/missions/{mission_id}/import`
- **Payload**: Either a `mission.zip` (containing `detections.json` and an `images/` directory) or a `detections.json` file.
- **Processing**: Automatically extracts images, links observations to physical targets, and loads the survey.

---

## Key Features
- **Strict Scope Boundary**: Consumes ML output; does not run onboard AUV simulation or CV models.
- **Canonical Schema**: Identical data structure across both live and batch modes.
- **1 Physical Target = 1 GIS Marker**: Consolidates multi-pass sonar observations under a single parent `target_id`.
- **Dedicated Evidence Images**: Each target displays its actual associated acoustic sonar image.
- **Analyst Review**: In-dashboard human-in-the-loop verification (`pending_review`, `confirmed`, `rejected`) via `POST /api/detections/{id}/review`.
- **Mission Export**: Full JSON and CSV mission reporting via `GET /api/missions/{id}/export?format=json|csv`.
- **Aesthetic**: Maritime Command Center / Hydrographic Survey Workstation theme.