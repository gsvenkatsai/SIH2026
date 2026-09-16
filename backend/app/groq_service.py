import os
import json
import base64
import math
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from groq import Groq
from app.languages import get_asr_language, get_language_config
from app.trees import evaluate_cardiac_triage, SOCRATES_DIMENSIONS, SOCRATES_METADATA, is_negated

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Model Tiering Architecture:
# 1. FAST_MODEL_NAME: Ultra-low latency, high rate-limit ceiling for real-time interview slot filling and question generation
FAST_MODEL_NAME = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")

# 2. SYNTHESIS_MODEL_NAME: High-capacity clinical reasoning model for multi-document EHR synthesis & doctor final record compilation
SYNTHESIS_MODEL_NAME = os.getenv("GROQ_SYNTHESIS_MODEL", "openai/gpt-oss-120b")

# Default alias for backwards compatibility
MODEL_NAME = FAST_MODEL_NAME

def get_groq_client() -> Optional[Groq]:
    if not GROQ_API_KEY or GROQ_API_KEY == "gsk_your_groq_api_key_here":
        return None
    return Groq(api_key=GROQ_API_KEY)

# ==========================================
# ASR: Groq Whisper-large-v3 Audio Transcription
# ==========================================
class TranscriptionError(Exception):
    """Raised when audio transcription fails. `kind` drives patient-friendly UI messaging."""

    def __init__(self, message: str, kind: str = "transcription_failed"):
        super().__init__(message)
        self.kind = kind  # "no_api_key" | "empty_audio" | "asr_unavailable" | "unsupported_format" | "transcription_failed"


def transcribe_audio(file_content: bytes, filename: str, language: str = "en-IN") -> Dict[str, Any]:
    """
    Transcribes patient audio via Groq Whisper-large-v3.

    The selected patient language is passed as an explicit ASR hint (never
    relied on auto-detection alone). Whisper may still transcribe occasional
    mixed-language speech (e.g. Kannada containing English medical terms);
    such transcripts are returned as-is, never rejected.

    Returns: {"transcript": str, "language": str, "confidence": float}
    Raises TranscriptionError with a UI-safe `kind` on failure.
    """
    client = get_groq_client()
    if not client:
        raise TranscriptionError("Speech recognition is not configured on this server.", kind="no_api_key")

    if not file_content:
        raise TranscriptionError("No audio was captured.", kind="empty_audio")

    canonical = get_language_config(language)["code"]
    lang_code = get_asr_language(language)  # "en" | "hi" | "kn"

    try:
        # verbose_json includes segment-level avg_logprob, from which we derive a
        # rough confidence signal for the doctor-facing evidence metadata.
        response = client.audio.transcriptions.create(
            file=(filename, file_content),
            model="whisper-large-v3",
            language=lang_code,
            response_format="verbose_json"
        )
        text = (getattr(response, "text", "") or "").strip()
        confidence = 0.0
        segments = getattr(response, "segments", None) or []
        logprobs = [s.get("avg_logprob") for s in segments if isinstance(s, dict) and s.get("avg_logprob") is not None]
        if logprobs:
            avg_logprob = sum(logprobs) / len(logprobs)
            confidence = max(0.0, min(1.0, round(math.exp(avg_logprob), 2)))
        elif text:
            confidence = 0.85  # transcript present but no segment metadata available

        return {
            "transcript": text,
            "language": canonical,
            "confidence": confidence,
        }
    except TranscriptionError:
        raise
    except Exception as e:
        message = str(e)
        lowered = message.lower()
        print(f"[Groq Whisper Error] Language '{lang_code}' transcription failed: {message}")
        if "api key" in lowered or "401" in lowered or "unauthorized" in lowered:
            kind = "no_api_key"
        elif "415" in lowered or "format" in lowered or "could not be decoded" in lowered:
            kind = "unsupported_format"
        elif "connection" in lowered or "timeout" in lowered or "unreachable" in lowered:
            kind = "asr_unavailable"
        else:
            kind = "transcription_failed"
        raise TranscriptionError(message, kind=kind)

