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

## 🎙️ Troubleshooting Voice & Microphone

| Problem | Fix |
|---|---|
| **Microphone permission denied** | The kiosk shows a translated message with a typed-answer fallback. To re-enable: click the 🔒/🎤 icon in the browser address bar → Allow microphone → reload. |
| **"No microphone found"** | Connect a mic and check OS input device settings, then tap the mic again. |
| **"We didn't hear anything"** | Speak a little louder/closer to the mic; the recording must contain audio. |
| **Recording stops by itself** | Recordings are capped at 30 seconds for kiosk use — tap the stop button earlier and the answer will transcribe normally. |
| **Transcription fails / service unavailable** | Check `GROQ_API_KEY` is set and the backend has internet access. The typed-answer path always remains available. |
| **No voice playback of questions** | The browser has no Indian-language TTS voice installed. Install one (e.g. Windows: Settings → Time & Language → Speech) or use Chrome/Edge which ship `hi-IN`/`kn-IN` voices. Text mode remains fully functional. |
| **Wrong language transcribed** | Ensure the language selected on the first screen matches the language being spoken — it is passed as the Whisper language hint. |

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
       backend/test_red_flag_triage.py \
       backend/test_multilingual_voice.py
```

### 🪟 Windows (PowerShell):
```powershell
pytest backend/test_phase1_socrates.py backend/test_socrates_slots.py backend/test_record_merge_matrix.py backend/test_full_socrates_e2e.py backend/test_phase1_negation_isolation.py backend/test_phase2_universal_socrates.py backend/test_phase3_tiering_revisions.py backend/test_phase4_clarification_contradictions.py backend/test_red_flag_triage.py backend/test_multilingual_voice.py
```

---

## 🌐 Multilingual Support (English / हिन्दी / ಕನ್ನಡ)

MediKiosk's patient flow is fully multilingual. The patient picks **English, हिन्दी, or ಕನ್ನಡ** on the first screen, and every subsequent patient-facing screen — consent, chief complaint, adaptive interview questions, buttons, voice status, error messages, and summary — renders in that language.

### How it works

```text
canonical language code (en-IN / hi-IN / kn-IN)
        │
        ├── frontend i18n layer (src/i18n/)  → all static patient UI strings
        ├── ASR hint (mapped to en/hi/kn)    → Whisper transcription
        ├── TTS voice selection              → question & transcript readback
        └── per-response metadata            → doctor sees voice-origin evidence
```

- **Canonical codes everywhere:** language is stored as `en-IN` / `hi-IN` / `kn-IN` (legacy names like `"Kannada"` are auto-normalized for backwards compatibility). The single source of truth is `backend/app/languages.py`, mirrored by `frontend/src/i18n/` and exposed via `GET /config/languages`.
- **Questions stay framework-constrained:** the same language-independent `question_id` (e.g. `cp_radiation`) is phrased by the LLM in the selected language. Question IDs are never translated.
- **Mid-interview switching:** changing language during an interview keeps all collected SOCRATES data and re-renders in the new language.
- **Never shown to patients:** `undefined`, raw API errors, or internal status codes — missing translations fall back to English.

## 🎙️ Voice Pipeline

Voice is a first-class input modality feeding the **same** clinical engine as typed answers:

```text
Microphone (MediaRecorder, 30s cap)
        ↓  audio/webm
FastAPI  POST /voice/transcribe      ← ASR only — no clinical logic here
        ↓
Groq Whisper-large-v3 (language hint: en/hi/kn)
        ↓  transcript + confidence
Patient confirms / edits / retries    ← audio confirmation (PRD §5.2)
        ↓
POST /interview/answer               ← SAME pipeline as text input
        ↓
