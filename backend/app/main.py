from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import interview, document, record, doctor

# Create SQLite tables on startup
Base.metadata.create_all(bind=engine)

def _migrate_db():
    try:
        with engine.connect() as conn:
            cursor = conn.connection.cursor()
            existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(visits)").fetchall()]
            if "socrates_state" not in existing_cols:
                cursor.execute("ALTER TABLE visits ADD COLUMN socrates_state JSON")
            if "triage_level" not in existing_cols:
                cursor.execute("ALTER TABLE visits ADD COLUMN triage_level VARCHAR(50) DEFAULT 'NORMAL'")
            if "triage_message" not in existing_cols:
                cursor.execute("ALTER TABLE visits ADD COLUMN triage_message TEXT")
            conn.connection.commit()
    except Exception as e:
        print(f"[DB Migration Info] {e}")

_migrate_db()

app = FastAPI(
    title="MediKiosk API",
    description="Backend service for MediKiosk patient pre-consultation history taking system",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local Vite React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(interview.router)
app.include_router(document.router)
app.include_router(record.router)
app.include_router(doctor.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "MediKiosk API Server",
        "version": "1.0.0",
        "docs_url": "/docs"
    }
