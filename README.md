# 🩺 MediKiosk — Patient Pre-Consultation History Taking System

MediKiosk is a kiosk-based patient history-taking and clinical verification platform. Prior to seeing a doctor, patients answer an adaptive AI intake interview (in **Kannada**, **Hindi**, or **English**) via text or real voice input (Groq Whisper ASR) and upload previous medical documents (prescriptions/lab reports). 

The system synthesizes both data sources into a source-tagged clinical snapshot with contradiction & attention flags for physician review and sign-off.

> 🛡️ **Non-Negotiable Design Rule:** *AI collects and organizes facts. Doctor verifies and decides. Every fact carries an explicit source tag (🎤 interview / 📄 document).*

---

## ⚡ Quick Start (Single Command with Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.
- A **Groq API Key** (a default fallback key is included in `.env`, or export your own).

### 🚀 Launch with a Single Command

#### On Windows (CMD or PowerShell):
Double-click `run_app.bat` or run in terminal:
```cmd
run_app.bat
```
*(or run `docker compose up --build`)*

#### On Linux / macOS:
```bash
./run_app.sh
```
*(or run `docker compose up --build`)*

That's it! Once containers finish starting:
- 💻 **Open Web Kiosk App**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend API**: [http://localhost:8005](http://localhost:8005)
- 📚 **Swagger API Docs**: [http://localhost:8005/docs](http://localhost:8005/docs)

> 💡 **Windows Troubleshooting Note:** Ensure **Docker Desktop for Windows** is running with **WSL 2 backend** enabled. If using PowerShell, run as Administrator if port permissions are restricted.

---

## ⚙️ Customizing Environment Variables
To use your own **Groq API Key**, set it before running docker compose:

```bash
export GROQ_API_KEY="gsk_your_groq_api_key_here"
docker compose up --build
```
Or create a `.env` file in the project root:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

---

## 💻 Running Locally (Without Docker)

### 1. Start Python FastAPI Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8005
```

### 2. Start React + Vite Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 🌟 Core Features Implemented

### 📱 Patient Intake Kiosk
1. **Role Select**: Entry points for Patient Kiosk and Doctor Portal.
2. **Language Select**: Supports **Kannada (ಕನ್ನಡ)**, **Hindi (हिन्दी)**, and **English**.
3. **Chief Complaint Capture**: Text input with quick selection chips (*Chest pain radiating to left arm*, *High fever for 3 days*, etc.).
4. **Adaptive AI Interview**:
   - Guided by decision tree logic (*Chest Pain*, *Fever*, *Cough*, *General*).
   - Animated progress tracking and Q&A history accordion preview.
   - **Real Voice Input (Groq Whisper-large-v3)**: Records browser microphone audio and populates editable transcript in selected language.
5. **Medical Document Upload & OCR**:
   - Upload prescriptions or lab reports.
   - Groq Vision extraction displaying diagnoses, medications, lab values, dates, and confidence ratings.
6. **Patient Summary**:
   - Intake confirmation before handover to doctor.

### 👨‍⚕️ Doctor Portal & Clinical Governance
1. **Physician Verification Queue**: Status badges (`draft`, `reviewed`, `approved`), document counts, and timestamps.
2. **Source-Tagged Evidence Grid**:
   - 🎤 **Adaptive Interview Evidence**: List of concrete patient statements.
   - 📄 **Document OCR Extractions**: List of prescription and lab report findings.
   - ❓ **Incomplete / Unclear Patient Data Gaps**: Dedicated section highlighting missing or vague data points (*"I don't know"*, *"unclear"* answers) so doctors see data gaps clearly.
3. **Doctor Verification & Approval**:
   - Editable clinical summary field.
   - Physician notes & prescription directives textarea.
   - Single-click **Approve & Sign Record** button that locks the record.

---

## 🧪 Testing & Verification

Run the automated test scripts from inside the `backend/` directory:

```bash
cd backend
./venv/bin/python test_backend.py        # Tests database models & API contracts
./venv/bin/python test_live_system.py     # End-to-end simulation of full intake & doctor approval
./venv/bin/python test_whisper_languages.py # Tests Groq Whisper transcription accuracy across 3 languages
```

---

## 📂 Project Architecture

```text
├── docker-compose.yml           # Single-command fullstack orchestration
├── run_app.sh                   # Helper launch script
├── README.md                    # Setup & workflow guide
├── MediKiosk_Build_Summary.txt  # Detailed architecture reference document
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py              # FastAPI app & CORS middleware
│   │   ├── database.py          # SQLite connection & session
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── trees.py             # Decision tree structures
│   │   ├── groq_service.py      # Groq LLM & Whisper ASR service
│   │   └── routes/              # API endpoints (interview, document, record, doctor)
│   └── test_live_system.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf               # Port 5173 Nginx reverse proxy
    ├── package.json
    └── src/
        ├── App.jsx              # Main state machine
        ├── api.js               # API wrapper functions
        └── components/          # 8 React screen components
```