SOCRATES extraction → triage → structured history
```

Key properties:
- **Groq key never leaves the server** — the browser only talks to FastAPI.
- **Original transcripts are preserved verbatim** (e.g. `"ನೋವು ಎಡಗೈಗೆ ಹೋಗುತ್ತದೆ"`) alongside the structured interpretation — never overwritten by translation.
- **Mixed-language speech is accepted** (e.g. Kannada containing "chest pain") — the transcript is never rejected.
- **Voice evidence on the doctor dashboard:** voice-derived facts show `🎤 Voice — Kannada`, the original transcript, and the ASR confidence.

### Voice error handling

All failures map to translated, patient-friendly messages (never raw errors): permission denied, no microphone, empty recording, 30s timeout, network failure, ASR unavailable (typed-answer fallback always remains).

## 🔊 Text-to-Speech (Question Readback)

Questions and transcript confirmations are spoken aloud in the selected language:

1. **Browser Web Speech API** with an exact `en-IN` / `hi-IN` / `kn-IN` voice when available.
2. **Language-family fallback** (any `kn`/`hi`/`en` voice) otherwise.
3. **Text-only fallback** — if no voice exists, a small non-blocking notice is shown and the full text interface remains usable. The app NEVER becomes unusable due to missing TTS.

Controls: 🔊 Repeat Question and 🔇 Stop Audio accompany every question. Readback fires once per question (guarded against re-render double-play).

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
- **Dialogue & Slot Extraction**: Powered by `openai/gpt-oss-20b` for sub-second response times and token efficiency during live kiosk interactions.
- **Clinical EHR Synthesis**: Powered by `openai/gpt-oss-120b` for high-depth evidence synthesis, cross-document reconciliation, and contradiction detection.
- Model IDs are overridable via `GROQ_FAST_MODEL` / `GROQ_SYNTHESIS_MODEL` env vars (Groq retires models periodically — if a model 404s, update these).

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
│   │   ├── main.py              # FastAPI application, CORS & /config/languages
│   │   ├── database.py          # SQLite engine & SQLAlchemy 2.0 ORM session
│   │   ├── languages.py         # Canonical language config (en-IN/hi-IN/kn-IN)
│   │   ├── models.py            # Patient, Visit, InterviewResponse (+voice metadata), Document models
│   │   ├── schemas.py           # Pydantic request/response schemas & SOCRATES models
│   │   ├── trees.py             # Decision trees, NegEx negation engine & triage rules
│   │   ├── groq_service.py      # LLM dialogue, Whisper ASR, OCR & EHR synthesis
│   │   └── routes/
│   │       ├── interview.py     # Q&A progression, text & voice answer endpoints
│   │       ├── voice.py         # POST /voice/transcribe (ASR-only)
│   │       ├── document.py      # Document upload & Groq Vision OCR
│   │       ├── record.py        # EHR synthesis & clinical matrix generation
│   │       └── doctor.py        # Physician queue, edits, and sign-off
│   └── test_*.py                # 10 automated unit/integration test suites
└── frontend/
    ├── Dockerfile               # Production container with Nginx reverse proxy
    ├── nginx.conf               # Nginx server configuration (port 5173)
    ├── package.json             # React 19 & Vite dependencies
    └── src/
        ├── App.jsx              # Main kiosk and doctor portal state router
        ├── api.js               # Backend API client (incl. /voice/transcribe)
        ├── i18n/                # Language config, provider & locale bundles
        │   ├── index.jsx        #   useLanguage() / t() translation hook
        │   └── locales/         #   en-IN.json, hi-IN.json, kn-IN.json
        ├── hooks/
        │   ├── useVoiceRecorder.js  # MediaRecorder state machine
        │   └── useTextToSpeech.js   # Web Speech API readback w/ fallbacks
        └── components/          # Kiosk and physician UI components
            ├── RoleSelect.jsx
            ├── LanguageSelect.jsx
            ├── ChiefComplaint.jsx
            ├── AdaptiveInterview.jsx  # voice recording + transcript confirmation
            ├── DocumentUpload.jsx
            ├── PatientSummary.jsx
            ├── DoctorQueue.jsx
            └── DoctorPatientView.jsx  # shows 🎤 Voice evidence + transcripts
```
