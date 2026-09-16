# 🩺 MediKiosk — Patient Pre-Consultation History Taking System
> **Smart India Hackathon (SIH26047) | Team Codeholics**

MediKiosk is an intelligent, kiosk-based clinical pre-consultation history-taking and verification platform. Prior to seeing a physician, patients complete an adaptive clinical intake interview in **Kannada (ಕನ್ನಡ)**, **Hindi (हिन्दी)**, or **English** via text or voice input (Groq Whisper-large-v3 ASR) and upload historical medical records (prescriptions / lab reports).

The system maps patient responses into the canonical **8-dimension SOCRATES pain and symptom assessment framework**, evaluates cardiac red-flag risk in real time, and synthesizes an evidence-tagged clinical snapshot with attention and contradiction flags for physician verification and sign-off.

> 🛡️ **Non-Negotiable Clinical Design Rule:**  
> *AI collects, maps, and organizes evidence. The physician verifies and decides. Every clinical fact carries an explicit source badge (🎤 Interview / 📄 Document).*

---

## ⚡ Quick Start: Docker (Single Command)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.
- **Windows Users**: Ensure Docker Desktop is running with the **WSL 2 backend** enabled.
- A **Groq API Key** (set in `.env` or exported in your environment).

---

### 🪟 On Windows (CMD or PowerShell)

Double-click `run_app.bat` or run in your terminal:
```cmd
run_app.bat
```
*(or manually: `docker compose up --build`)*

---

### 🐧 On Linux / macOS

Make the script executable and run:
```bash
chmod +x run_app.sh
./run_app.sh
```
*(or manually: `docker compose up --build`)*

---

### 🌐 Access the Application

