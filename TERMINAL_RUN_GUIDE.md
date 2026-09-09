# Step-by-Step Terminal Run Guide: Marine Debris & Sonar Detection Dashboard

This guide walks you through setting up and running both the **FastAPI Backend** and **React + Vite Frontend** directly from your terminal.

---

## 🏗 System Architecture Overview

- **Backend**: FastAPI (Python) running on `http://127.0.0.1:8000`
  - REST Endpoints & WebSocket for live ML detection streams (`/ws/live-feed`)
  - Auto-generated Swagger Documentation (`/docs`)
- **Frontend**: React + Vite + Tailwind CSS + Leaflet GIS running on `http://localhost:3000`
  - Vite dev server reverse-proxies `/api`, `/ws`, and `/uploads` directly to port 8000
- **Database**: PostgreSQL (Default) or local SQLite (`sonar_db.sqlite3`)

---

## 📋 Prerequisites

Ensure you have the following installed on your system:

| Requirement | Minimum Version | Check Command |
| :--- | :--- | :--- |
| **Python** | 3.10+ (tested with 3.14) | `python --version` |
| **Node.js** | 18.0+ (tested with 24.x) | `node -v` |
| **npm** | 9.0+ | `npm -v` |
| **Git** | Any modern version | `git --version` |

---

## 🚀 Running the Application Step-by-Step

To run the application manually, you will use **two terminal windows**:
1. **Terminal 1**: Backend (FastAPI)
2. **Terminal 2**: Frontend (Vite Dev Server)

---

### Step 1: Clone and Navigate to the Repository

Open your terminal (PowerShell, CMD, or Bash) and navigate to the project root:

```bash
git clone https://github.com/TusharBorase995/Marine_Debrie.git
cd Marine_Debrie
```
*(If you already have the repository on your machine, simply `cd` into your project directory).*

---

### Step 2: Database & Environment Setup

The backend looks for configuration in `backend/.env`.

1. Check or create `backend/.env`:
   ```bash
   # On Windows PowerShell:
   Copy-Item backend/.env.example backend/.env

   # On Linux / macOS / Git Bash:
   cp backend/.env.example backend/.env
   ```

2. Choose your database mode:
   - **Option A: PostgreSQL (Default & Recommended)**
     Ensure PostgreSQL is running and update `DATABASE_URL` in `backend/.env`:
     ```env
     DATABASE_URL=postgresql://<username>:<password>@localhost:5432/sonar_db
     ```
   - **Option B: SQLite (Offline Demo Mode, No PostgreSQL Required)**
     If you don't have PostgreSQL installed, set:
     ```env
     DATABASE_URL=sqlite:///./sonar_db.sqlite3
     ```

---

### Step 3: Start the Backend (Terminal 1)

1. Open **Terminal 1** and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. *(Recommended)* Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Windows (Command Prompt):
   python -m venv venv
   .\venv\Scripts\activate.bat

   # macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI development server with auto-reload:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. Verify that the backend is running:
   - **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
   - **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - **Alternative ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

### Step 4: Start the Frontend (Terminal 2)

1. Open a **new terminal window (Terminal 2)** and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   👉 **`http://localhost:3000`**

The dashboard will open, displaying the Marine Hazard Detection workstation, GIS interactive map, telemetry status, and live anomaly observation feed.

---

## ⚡ Quick Alternative: One-Click Startup (Windows)

If you are on Windows and prefer starting both services with a single command:

In PowerShell / CMD from the project root:
```powershell
.\run.bat
```
This batch script will:
1. Spawn the FastAPI backend on port `8000` in a new window.
2. Spawn the Vite frontend dev server on port `3000` in a new window.
3. Automatically launch your default browser to `http://localhost:3000`.

---

## 🧪 Testing & Verification from Terminal

### 1. Run Automated Test Suite
From the `backend/` directory:
```bash
python test_ml_integration.py
```
This runs end-to-end integration tests verifying:
- Health checks
- Live detection ingestion (`POST /api/detections`)
- Multipart form-data image uploads
- Multi-pass target spatial clustering & consolidation
- Batch mission imports (`.json` and `.zip` packages)
- Human-in-the-loop analyst review actions
- Mission export (JSON and CSV)

### 2. Send a Live Detection via cURL or PowerShell

**PowerShell:**
```powershell
$body = @{
    target_id = "TGT-TERM-01"
    class = "debris_net"
    confidence = 0.96
    latitude = 32.6512
    longitude = -117.5543
    estimated_size_m = 5.2
    shadow_verified = $true
    status = "pending_review"
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/detections" -Method Post -Body $body -ContentType "application/json"
```

**cURL:**
```bash
curl -X POST "http://127.0.0.1:8000/api/detections" \
     -H "Content-Type: application/json" \
     -d '{
       "target_id": "TGT-TERM-01",
       "class": "debris_net",
       "confidence": 0.96,
       "latitude": 32.6512,
       "longitude": -117.5543,
       "estimated_size_m": 5.2,
       "shadow_verified": true,
       "status": "pending_review",
       "timestamp": "2026-09-09T12:00:00Z"
     }'
```

The new target will appear instantly on the live GIS map and detection feed via the WebSocket connection!

---

## 🛠 Troubleshooting & Common Questions

### 1. Database Connection Error (`FATAL DATABASE ERROR`)
- **Symptom**: `Unable to connect to PostgreSQL at 'localhost:5432'`.
- **Solution**:
  - If using PostgreSQL: Verify the PostgreSQL service is started in Windows Services (`services.msc`) or Docker.
  - If you want offline mode without installing PostgreSQL: Open `backend/.env` and set:
    ```env
    DATABASE_URL=sqlite:///./sonar_db.sqlite3
    ```

### 2. Port Already in Use (Port 8000 or 3000)
- **Port 8000 (Backend)**: Check running python processes:
  ```powershell
  Get-Process python -ErrorAction SilentlyContinue
  ```
- **Port 3000 (Frontend)**: If port 3000 is occupied, Vite will prompt to run on port 3001 or you can free port 3000.

### 3. Execution Policy Error on Windows PowerShell
If running `.\venv\Scripts\Activate.ps1` gives an execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📦 Summary of Available Ports and URLs

| Service | URL |
| :--- | :--- |
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) |
| **FastAPI Root** | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **Swagger API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **ReDoc API Docs** | [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) |
| **System Health API** | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) |
| **Live WebSocket Feed** | `ws://127.0.0.1:8000/ws/live-feed` |
