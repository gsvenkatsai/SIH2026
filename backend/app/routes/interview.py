from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.languages import normalize_language
from app.models import Patient, Visit, InterviewResponse
from app.schemas import (
    InterviewStartRequest,
    InterviewStartResponse,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewVoiceAnswerResponse
)
from app.trees import (
    DECISION_TREES,
    get_tree_key,
    get_empty_socrates_state,
    select_next_question,
    evaluate_cardiac_triage
)
from app.groq_service import (
    generate_socrates_interview_question,
    extract_socrates_slots,
    transcribe_audio
)

router = APIRouter(prefix="/interview", tags=["Interview"])

@router.post("/start", response_model=InterviewStartResponse)
def start_interview(payload: InterviewStartRequest, db: Session = Depends(get_db)):
    # Create Patient record (language normalized to canonical code, e.g. "kn-IN")
    patient = Patient(
        name=payload.patient_name or "Anonymous Patient",
        language=normalize_language(payload.language)
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Initial SOCRATES slot extraction from patient's chief complaint
    socrates_res = extract_socrates_slots(
        chief_complaint=payload.chief_complaint,
        history=[],
        current_state=get_empty_socrates_state()
    )
    socrates_state = socrates_res.get("socrates", get_empty_socrates_state())
    
    # Deterministic Emergency Cardiac Red-Flag Circuit Breaker
    triage_info = evaluate_cardiac_triage(socrates_state, text_corpus=payload.chief_complaint)
    triage_level = triage_info["triage_level"]
    triage_status = triage_info["triage_status"]
    triage_message = triage_info["triage_message"]
    red_flag_alert = triage_info["red_flag_alert"]
    can_shorten = triage_info["can_shorten"]

    # Create Visit record with initial SOCRATES profile & triage status
    visit = Visit(
        patient_id=patient.id,
        chief_complaint=payload.chief_complaint,
        status="draft",
        socrates_state=socrates_state,
        triage_level=triage_level,
        triage_message=triage_message
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # Determine decision tree
    tree_key = get_tree_key(payload.chief_complaint)
    questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    # Dynamic Priority Slot Resolver: Pick highest priority unfilled slot
    next_tree_q = select_next_question(
        tree_key=tree_key,
        tree_questions=questions,
        socrates_state=socrates_state,
        answered_ids=[]
    )

    if not next_tree_q:
        # Patient already answered all core slots in their chief complaint!
        return InterviewStartResponse(
            visit_id=visit.id,
            question="Thank you. We have recorded your symptoms.",
            question_id="complete",
            section_completed=True,
            socrates_state=socrates_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )

    target_dim = next_tree_q.get("socrates_dimension", next_tree_q.get("category", "general"))
    groq_res = generate_socrates_interview_question(
        chief_complaint=payload.chief_complaint,
        target_dimension=target_dim,
        tree_question=next_tree_q,
        history=[],
        socrates_state=socrates_state,
        language=patient.language  # canonical code
    )

    return InterviewStartResponse(
        visit_id=visit.id,
        question=groq_res["question"],
        question_id=groq_res["question_id"],
        section_completed=False,
        socrates_state=socrates_state,
        triage_level=triage_level,
        triage_status=triage_status,
        triage_message=triage_message,
        red_flag_alert=red_flag_alert,
        can_shorten=can_shorten
    )

@router.post("/answer", response_model=InterviewAnswerResponse)
def answer_interview(payload: InterviewAnswerRequest, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == payload.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Mid-interview language switch: persist the new canonical language WITHOUT
    # touching collected clinical state (socrates_state, responses, triage).
    if payload.language and normalize_language(payload.language) != (visit.patient.language if visit.patient else None):
        if visit.patient:
            visit.patient.language = normalize_language(payload.language)
            db.commit()

    tree_key = get_tree_key(visit.chief_complaint)
    tree_questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    base_id = payload.question_id.replace("_clarify", "")
    current_q = next((q for q in tree_questions if q["id"] in [payload.question_id, base_id]), None)
    if current_q:
        question_text = current_q.get("fallback_question", current_q["question"]) if payload.question_id.endswith("_clarify") else current_q["question"]
    else:
        question_text = payload.question_id

    # Store response with input-modality and voice evidence metadata
    is_voice = (payload.input_mode or "text") == "voice"
    response_entry = InterviewResponse(
        visit_id=visit.id,
        question_id=payload.question_id,
        question=question_text,
        answer=payload.answer,
        input_mode=payload.input_mode or "text",
        language=normalize_language(payload.language) if payload.language else None,
        original_transcript=(payload.original_transcript or payload.answer) if is_voice else None,
        transcription_confidence=payload.transcription_confidence if is_voice else None
    )
    db.add(response_entry)
    db.commit()

    # Build dialogue history
    past_responses = db.query(InterviewResponse).filter(InterviewResponse.visit_id == visit.id).all()
    history = [{"question": r.question, "answer": r.answer} for r in past_responses]
    answered_ids = [r.question_id for r in past_responses]

    # Dynamic Slot Extraction: Parse patient input into SOCRATES slots
    current_state = visit.socrates_state if visit.socrates_state else get_empty_socrates_state()
    socrates_res = extract_socrates_slots(
        chief_complaint=visit.chief_complaint,
        history=history,
        current_state=current_state,
        latest_input=payload.answer
    )
    updated_state = socrates_res.get("socrates", current_state)
    
    # Deterministic Emergency Cardiac Red-Flag Circuit Breaker
    full_narrative = f"{visit.chief_complaint} {' '.join([r.answer for r in past_responses])}"
    triage_info = evaluate_cardiac_triage(updated_state, text_corpus=full_narrative)
    triage_level = triage_info["triage_level"]
    triage_status = triage_info["triage_status"]
    triage_message = triage_info["triage_message"]
    red_flag_alert = triage_info["red_flag_alert"]
    can_shorten = triage_info["can_shorten"]

    # Persist updated state on Visit
    visit.socrates_state = updated_state
    visit.triage_level = triage_level
    visit.triage_message = triage_message
    db.commit()

    # Emergency Circuit Breaker: If red flag alert triggered and patient/kiosk requests expedited review, shorten intake immediately
    if red_flag_alert and (payload.shorten_intake or any(w in payload.answer.lower() for w in ["shorten", "expedite", "emergency", "doctor now", "urgent"])):
        return InterviewAnswerResponse(
            visit_id=visit.id,
            status="section_complete",
            is_complete=True,
            next_question=None,
            next_question_id=None,
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )

    # Priority Slot Resolver: Select next most diagnostically critical unfilled slot
    next_tree_q = select_next_question(
        tree_key=tree_key,
        tree_questions=tree_questions,
        socrates_state=updated_state,
        answered_ids=answered_ids
    )

    patient_language = visit.patient.language if visit.patient else "en-IN"

    if next_tree_q:
        target_dim = next_tree_q.get("socrates_dimension", next_tree_q.get("category", "general"))
        groq_res = generate_socrates_interview_question(
            chief_complaint=visit.chief_complaint,
            target_dimension=target_dim,
            tree_question=next_tree_q,
            history=history,
            socrates_state=updated_state,
            language=patient_language
        )
        return InterviewAnswerResponse(
            visit_id=visit.id,
            status="in_progress",
            next_question=groq_res["question"],
            next_question_id=groq_res["question_id"],
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )
    else:
        return InterviewAnswerResponse(
            visit_id=visit.id,
            status="section_complete",
            is_complete=True,
            next_question=None,
            next_question_id=None,
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )

@router.post("/answer-voice", response_model=InterviewVoiceAnswerResponse)
async def answer_interview_voice(
    visit_id: int = Form(...),
    question_id: str = Form(...),
    language: str = Form("en"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Read audio content
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file provided")

    # Transcribe audio using Groq Whisper-large-v3 (kept for legacy clients; the
    # recommended flow is POST /voice/transcribe + POST /interview/answer)
    try:
        asr = transcribe_audio(audio_bytes, file.filename or "voice_recording.wav", language=language)
        transcript = asr["transcript"]
    except Exception:
        # Legacy behavior preserved: this combined endpoint has always returned the
        # transcript in the response body; surface a patient-safe failure marker.
        asr = None
        transcript = ""

    tree_key = get_tree_key(visit.chief_complaint)
    tree_questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    base_id = question_id.replace("_clarify", "")
    current_q = next((q for q in tree_questions if q["id"] in [question_id, base_id]), None)
    if current_q:
        question_text = current_q.get("fallback_question", current_q["question"]) if question_id.endswith("_clarify") else current_q["question"]
    else:
        question_text = question_id

    # Store response with voice evidence metadata
    response_entry = InterviewResponse(
        visit_id=visit.id,
        question_id=question_id,
        question=question_text,
        answer=transcript or "(No speech detected)",
        input_mode="voice",
        language=normalize_language(language),
        original_transcript=transcript or None,
        transcription_confidence=(asr.get("confidence") if asr else None)
    )
    db.add(response_entry)
    db.commit()

    # Build dialogue history
    past_responses = db.query(InterviewResponse).filter(InterviewResponse.visit_id == visit.id).all()
    history = [{"question": r.question, "answer": r.answer} for r in past_responses]
    answered_ids = [r.question_id for r in past_responses]

    # Dynamic Slot Extraction: Parse transcript into SOCRATES slots
    current_state = visit.socrates_state if visit.socrates_state else get_empty_socrates_state()
    socrates_res = extract_socrates_slots(
        chief_complaint=visit.chief_complaint,
        history=history,
        current_state=current_state,
        latest_input=transcript
    )
    updated_state = socrates_res.get("socrates", current_state)
    
    # Deterministic Emergency Cardiac Red-Flag Circuit Breaker
    full_narrative = f"{visit.chief_complaint} {' '.join([r.answer for r in past_responses])}"
    triage_info = evaluate_cardiac_triage(updated_state, text_corpus=full_narrative)
    triage_level = triage_info["triage_level"]
    triage_status = triage_info["triage_status"]
    triage_message = triage_info["triage_message"]
    red_flag_alert = triage_info["red_flag_alert"]
    can_shorten = triage_info["can_shorten"]

    # Persist updated state on Visit
    visit.socrates_state = updated_state
    visit.triage_level = triage_level
    visit.triage_message = triage_message
    db.commit()

    # Emergency Circuit Breaker: Check for verbal shorten requests when red flag is active
    if red_flag_alert and any(w in transcript.lower() for w in ["shorten", "expedite", "emergency", "doctor now", "urgent", "call doctor"]):
        return InterviewVoiceAnswerResponse(
            visit_id=visit.id,
            transcript=transcript,
            status="section_complete",
            next_question=None,
            next_question_id=None,
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )

    # Priority Slot Resolver: Select next unfilled question
    next_tree_q = select_next_question(
        tree_key=tree_key,
        tree_questions=tree_questions,
        socrates_state=updated_state,
        answered_ids=answered_ids
    )

    patient_language = visit.patient.language if visit.patient else "en-IN"

    if next_tree_q:
        target_dim = next_tree_q.get("socrates_dimension", next_tree_q.get("category", "general"))
        groq_res = generate_socrates_interview_question(
            chief_complaint=visit.chief_complaint,
            target_dimension=target_dim,
            tree_question=next_tree_q,
            history=history,
            socrates_state=updated_state,
            language=patient_language
        )
        return InterviewVoiceAnswerResponse(
            visit_id=visit.id,
            transcript=transcript,
            status="in_progress",
            next_question=groq_res["question"],
            next_question_id=groq_res["question_id"],
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )
    else:
        return InterviewVoiceAnswerResponse(
            visit_id=visit.id,
            transcript=transcript,
            status="section_complete",
            next_question=None,
            next_question_id=None,
            socrates_state=updated_state,
            triage_level=triage_level,
            triage_status=triage_status,
            triage_message=triage_message,
            red_flag_alert=red_flag_alert,
            can_shorten=can_shorten
        )