Once containers finish starting:
- 💻 **Web Kiosk & Doctor Portal**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **FastAPI Backend API**: [http://localhost:8005](http://localhost:8005)
- 📚 **Swagger Interactive Docs**: [http://localhost:8005/docs](http://localhost:8005/docs)

---

## ⚙️ Setting Your Groq API Key

MediKiosk uses Groq for high-speed LLM inference and Whisper ASR. You can provide your API key in one of two ways:

### Option A: Create a `.env` File (Recommended)
Create a `.env` file in the project root:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### Option B: Export via Terminal

#### 🪟 Windows (PowerShell)
```powershell
$env:GROQ_API_KEY="gsk_your_groq_api_key_here"
```

#### 🪟 Windows (Command Prompt - CMD)
```cmd
set GROQ_API_KEY=gsk_your_groq_api_key_here
```

#### 🐧 Linux / macOS (Bash / Zsh)
```bash
export GROQ_API_KEY="gsk_your_groq_api_key_here"
```

---

## 💻 Running Locally (Without Docker)

If you prefer to run the Python backend and React Vite frontend directly on your host machine:

### Prerequisites
- **Python**: 3.10 to 3.13 installed
- **Node.js**: 18+ and `npm` installed

---

### 🪟 On Windows (Without Docker)

#### Option 1: Single-Click Script
Double-click `run_local.bat` or execute in terminal:
```cmd
run_local.bat
```
This automatically sets up `backend\venv`, installs Python requirements, installs npm packages, and launches both services in separate terminal windows.

#### Option 2: Manual Windows Setup

**Terminal 1 — Python FastAPI Backend:**
```powershell
# PowerShell:
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8005
```
*(If using classic CMD, activate with: `call venv\Scripts\activate.bat`)*

**Terminal 2 — React Vite Frontend:**
```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

---

### 🐧 On Linux / macOS (Without Docker)

**Terminal 1 — Python FastAPI Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8005
```

**Terminal 2 — React Vite Frontend:**
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 🧪 Running Automated Tests

MediKiosk includes a comprehensive test suite (38 automated tests across 9 suites) verifying clinical negation boundaries, 8-dimension SOCRATES extraction, cardiac red flag triage, model tiering, symptom revisions, and clarification retries.

Run the test suite with pytest from the project root:

### 🐧 Linux / macOS:
```bash
pytest backend/test_phase1_socrates.py \
       backend/test_socrates_slots.py \
       backend/test_record_merge_matrix.py \
       backend/test_full_socrates_e2e.py \
       backend/test_phase1_negation_isolation.py \
       backend/test_phase2_universal_socrates.py \
       backend/test_phase3_tiering_revisions.py \
       backend/test_phase4_clarification_contradictions.py \
       backend/test_red_flag_triage.py
```

### 🪟 Windows (PowerShell):
```powershell
pytest backend/test_phase1_socrates.py backend/test_socrates_slots.py backend/test_record_merge_matrix.py backend/test_full_socrates_e2e.py backend/test_phase1_negation_isolation.py backend/test_phase2_universal_socrates.py backend/test_phase3_tiering_revisions.py backend/test_phase4_clarification_contradictions.py backend/test_red_flag_triage.py
```

---

## 🌟 Clinical Architecture & Features

### 1. 📋 Canonical 8-Dimension SOCRATES Matrix
Every patient intake maps to the standardized clinical framework:
- **S**ite (anatomical location)
- **O**nset (sudden vs. gradual, triggers)
- **C**haracter (crushing, burning, stabbing, dull ache)
- **R**adiation (jaw, left arm, back, epigastrium)
- **A**ssociated symptoms (nausea, diaphoresis, shortness of breath)
- **T**iming & duration (intermittent, constant, episodic)
- **E**xacerbating / relieving factors (exertion, rest, deep breath)
- **S**everity (scale 1–10, pain trajectory)

### 2. 🛡️ Clause-Based NegEx Negation Engine
- Accurately interprets natural negative phrasing without false alerts (e.g., *"no left arm pain"*, *"denies shortness of breath"*, *"sweating: absent"*).
- Respects clause boundaries bounded by punctuation and contrastive markers (`but`, `however`, `yet`).
- Distinguishes pleuritic chest pain exacerbation (*"pain worsens on deep breath"*) from true autonomic dyspnea (*"shortness of breath"*).

### 3. 🚨 Deterministic Cardiac Red-Flag Circuit Breaker
- Detects high-risk Acute Coronary Syndrome (ACS) patterns (e.g., crushing substernal chest pain radiating to left arm/jaw with autonomic distress or severity $\ge 7$).
- Also detects atypical ACS equivalents (epigastric/jaw/arm discomfort with diaphoresis or dyspnea).
- Prompts immediate emergency triage notifications (`CRITICAL_RED_FLAG`) and allows immediate intake shortening to expedite physician review.

### 4. ⚡ Tiered LLM Architecture
- **Dialogue & Slot Extraction**: Powered by `llama-3.1-8b-instant` for sub-second response times and token efficiency during live kiosk interactions.
- **Clinical EHR Synthesis**: Powered by `llama-3.3-70b-versatile` for high-depth evidence synthesis, cross-document reconciliation, and contradiction detection.

### 5. 🔄 Audit Trail & Verbal Self-Contradiction Detection
- When a patient updates a symptom report during intake (e.g. initial pain reported as *2/10*, later escalated to *9/10*), the system preserves timestamped revision history.
- The doctor dashboard highlights revised slots with a **`🕒 Revised`** indicator.
- Discrepancies between earlier and later statements are flagged as **Verbal Symptom Revisions** recommending prompt evaluation.

### 6. 🔄 One-Shot Fallback Clarification
- If a patient provides an ambiguous response (*"I'm not really sure"* or *"it's hard to tell"*), the system uses a one-shot retry asking a simplified plain-language fallback question.
- Strict anti-looping safeguards ensure questions are never asked more than once.

### 7. 📄 Medical Document OCR & Reconciliation
- Patients can upload prescription slips or diagnostic lab reports.
- Vision OCR extracts diagnoses, medications, dosages, and dates.
- Cross-references verbal interview statements against documented clinical history to catch safety contradictions (e.g. denying cardiac history when documents show previous myocardial infarction or nitroglycerin prescriptions).

---

## 📂 Project Structure

```text
├── docker-compose.yml           # Multi-container orchestration (FastAPI + Vite/Nginx)
├── run_app.bat                  # Single-click launcher for Windows (Docker)
├── run_app.sh                   # Single-click launcher for Linux/macOS (Docker/Local)
├── run_local.bat                # Single-click launcher for Windows (Local without Docker)
├── README.md                    # System documentation & setup guide
├── backend/
│   ├── Dockerfile               # Production container for FastAPI backend
│   ├── requirements.txt         # Python dependencies
│   ├── app/
│   │   ├── main.py              # FastAPI application & CORS configuration
│   │   ├── database.py          # SQLite engine & SQLAlchemy 2.0 ORM session
│   │   ├── models.py            # Patient, Visit, InterviewResponse, Document models
│   │   ├── schemas.py           # Pydantic request/response schemas & SOCRATES models
│   │   ├── trees.py             # Decision trees, NegEx negation engine & triage rules
│   │   ├── groq_service.py      # LLM dialogue, Whisper ASR, OCR & EHR synthesis
│   │   └── routes/
│   │       ├── interview.py     # Q&A progression, text & voice endpoints
│   │       ├── document.py      # Document upload & Groq Vision OCR
│   │       ├── record.py        # EHR synthesis & clinical matrix generation
│   │       └── doctor.py        # Physician queue, edits, and sign-off
│   └── test_*.py                # 9 automated unit/integration test suites
└── frontend/
    ├── Dockerfile               # Production container with Nginx reverse proxy
    ├── nginx.conf               # Nginx server configuration (port 5173)
    ├── package.json             # React 19 & Vite dependencies
    └── src/
        ├── App.jsx              # Main kiosk and doctor portal state router
        ├── api.js               # Backend API client
        └── components/          # Kiosk and physician UI components
            ├── RoleSelect.jsx
            ├── LanguageSelect.jsx
            ├── ChiefComplaint.jsx
            ├── AdaptiveInterview.jsx
            ├── DocumentUpload.jsx
            ├── PatientSummary.jsx
            ├── DoctorQueue.jsx
            └── DoctorPatientView.jsx
```
