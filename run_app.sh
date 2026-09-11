#!/bin/bash
echo "================================================================="
echo "🏥 Launching MediKiosk Fullstack via Docker Compose..."
echo "================================================================="

if ! command -v docker &> /dev/null
then
    echo "⚠️ Docker is not installed or not in PATH."
    echo "Starting local Python + Vite dev servers instead..."
    
    # Run python backend
    (cd backend && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8005) &
    # Run npm frontend
    (cd frontend && npm run dev -- --host 0.0.0.0 --port 5173) &
    wait
    exit 0
fi

# Run Docker Compose
docker compose up --build
