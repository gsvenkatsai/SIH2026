@echo off
echo =================================================================
echo 🏥 Launching MediKiosk Fullstack on Windows via Docker...
echo =================================================================

docker compose up --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️ Docker compose failed or Docker Desktop is not running.
    echo Make sure Docker Desktop for Windows is open and running.
    pause
)
