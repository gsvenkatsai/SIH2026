@echo off
echo =================================================================
echo 🏥 Launching MediKiosk Fullstack Locally (Windows Without Docker)
echo =================================================================

if not exist backend\venv (
    echo [1/3] Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
)

echo [2/3] Starting FastAPI Backend on Port 8005...
start "MediKiosk Backend (Port 8005)" cmd /k "cd backend && call venv\Scripts\activate.bat && pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port 8005"

echo [3/3] Starting React Vite Frontend on Port 5173...
start "MediKiosk Frontend (Port 5173)" cmd /k "cd frontend && call npm install && npm run dev -- --host 0.0.0.0 --port 5173"

echo.
echo =================================================================
echo ✅ MediKiosk services launched in separate windows!
echo 💻 Web Kiosk:    http://localhost:5173
echo ⚙️ Backend API:  http://localhost:8005
echo 📚 Swagger Docs: http://localhost:8005/docs
echo =================================================================
pause
