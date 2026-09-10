@echo off
echo ================================================================
echo Starting PS 26057 Marine Hazard Detection Dashboard
echo ================================================================

cd /d "%~dp0"

echo [1/3] Starting Backend (FastAPI on port 8000)...
start "Sonar Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Frontend (Vite on port 3000)...
start "Sonar Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Opening Dashboard in browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:3000

echo ================================================================
echo Services are running:
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:8000
echo   - Health:   http://localhost:8000/api/health
echo ================================================================