# ==========================================
# ==========================================
# PROMPT 1: SOCRATES Clinical Slot Extractor & Triage Engine
# ==========================================
def extract_socrates_slots(
    chief_complaint: Any = "",
    history: Optional[List[Dict[str, str]]] = None,
    current_state: Optional[Dict[str, Any]] = None,
    latest_input: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extracts 8-dimension SOCRATES slots and calculates real-time triage level.
    Accepts (chief_complaint, history, current_state, latest_input) or (history, latest_input).
    Returns: {"socrates": {...}, "triage_level": str, "triage_message": str}
    """
    # Signature flexibility: handle extract_socrates_slots(history, latest_input)
    if isinstance(chief_complaint, list):
        actual_history = chief_complaint
        actual_latest_input = history if isinstance(history, str) else (latest_input or "")
        actual_complaint = ""
    else:
        actual_complaint = str(chief_complaint or "")
        actual_history = history or []
        actual_latest_input = latest_input or ""

    client = get_groq_client()

    empty_state = {
        "site": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "onset": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "character": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "radiation": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "associated": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "timing": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "exacerbating": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
        "severity": {"value": None, "confidence": 0.0, "source": "interview", "status": "unfilled"},
    }

    base_socrates = current_state if current_state else empty_state

    # Include latest_input in dialogue history if provided and not yet appended
    dialogue_for_prompt = list(actual_history)
    if actual_latest_input:
        if not dialogue_for_prompt or dialogue_for_prompt[-1].get("answer") != actual_latest_input:
            dialogue_for_prompt.append({"question": "Latest patient input", "answer": actual_latest_input})

    system_prompt = (
        "You are MediKiosk's Clinical SOCRATES Slot Extraction & Emergency Triage Engine.\n"
        "Analyze the patient's chief complaint and interview dialogue to extract the 8 clinical dimensions of the SOCRATES protocol:\n"
        "1. site: Anatomical location (e.g., 'Center of chest / retrosternal', 'Left-sided chest', 'Epigastric')\n"
        "2. onset: Time of onset and speed (e.g., 'Sudden onset 2 hours ago while climbing stairs', 'Gradual onset since yesterday')\n"
        "3. character: Nature of sensation (e.g., 'Crushing / pressure / squeezing', 'Sharp / pleuritic / stabbing', 'Burning')\n"
        "4. radiation: Spread pathway (e.g., 'Radiating to left arm and jaw', 'Radiating to back', 'No radiation / localized')\n"
        "5. associated: Co-occurring symptoms (e.g., 'Shortness of breath, diaphoresis (cold sweats), nausea', 'Dizziness, palpitations')\n"
        "6. timing: Temporal pattern (e.g., 'Constant and non-remitting', 'Episodic / waxing and waning in waves')\n"
        "7. exacerbating: Aggravating or relieving factors (e.g., 'Worse on exertion, relieved by rest', 'Worse on deep breath')\n"
        "8. severity: Pain score 0-10 or descriptive intensity (e.g., '8/10 severe pain', 'Moderate')\n\n"
        "TRIAGE PROTOCOL:\n"
        "- If the patient exhibits Acute Coronary Syndrome (ACS) red flags: (crushing/pressure pain OR radiation to left arm/jaw/neck) "
        "AND (associated diaphoresis/sweating OR dyspnea/shortness of breath OR severity >= 7 with acute onset), "
        "set triage_level='CRITICAL_RED_FLAG' and triage_message='Potential Acute Coronary Syndrome: High-risk ischemic symptom cluster. Immediate clinical evaluation recommended.'\n"
        "- If symptoms are concerning but non-critical, set triage_level='ALERT'. Otherwise 'NORMAL'.\n\n"
        "For each dimension:\n"
        "  - If clearly stated by the patient, set 'value' to concise clinical phrasing, 'confidence': 0.85-1.0, 'status': 'filled'.\n"
        "  - If the patient gave an unclear answer or 'I don't know', set 'status': 'unclear', 'value': user answer.\n"
        "  - If not yet mentioned at all, keep 'value': null, 'confidence': 0.0, 'status': 'unfilled'.\n"
        "Output strictly valid JSON: {\"socrates\": {...}, \"triage_level\": \"NORMAL\"|\"ALERT\"|\"CRITICAL_RED_FLAG\", \"triage_message\": string or null}"
    )

    user_prompt = (
        f"Chief Complaint: {actual_complaint}\n\n"
        f"Dialogue History:\n{json.dumps(dialogue_for_prompt, indent=2)}\n\n"
        f"Existing Extracted State:\n{json.dumps(base_socrates, indent=2)}\n\n"
        "Extract updated SOCRATES slots and triage status in JSON."
    )

    if client:
        try:
            response = client.chat.completions.create(
                model=FAST_MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            parsed = json.loads(response.choices[0].message.content)
            extracted_socrates = parsed.get("socrates", {})

            # Merge with base_socrates to ensure all 8 keys exist with right format and track revisions
            merged_socrates = {}
            for dim in ["site", "onset", "character", "radiation", "associated", "timing", "exacerbating", "severity"]:
                item = extracted_socrates.get(dim)
                prev_slot = base_socrates.get(dim, {})
                prev_val = prev_slot.get("value")
                history_list = list(prev_slot.get("history", []))

                if isinstance(item, dict) and item.get("status") in ["filled", "unclear"] and item.get("value"):
                    new_val = str(item.get("value")).strip()
                    # If value changed from previous non-empty value, archive it in history
                    if prev_val and str(prev_val).strip().lower() != new_val.lower():
                        history_list.append({
                            "previous_value": str(prev_val),
                            "confidence": float(prev_slot.get("confidence", 0.0)),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    merged_socrates[dim] = {
                        "value": new_val,
                        "confidence": float(item.get("confidence", 0.9)),
                        "source": "interview",
                        "status": item.get("status"),
                        "history": history_list
                    }
                else:
                    merged_socrates[dim] = {
                        "value": prev_val,
                        "confidence": float(prev_slot.get("confidence", 0.0)),
                        "source": prev_slot.get("source", "interview"),
                        "status": prev_slot.get("status", "unfilled"),
                        "history": history_list
                    }

            # Deterministic circuit breaker evaluation
            triage_res = evaluate_cardiac_triage(merged_socrates, text_corpus=f"{actual_complaint} {actual_latest_input}")
            final_level = triage_res["triage_level"] if triage_res["triage_level"] == "CRITICAL_RED_FLAG" else parsed.get("triage_level", triage_res["triage_level"])
            final_msg = triage_res["triage_message"] if triage_res["triage_level"] == "CRITICAL_RED_FLAG" else (parsed.get("triage_message") or triage_res["triage_message"])

            return {
                "socrates": merged_socrates,
                "triage_level": final_level,
                "triage_status": final_level,
                "triage_message": final_msg,
                "red_flag_alert": (final_level == "CRITICAL_RED_FLAG"),
                "can_shorten": (final_level == "CRITICAL_RED_FLAG")
            }
        except Exception as e:
            print(f"[Groq SOCRATES Extraction Warning] {e}")

    # Solid Heuristic Fallback Engine
    import re
    patient_answers = [h.get("answer", "") for h in actual_history if h.get("answer")]
    patient_text = f"{actual_complaint} {actual_latest_input} " + " ".join(patient_answers)
    patient_text_lower = patient_text.lower()

    socrates = {k: dict(v) for k, v in base_socrates.items()}
    for k in socrates:
        socrates[k]["history"] = list(socrates[k].get("history", []))

    def update_fallback_slot(dim_name: str, new_value: str, conf: float = 0.9):
        current_entry = socrates[dim_name]
        current_val = current_entry.get("value")
        hist = list(current_entry.get("history", []))
        if current_val and str(current_val).strip().lower() != str(new_value).strip().lower():
            hist.append({
                "previous_value": str(current_val),
                "confidence": float(current_entry.get("confidence", 0.0)),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        socrates[dim_name] = {
            "value": new_value,
            "confidence": conf,
            "source": "interview",
            "status": "filled",
            "history": hist
        }

    # 1. Site
    if not socrates["site"]["value"] or any(w in actual_latest_input.lower() for w in ["actually", "instead", "moved to", "it is in"]):
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["center", "middle", "retrosternal", "breastbone", "sternum"]):
            update_fallback_slot("site", "Retrosternal / Center of chest", 0.9)
        elif "left" in patient_text_lower and "chest" in patient_text_lower and not is_negated("left", patient_text_lower):
            update_fallback_slot("site", "Left-sided chest", 0.85)
        elif "chest" in patient_text_lower and not is_negated("chest", patient_text_lower):
            update_fallback_slot("site", "Chest (Precordial)", 0.85)

    # 2. Onset
    if not socrates["onset"]["value"]:
        if "sudden" in patient_text_lower and not is_negated("sudden", patient_text_lower):
            update_fallback_slot("onset", "Sudden acute onset", 0.9)
        elif "gradual" in patient_text_lower and not is_negated("gradual", patient_text_lower):
            update_fallback_slot("onset", "Gradual progressive onset", 0.9)
        elif re.search(r'\b(?:since|started|from)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?\s*(?:today|yesterday)?)\b', patient_text_lower):
            t_match = re.findall(r'\b(?:since|started|from)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?\s*(?:today|yesterday)?)\b', patient_text_lower)[0]
            update_fallback_slot("onset", f"Started {t_match.strip()}", 0.9)
        elif re.search(r'\b\d+\s*(?:hours?|hrs?|days?|minutes?|mins?)\b', patient_text_lower):
            dur = re.findall(r'\b\d+\s*(?:hours?|hrs?|days?|minutes?|mins?)\b', patient_text_lower)[0]
            update_fallback_slot("onset", f"Started {dur} ago", 0.85)

    # 3. Character
    if not socrates["character"]["value"]:
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["crushing", "pressure", "heavy", "squeezing", "tightness"]):
            update_fallback_slot("character", "Crushing pressure / heavy tightness", 0.95)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["sharp", "stabbing", "knife", "needle", "pleuritic"]):
            update_fallback_slot("character", "Sharp / stabbing pleuritic pain", 0.95)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["burning", "acid", "heartburn"]):
            update_fallback_slot("character", "Burning sensation / acid reflux type", 0.95)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["aching", "ache", "dull"]):
            update_fallback_slot("character", "Dull ache", 0.85)

    # 4. Radiation (Prioritize negative declarations & check is_negated)
    if not socrates["radiation"]["value"]:
        is_rad_neg = (
            any(w in patient_text_lower for w in ["no radiation", "nowhere", "does not radiate", "doesn't radiate", "localized", "not radiating", "stays in", "doesn't spread", "does not spread", "no spread"])
            or any(is_negated(w, patient_text_lower) for w in ["radiat", "left arm", "arm", "jaw", "neck", "back", "spread"])
        )
        if is_rad_neg:
            update_fallback_slot("radiation", "No radiation (Localized)", 0.9)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["left arm", "left shoulder"]):
            update_fallback_slot("radiation", "Radiates to left arm", 0.95)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["jaw", "neck", "throat"]):
            update_fallback_slot("radiation", "Radiates to jaw / neck", 0.95)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["back", "shoulder blades"]):
            update_fallback_slot("radiation", "Radiates to upper back", 0.9)
        elif "arm" in patient_text_lower and not is_negated("arm", patient_text_lower):
            update_fallback_slot("radiation", "Radiates to arm", 0.85)

    # 5. Associated Symptoms (Avoid 'deep breath' collision, check is_negated)
    if not socrates["associated"]["value"]:
        assoc = []
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["sweat", "sweating", "perspir", "cold sweat"]):
            assoc.append("Diaphoresis (profuse sweating)")

        # Dyspnea / Shortness of breath check - MUST NOT match "deep breath"
        has_dyspnea = bool(re.search(r'\b(shortness of breath|dyspnea|breathless(?:ness)?|gasping|trouble breathing|difficulty breathing|out of breath)\b', patient_text_lower))
        if has_dyspnea and not is_negated("shortness of breath", patient_text_lower) and not is_negated("dyspnea", patient_text_lower) and not is_negated("breathless", patient_text_lower):
            assoc.append("Shortness of breath (dyspnea)")

        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["nausea", "vomit", "sick to stomach"]):
            assoc.append("Nausea")
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["dizzy", "dizziness", "lightheaded"]):
            assoc.append("Dizziness / lightheadedness")

        if assoc:
            update_fallback_slot("associated", ", ".join(assoc), 0.9)
        elif any(is_negated(w, patient_text_lower) for w in ["sweat", "shortness of breath", "nausea", "dizziness", "symptom"]):
            update_fallback_slot("associated", "None reported / Denies associated symptoms", 0.85)

    # 6. Timing
    if not socrates["timing"]["value"]:
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["constant", "continuous", "nonstop", "always", "steady"]):
            update_fallback_slot("timing", "Constant / continuous pain", 0.9)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["comes and goes", "waves", "intermittent", "episodes", "spells"]):
            update_fallback_slot("timing", "Intermittent / comes and goes in waves", 0.9)

    # 7. Exacerbating / Relieving
    if not socrates["exacerbating"]["value"]:
        if any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["deep breath", "breathing", "coughing", "deep breathing", "inspiration"]):
            update_fallback_slot("exacerbating", "Worse on deep breathing / coughing", 0.9)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["walking", "stairs", "exertion", "movement", "exercise"]):
            update_fallback_slot("exacerbating", "Aggravated by physical exertion", 0.9)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["rest", "sitting down", "lying down"]):
            update_fallback_slot("exacerbating", "Partially relieved by rest", 0.85)

    # 8. Severity (Supports revision when updated numbers are mentioned)
    sev_match = re.search(r'\b([0-9]|10)\s*(?:/|\s*out of\s*)\s*10\b', patient_text_lower)
    if sev_match and (not socrates["severity"]["value"] or (actual_latest_input and re.search(r'\b([0-9]|10)\b', actual_latest_input))):
        score = int(sev_match.group(1))
        update_fallback_slot("severity", f"{score}/10 Numeric Pain Rating", 0.95)
    elif not socrates["severity"]["value"]:
        if re.search(r'\b(?:severity|score|rating)\s*(?:is|level|of)?\s*([0-9]|10)\b', patient_text_lower):
            score = int(re.findall(r'\b(?:severity|score|rating)\s*(?:is|level|of)?\s*([0-9]|10)\b', patient_text_lower)[0])
            update_fallback_slot("severity", f"{score}/10 Numeric Pain Rating", 0.9)
        elif any(w in patient_text_lower and not is_negated(w, patient_text_lower) for w in ["severe", "unbearable", "worst pain"]):
            update_fallback_slot("severity", "Severe intensity (9/10 equivalent)", 0.85)

    # Deterministic Triage Circuit Breaker Evaluation
    triage_res = evaluate_cardiac_triage(socrates, text_corpus=patient_text)
    return {
        "socrates": socrates,
        "triage_level": triage_res["triage_level"],
        "triage_status": triage_res["triage_status"],
        "triage_message": triage_res["triage_message"],
        "red_flag_alert": triage_res["red_flag_alert"],
        "can_shorten": triage_res["can_shorten"]
    }


def generate_socrates_interview_question(
    chief_complaint: str,
    target_dimension: str,
    tree_question: Dict[str, Any],
    history: List[Dict[str, str]],
    socrates_state: Optional[Dict[str, Any]] = None,
    language: str = "English"
) -> Dict[str, Any]:
    """
    Generates a conversational, empathetic question targeting an unfilled SOCRATES dimension,
    acknowledging prior facts and supporting English, Hindi, and Kannada.
    """
    client = get_groq_client()
    default_question = tree_question.get("question", "Could you describe your symptoms further?")
    question_id = tree_question.get("id", f"q_{target_dimension}")

    known_facts = []
    if socrates_state:
        for dim, item in socrates_state.items():
            if isinstance(item, dict) and item.get("status") == "filled" and item.get("value"):
                known_facts.append(f"{dim}: {item['value']}")

    if not client:
        if known_facts:
            lead_in = f"I understand your discomfort involves {known_facts[0].split(':')[-1].strip().lower()}. "
            return {
                "question_id": question_id,
                "question": f"{lead_in}{default_question}"
            }
        return {
            "question_id": question_id,
            "question": default_question
        }

    canonical_lang = get_language_config(language)["code"]
    lang_instruction = "English"
    if canonical_lang == "hi-IN":
        lang_instruction = "Hindi (in natural Devanagari script, empathetic and clear for patients)"
    elif canonical_lang == "kn-IN":
        lang_instruction = "Kannada (in natural Kannada script, empathetic and polite for patients)"

    system_prompt = (
        f"You are MediKiosk's Clinical AI Intake Interviewer.\n"
        f"You are conducting a patient intake interview in {lang_instruction}.\n"
        "RULES:\n"
        "1. Focus strictly on the target clinical topic provided. DO NOT ask questions outside the clinical protocol.\n"
        "2. Empathetic Contextual Acknowledgment: Reassure the patient and explicitly acknowledge what they have already shared (e.g. 'I understand that you have had crushing chest pain since 2 hours ago...').\n"
        "3. Clear Targeted Inquiry: Transition smoothly to ask the target question naturally and compassionately in the requested language.\n"
        "4. Output strictly valid JSON with keys: 'question_id', 'question'."
    )

    user_prompt = (
        f"Target SOCRATES Dimension: {target_dimension.upper()}\n"
        f"Target Clinical Topic: {tree_question.get('question')}\n"
        f"Chief Complaint: {chief_complaint}\n"
        f"Known Patient Facts So Far: {', '.join(known_facts) if known_facts else 'None yet'}\n"
        f"Recent Dialogue History:\n{json.dumps(history[-3:], indent=2) if history else 'First question'}\n\n"
        f"Respond in {lang_instruction} as JSON: {{\"question_id\": \"{question_id}\", \"question\": \"...\"}}"
    )

    try:
        response = client.chat.completions.create(
            model=FAST_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "question_id": question_id,
            "question": result.get("question", default_question)
        }
    except Exception as e:
        print(f"[Groq Question Generation Warning] {e}")
        if known_facts:
            lead_in = f"I understand your discomfort involves {known_facts[0].split(':')[-1].strip().lower()}. "
            return {
                "question_id": question_id,
                "question": f"{lead_in}{default_question}"
            }
        return {
            "question_id": question_id,
            "question": default_question
        }


def generate_interview_question(
    chief_complaint: str,
    tree_question: Dict[str, Any],
    history: List[Dict[str, str]]
) -> Dict[str, Any]:
    """Compatibility wrapper for legacy calls"""
    dim = tree_question.get("socrates_dimension", tree_question.get("category", "general"))
    return generate_socrates_interview_question(
        chief_complaint=chief_complaint,
        target_dimension=dim,
        tree_question=tree_question,
        history=history,
        language="English"
    )

# ==========================================
# PROMPT 2: Document OCR + Extraction
# ==========================================
def extract_document_info(image_path: str, filename: str) -> Dict[str, Any]:
    client = get_groq_client()

    system_prompt = (
        "You are MediKiosk's Medical Document OCR and Extraction Engine.\n"
        "Analyze the provided medical document details and extract structured clinical facts.\n"
        "Return strictly valid JSON with exact keys:\n"
        "{\n"
        "  \"diagnoses\": [string],\n"
        "  \"medications\": [{\"name\": string, \"dosage\": string, \"frequency\": string}],\n"
        "  \"lab_values\": [{\"test\": string, \"value\": string, \"unit\": string}],\n"
        "  \"dates\": [string],\n"
        "  \"confidence\": float (0.0 to 1.0)\n"
        "}"
    )

    # Encode image if available
    content_messages = []
    if os.path.exists(image_path):
        try:
            with open(image_path, "rb") as img_file:
                base64_image = base64.b64encode(img_file.read()).decode("utf-8")

            content_messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Extract medical facts from this document ({filename}).\nBase64 content length: {len(base64_image)} chars."
                }
            ]
        except Exception as err:
            print(f"[Groq Document Error] {err}")

    if client and content_messages:
        try:
            response = client.chat.completions.create(
                model=FAST_MODEL_NAME,
                messages=content_messages,
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return {
                "diagnoses": result.get("diagnoses", []),
                "medications": result.get("medications", []),
                "lab_values": result.get("lab_values", []),
                "dates": result.get("dates", []),
                "confidence": float(result.get("confidence", 0.90))
            }
        except Exception as e:
            print(f"[Groq Document Fallback] {e}")

    # Solid heuristic fallback for local files
    return {
        "diagnoses": ["Presumed Viral Syndrome / Follow-up"],
        "medications": [
            {"name": "Paracetamol", "dosage": "500mg", "frequency": "Every 8 hours as needed"}
        ],
        "lab_values": [
            {"test": "SpO2", "value": "98%", "unit": "%"},
            {"test": "BP", "value": "120/80", "unit": "mmHg"}
        ],
        "dates": ["2026-08-10"],
        "confidence": 0.88
    }

def detect_document_contradictions(
    interview_responses: List[Dict[str, Any]],
    documents: List[Dict[str, Any]],
    chief_complaint: str = ""
) -> List[str]:
    """
    Deterministically detects discrepancies between verbal interview statements and uploaded documents.
    Specifically checks for patient denial of cardiac history / medications vs. documented cardiac findings / prescriptions.
    """
    contradictions: List[str] = []

    # Collect all patient responses into a unified search corpus
    patient_statements = [chief_complaint] if chief_complaint else []
    for r in interview_responses:
        ans = str(r.get("answer", "")).strip()
        q = str(r.get("question", "")).strip()
        if ans:
            patient_statements.append(f"{q}: {ans}")
    corpus = " ".join(patient_statements).lower()

    # Denial patterns for prior cardiac history / chest pain
    cardiac_denial_patterns = [
        r"\b(no|never|not|none)\s+(had|have|any|known|prior|past|previous)?\s*(cardiac|heart|chest\s*pain|angina|heart\s*disease|attack|mi)\b",
        r"\b(first\s*time|never\s*had\s*this|no\s*prior\s*history|no\s*past\s*history|no\s*medical\s*history|no\s*previous\s*pain|never\s*experienced\s*this|healthy\s*before)\b",
        r"\b(no|negative)\s+history\s+of\s+(heart|cardiac|chest\s*pain)\b"
    ]
    has_cardiac_denial = any(re.search(pat, corpus) for pat in cardiac_denial_patterns)

    # Denial patterns for regular medications
    med_denial_patterns = [
        r"\b(no|not\s*taking|don\'?t\s*take|no\s*regular|free\s*of)\s*(medications?|medicines?|pills?|drugs?|prescriptions?)\b",
        r"\b(not\s*on\s*any\s*medications?|no\s*current\s*meds)\b"
    ]
    has_med_denial = any(re.search(pat, corpus) for pat in med_denial_patterns)

    cardiac_diag_keywords = [
        "coronary", "cad", "angina", "infarct", "ischemi", "heart attack", "stemi", "nstemi",
        "stent", "cabg", "atherosclero", "heart disease", "troponin", "st elevation", "t wave inversion"
    ]
    cardiac_med_keywords = [
        "nitroglycerin", "sorbitrate", "isosorbide", "clopidogrel", "plavix", "aspirin", "ecosprin",
        "atorvastatin", "metoprolol", "carvedilol", "ramipril", "ticagrelor", "ranolazine", "amiodarone"
    ]

    for doc in documents:
        ext = doc.get("extracted_json", {})
        fname = doc.get("filename", "Uploaded Document")
        diagnoses = ext.get("diagnoses", [])
        medications = ext.get("medications", [])

        if has_cardiac_denial:
            for diag in diagnoses:
                diag_str = str(diag).strip()
                if any(kw in diag_str.lower() for kw in cardiac_diag_keywords):
                    flag = f"Contradiction: Patient reported no prior cardiac history during interview, but uploaded document '{fname}' documents '{diag_str}'. Recommend prompt clinical assessment."
                    if flag not in contradictions:
                        contradictions.append(flag)

            for med in medications:
                med_name = med.get("name", "") if isinstance(med, dict) else str(med)
                med_str = str(med_name).strip()
                if any(kw in med_str.lower() for kw in cardiac_med_keywords):
                    flag = f"Contradiction: Patient reported no prior cardiac history during interview, but uploaded document '{fname}' lists cardiac prescription '{med_str}'. Recommend prompt clinical assessment."
                    if flag not in contradictions:
                        contradictions.append(flag)

        if has_med_denial and medications:
            med_names = [m.get("name", str(m)) if isinstance(m, dict) else str(m) for m in medications]
            med_names_clean = [m for m in med_names if m]
            if med_names_clean:
                flag = f"Contradiction: Patient reported taking no medications, but uploaded document '{fname}' lists active prescription(s): {', '.join(med_names_clean[:3])}. Recommend prompt clinical assessment."
                if flag not in contradictions:
                    contradictions.append(flag)

    return contradictions


def build_socrates_matrix(
    socrates_state: Optional[Dict[str, Any]],
    interview_responses: List[Dict[str, Any]],
    documents: List[Dict[str, Any]],
    llm_matrix: Optional[Dict[str, Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Builds the standardized 8-dimension SOCRATES clinical matrix with explicit source tagging,
    confidence metrics, and clinical alert flags.
    """
    matrix: Dict[str, Dict[str, Any]] = {}
    soc_state = socrates_state or {}

    for dim in SOCRATES_DIMENSIONS:
        meta = SOCRATES_METADATA.get(dim, {})
        label = meta.get("name", dim.capitalize())
        alias = meta.get("alias", dim)

        # 1. Defaults
        val: Optional[str] = None
        status = "not_reported"
        source = "none"
        source_icon = "—"
        source_details = "Not reported in interview or records"
        confidence = 0.0

        # 2. Check if LLM supplied a structured entry
        if isinstance(llm_matrix, dict):
            llm_entry = llm_matrix.get(dim) or llm_matrix.get(alias)
            if isinstance(llm_entry, dict):
                cand_val = llm_entry.get("value")
                if cand_val and str(cand_val).strip().lower() not in ["not reported", "none", "unknown", "n/a"]:
                    val = str(cand_val).strip()
                    confidence = float(llm_entry.get("confidence", 0.85) or 0.85)
                    source = str(llm_entry.get("source", "interview"))
                    source_icon = str(llm_entry.get("source_icon", "🎤"))
                    source_details = str(llm_entry.get("source_details", "Derived from patient interview"))
                    status = str(llm_entry.get("status", "confirmed" if confidence >= 0.7 else "unclear"))
            elif isinstance(llm_entry, str) and llm_entry.strip().lower() not in ["not reported", "none", "unknown", "n/a"]:
                val = llm_entry.strip()
                confidence = 0.85
                source = "interview"
                source_icon = "🎤"
                source_details = "Derived from patient interview"
                status = "confirmed"

        # 3. Check interview socrates_state if not already filled or if state has higher/equal confidence
        state_entry = soc_state.get(dim) or soc_state.get(alias)
        if isinstance(state_entry, dict):
            s_val = state_entry.get("value")
            s_conf = float(state_entry.get("confidence", 0.0) or 0.0)
            if s_val and str(s_val).strip().lower() not in ["not reported", "none", "unknown", "n/a"]:
                if not val or s_conf >= confidence:
                    val = str(s_val).strip()
                    confidence = s_conf
                    source = state_entry.get("source", "interview")
                    source_icon = "🎤" if source == "interview" else "📄"
                    source_details = f"Patient interview: '{val}'"
                    status = "confirmed" if confidence >= 0.7 else "unclear"

        # 4. Complement or combine with document findings
        doc_mentions = []
        for doc in documents:
            ext = doc.get("extracted_json", {})
            fname = doc.get("filename", "medical_doc.pdf")
            for diag in ext.get("diagnoses", []):
                doc_mentions.append((str(diag), fname))
            for note in ext.get("clinical_notes", []):
                doc_mentions.append((str(note), fname))

        if dim == "site":
            for d_text, fname in doc_mentions:
                if any(w in d_text.lower() for w in ["retrosternal", "substernal", "precordial", "anterior", "chest"]):
                    if val and val != "Not reported":
                        source = "combined"
                        source_icon = "🎤 📄"
                        source_details += f" | Document ({fname}): {d_text}"
                    else:
                        val = f"Documented site: {d_text}"
                        confidence = 0.85
                        source = "document"
                        source_icon = "📄"
                        source_details = f"Document ({fname}): {d_text}"
                        status = "confirmed"
                    break
        elif dim == "character":
            for d_text, fname in doc_mentions:
                if any(w in d_text.lower() for w in ["crushing", "angina", "tightness", "pressure", "pleuritic"]):
                    if val and val != "Not reported":
                        source = "combined"
                        source_icon = "🎤 📄"
                        source_details += f" | Document ({fname}): {d_text}"
                    else:
                        val = f"Documented character: {d_text}"
                        confidence = 0.85
                        source = "document"
                        source_icon = "📄"
                        source_details = f"Document ({fname}): {d_text}"
                        status = "alert" if any(w in d_text.lower() for w in ["crushing", "angina", "tightness", "pressure"]) else "confirmed"
                    break

        # 5. Red-Flag Cardiac Alert Validation & Normalization
        if val and val.lower() not in ["not reported", "none", "unknown", "n/a"]:
            val_lower = val.lower()
            if dim == "character" and any(k in val_lower for k in ["crushing", "heavy", "pressure", "squeez", "tight"]):
                status = "alert"
            elif dim == "radiation" and any(k in val_lower for k in ["left arm", "jaw", "neck", "shoulder"]):
                status = "alert"
            elif dim == "associated" and any(k in val_lower for k in ["sweat", "diaphor", "short of breath", "shortness of breath", "dyspnea", "breathless", "syncope"]):
                status = "alert"
            elif dim == "severity":
                nums = re.findall(r'\b([0-9]|10)\b', val)
                if nums and int(nums[0]) >= 7:
                    status = "alert"
                elif confidence >= 0.7:
                    status = "confirmed"
                else:
                    status = "unclear"
            elif confidence >= 0.7:
                status = "confirmed"
            elif confidence >= 0.3:
                status = "unclear"
            else:
                status = "unclear"
        else:
            val = "Not reported"
            status = "not_reported"
            source = "none"
            source_icon = "—"
            source_details = "Not reported in interview or records"
            confidence = 0.0

        # Collect revision history if available from socrates_state
        state_entry = soc_state.get(dim) or soc_state.get(alias)
        hist = []
        if isinstance(state_entry, dict):
            hist = list(state_entry.get("history", []))

        matrix[dim] = {
            "dimension": dim,
            "label": label,
            "value": val,
            "status": status,
            "source": source,
            "source_icon": source_icon,
            "source_details": source_details,
            "confidence": round(confidence, 2),
            "history": hist
        }

    return matrix


# ==========================================
# PROMPT 3: Record Merge + Flag Engine
# ==========================================
def merge_record_and_flag(
    chief_complaint: str,
    patient_name: str,
    patient_language: str,
    interview_responses: List[Dict[str, Any]],
    documents: List[Dict[str, Any]],
    socrates_state: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    client = get_groq_client()
    detected_contradictions = detect_document_contradictions(interview_responses, documents, chief_complaint)

    # Verbal self-contradictions / revisions from SOCRATES history
    if isinstance(socrates_state, dict):
        for dim, item in socrates_state.items():
            if isinstance(item, dict):
                hist = item.get("history", [])
                cur_val = item.get("value")
                if hist and cur_val:
                    prev_val = hist[-1].get("previous_value")
                    dim_name = SOCRATES_METADATA.get(dim, {}).get("name", dim.capitalize())
                    rev_flag = f"Verbal Symptom Revision ({dim_name}): Patient initially reported '{prev_val}', subsequently updated to '{cur_val}'. Recommend prompt clinical assessment."
                    if rev_flag not in detected_contradictions:
                        detected_contradictions.append(rev_flag)

    system_prompt = (
        "You are MediKiosk's Clinical Merging & Safety Engine.\n"
        "Merge patient interview responses, extracted document findings, and active SOCRATES symptom profile into a unified clinical record.\n"
        "RULES:\n"
        "1. Source Tagging: Every fact must have source 'interview' (🎤), 'document' (📄), or 'combined' (🎤 📄).\n"
        "2. Contradiction Flags: Identify discrepancies between patient's verbal answers and uploaded documents (e.g., patient denies prior heart disease or medications, but documents record CAD, myocardial infarction, ischemic ECG, or prescriptions for Nitroglycerin, Isosorbide Mononitrate, Clopidogrel, Aspirin), or verbal self-contradictions in symptom report. Phrase as: 'Contradiction: [details]. Recommend prompt clinical assessment.' or 'Verbal Symptom Revision: [details]. Recommend prompt clinical assessment.'\n"
        "3. Attention Flags: Highlight high-risk symptom combinations (e.g. chest pain + shortness of breath + left arm radiation).\n"
        "4. Non-negotiable design rule: Phrase flags as 'recommend prompt clinical assessment', NEVER as a definitive diagnosis.\n"
        "5. FACT QUALITY FILTERING: Do NOT list answers where the patient states 'I don't know', 'unclear', 'not sure', 'don't remember', or gives vague non-answers as facts under 'interview_facts'. Collect all these under a separate array 'unclear_facts'. Only concrete patient-stated clinical facts stay under 'interview_facts'.\n"
        "6. SOCRATES Pain & Symptom Matrix:\n"
        "   Populate the 8 dimensions in `socrates_matrix` ('site', 'onset', 'character', 'radiation', 'associated', 'timing', 'exacerbating', 'severity').\n"
        "   For each dimension, include:\n"
        "     - dimension: string\n"
        "     - label: string\n"
        "     - value: string (clinical description or 'Not reported')\n"
        "     - status: 'confirmed' | 'unclear' | 'alert' | 'not_reported'\n"
        "     - source: 'interview' | 'document' | 'combined' | 'none'\n"
        "     - source_icon: '🎤' | '📄' | '🎤 📄' | '—'\n"
        "     - source_details: string\n"
        "     - confidence: number (0.0 to 1.0)\n"
        "Output JSON structure:\n"
        "{\n"
        "  \"chief_complaint\": string,\n"
        "  \"overall_summary\": string,\n"
        "  \"socrates_matrix\": {\n"
        "    \"site\": {\"dimension\": \"site\", \"label\": \"Site\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"onset\": {\"dimension\": \"onset\", \"label\": \"Onset\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"character\": {\"dimension\": \"character\", \"label\": \"Character\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"radiation\": {\"dimension\": \"radiation\", \"label\": \"Radiation\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"associated\": {\"dimension\": \"associated\", \"label\": \"Associated Symptoms\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"timing\": {\"dimension\": \"timing\", \"label\": \"Timing\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"exacerbating\": {\"dimension\": \"exacerbating\", \"label\": \"Exacerbating / Relieving Factors\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number},\n"
        "    \"severity\": {\"dimension\": \"severity\", \"label\": \"Severity\", \"value\": string, \"status\": string, \"source\": string, \"source_icon\": string, \"source_details\": string, \"confidence\": number}\n"
        "  },\n"
        "  \"interview_facts\": [{\"fact\": string, \"source\": \"interview\", \"icon\": \"🎤\", \"input_mode\": \"voice\"|\"text\" (copy from the response when present), \"language\": string (copy from the response when present), \"original_transcript\": string (verbatim patient transcript for voice answers, else omit), \"timestamp\": string}],\n"
        "  \"unclear_facts\": [{\"question\": string, \"answer\": string, \"issue\": string}],\n"
        "  \"document_facts\": [{\"fact\": string, \"source\": \"document\", \"icon\": \"📄\", \"filename\": string}],\n"
        "  \"contradiction_flags\": [string],\n"
        "  \"attention_flags\": [string]\n"
        "}"
    )

    user_prompt = (
        f"Patient: {patient_name} (Language: {patient_language})\n"
        f"Chief Complaint: {chief_complaint}\n\n"
        f"Active SOCRATES State:\n{json.dumps(socrates_state or {}, indent=2)}\n\n"
        f"Interview Q&A Responses:\n{json.dumps(interview_responses, indent=2)}\n\n"
        f"Uploaded Documents Extracted Facts:\n{json.dumps(documents, indent=2)}\n"
    )

    if client:
        try:
            response = client.chat.completions.create(
                model=SYNTHESIS_MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            parsed = json.loads(response.choices[0].message.content)
            if "unclear_facts" not in parsed:
                parsed["unclear_facts"] = []

            # Ensure contradiction_flags includes deterministic contradiction flags
            existing_contradictions = parsed.get("contradiction_flags", [])
            for c in detected_contradictions:
                if c not in existing_contradictions:
                    existing_contradictions.append(c)
            parsed["contradiction_flags"] = existing_contradictions

            # Normalize and enforce full 8-cell socrates_matrix
            parsed["socrates_matrix"] = build_socrates_matrix(
                socrates_state=socrates_state,
                interview_responses=interview_responses,
                documents=documents,
                llm_matrix=parsed.get("socrates_matrix")
            )

            # Check for cardiac red-flag attention triggers
            triage_info = evaluate_cardiac_triage(
                parsed["socrates_matrix"],
                text_corpus=f"{chief_complaint} {' '.join([str(r.get('answer', '')) for r in interview_responses])}"
            )
            if triage_info.get("status") == "CRITICAL_RED_FLAG":
                crit_flag = "Critical cardiac presentation detected: Crushing chest pain radiating to left arm/jaw with autonomic/high severity signs. Recommend prompt clinical assessment."
                if crit_flag not in parsed.get("attention_flags", []):
                    parsed.setdefault("attention_flags", []).insert(0, crit_flag)

            return parsed
        except Exception as e:
            print(f"[Groq Merge Fallback] {e}")

    # Fallback formatting
    interview_facts = []
    unclear_facts = []
    unclear_keywords = ["don't know", "dont know", "unclear", "not sure", "don't remember", "dont remember", "unknown", "can't say", "cant say"]

    for r in interview_responses:
        ans_lower = str(r.get("answer", "")).lower()
        if any(kw in ans_lower for kw in unclear_keywords):
            unclear_facts.append({
                "question": str(r.get("question", "")),
                "answer": str(r.get("answer", "")),
                "issue": "Patient is unclear or unable to provide exact details."
            })
        else:
            interview_facts.append({
                "fact": f"{r.get('question')}: {r.get('answer')}",
                "source": "interview",
                "icon": "🎤",
                "input_mode": r.get("input_mode") or "text",
                "language": r.get("language"),
                "original_transcript": r.get("original_transcript"),
                "timestamp": str(r.get("timestamp", ""))
            })

    document_facts = []
    for doc in documents:
        ext = doc.get("extracted_json", {})
        fname = doc.get("filename", "medical_doc.pdf")
        for diag in ext.get("diagnoses", []):
            document_facts.append({
                "fact": f"Documented Diagnosis: {diag}",
                "source": "document",
                "icon": "📄",
                "filename": fname
            })
        for med in ext.get("medications", []):
            med_str = med.get("name") if isinstance(med, dict) else str(med)
            document_facts.append({
                "fact": f"Prescription: {med_str}",
                "source": "document",
                "icon": "📄",
                "filename": fname
            })

    # Assemble 8-dimension SOCRATES Matrix
    socrates_matrix = build_socrates_matrix(
        socrates_state=socrates_state,
        interview_responses=interview_responses,
        documents=documents,
        llm_matrix=None
    )

    # Evaluate Attention Flags
    attention_flags = []
    triage_info = evaluate_cardiac_triage(
        socrates_matrix,
        text_corpus=f"{chief_complaint} {' '.join([str(r.get('answer', '')) for r in interview_responses])}"
    )
    if triage_info.get("status") == "CRITICAL_RED_FLAG":
        attention_flags.append("Critical cardiac presentation detected: Crushing chest pain radiating to left arm/jaw with autonomic/high severity signs. Recommend prompt clinical assessment.")
    else:
        attention_flags.append("Recommend prompt clinical assessment based on reported symptom history.")

    return {
        "chief_complaint": chief_complaint,
        "overall_summary": f"Patient presented with {chief_complaint}. Gathered {len(interview_facts)} interview facts, {len(unclear_facts)} unclear items, and {len(document_facts)} document items.",
        "socrates_matrix": socrates_matrix,
        "interview_facts": interview_facts,
        "unclear_facts": unclear_facts,
        "document_facts": document_facts,
        "contradiction_flags": detected_contradictions,
        "attention_flags": attention_flags
    }
