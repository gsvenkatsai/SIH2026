# MediKiosk — Master Build Context

Paste this whole file as context at the start of any Claude Code session for this project. Then ask for ONE module at a time (see "Build Order").

---

## 1. What This Is

Kiosk-based patient pre-consultation history-taking system. Patient answers an adaptive AI interview + uploads old medical documents before seeing the doctor. System merges both into a structured, source-tagged record. Doctor reviews and approves — nothing reaches the record without doctor approval.

**Scope for this build: local-demo prototype only.** Not production. No auth, no cloud deploy, no real medical validation. Goal is a working click-through demo of the core loop.

**Non-negotiable design rule:** AI collects and organizes. Doctor verifies and decides. Every fact must carry a source tag (🎤 interview / 📄 document).

---

## 2. Tech Stack (locked — do not substitute)

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Backend | Python + FastAPI |
| DB | SQLite |
| LLM | Groq API (Llama 3.3/4) |
| ASR | Groq Whisper-large-v3 (optional, cut if time-short) |
| OCR/vision | Groq vision model (Llama-4-Scout/Maverick), image → structured JSON |
| Deployment | None — localhost only |
| Auth | None — role-select (Patient/Doctor) via route, not login |

Explicitly OUT for this build: AYUSH mode, accessibility mode, FHIR/ABDM/HIS integration, multilingual beyond cosmetic language buttons, real rule engine for flags (use LLM prompt instead), Tesseract/separate OCR service.

---

## 3. Screens (6 total)

1. Role select (Patient / Doctor)
2. Language select (static buttons, cosmetic — no real i18n needed)
3. Chief complaint capture (text input; voice optional)
4. Adaptive interview (one question at a time, progress indicator, calls backend per answer)
5. Document upload (image upload → Groq vision extraction → editable review)
6. Summary/confirmation (patient side) → Doctor dashboard (snapshot, evidence viewer, approve/edit)

---

## 4. Backend Endpoints

- `POST /interview/start` — in: `{chief_complaint: str}` → out: `{question: str, question_id: str}`. LLM picks first question from a predefined decision tree (see §6) for that complaint — LLM phrases/interprets only, does not invent tree branches.
- `POST /interview/answer` — in: `{visit_id, question_id, answer}` → out: next question OR `{status: "section_complete"}`
- `POST /document/extract` — in: image upload → out: `{diagnoses: [], medications: [], lab_values: [], dates: [], confidence: float}` via Groq vision
- `POST /record/finalize` — in: `visit_id` → merges interview answers + extracted doc facts → out: structured record with evidence tags + contradiction flags + attention flags (both via LLM prompt, not rule engine)
- `GET /doctor/queue` — list of visits pending review
- `GET /doctor/patient/{visit_id}` — full structured record with source tags
- `POST /doctor/approve` — in: `{visit_id, edits}` → marks approved

---

## 5. Data Model (SQLite)

- `patients` (id, name, language)
- `visits` (id, patient_id, chief_complaint, status: draft/reviewed/approved)
- `interview_responses` (id, visit_id, question, answer, timestamp)
- `documents` (id, visit_id, image_path, extracted_json, confidence)
- `final_record` (id, visit_id, structured_json_with_evidence_tags)

---

## 6. Groq Prompts (3 total — design these first, review before coding)

1. **Interview question generator** — input: chief complaint + decision tree for that complaint + prior Q&A history → output: next question (natural phrasing) or "section complete". Constrain hard: LLM must pick from tree branches, never invent new medical questions.
2. **Document OCR+extraction** — input: document image → output: structured JSON (diagnoses/meds/dates/lab values) + confidence score per field.
3. **Record merge + flag** — input: interview responses JSON + extracted document JSON → output: merged record with evidence tags per fact, contradiction flags (interview vs doc mismatch), attention flags (symptom combos worth flagging). Phrase flags as "recommend prompt assessment," never diagnosis.

Hardcode decision trees for 2–3 chief complaints only (e.g. chest pain, fever, cough) — not a full medical taxonomy.

---

## 7. Build Order

1. Backend skeleton — FastAPI + SQLite, all endpoints stubbed with dummy JSON
2. Groq prompts tested standalone (script, not in FastAPI yet) — lock JSON output shape
3. Wire real Groq calls into endpoints
4. Frontend screens one at a time, against working backend
5. Full walkthrough (patient flow → doctor flow), fix breaks

**Rule for AI-assisted coding sessions:** request ONE module per session (e.g. "build `/interview/start` endpoint using this exact prompt and this exact schema"). Never ask for "the whole app" in one go. Review every Groq prompt yourself before merging — don't let AI freelance the clinical logic.

---

## 8. Per-Module Request Template

When starting a new Claude Code session, after pasting this file, use:

> Build [module name]. Input: [X]. Output: [Y]. Use the schema/endpoint contract from §4–5 above exactly. Don't add scope beyond what's specified here.
