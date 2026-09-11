from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Patient, Visit, InterviewResponse
from app.schemas import (
    InterviewStartRequest,
    InterviewStartResponse,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewVoiceAnswerResponse
)
from app.trees import DECISION_TREES, get_tree_key
from app.groq_service import generate_interview_question, transcribe_audio

router = APIRouter(prefix="/interview", tags=["Interview"])

@router.post("/start", response_model=InterviewStartResponse)
def start_interview(payload: InterviewStartRequest, db: Session = Depends(get_db)):
    # Create Patient record
    patient = Patient(
        name=payload.patient_name or "Anonymous Patient",
        language=payload.language or "English"
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Create Visit record
    visit = Visit(
        patient_id=patient.id,
        chief_complaint=payload.chief_complaint,
        status="draft"
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # Determine decision tree
    tree_key = get_tree_key(payload.chief_complaint)
    questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    first_q_tree = questions[0]
    groq_res = generate_interview_question(payload.chief_complaint, first_q_tree, history=[])

    return InterviewStartResponse(
        visit_id=visit.id,
        question=groq_res["question"],
        question_id=groq_res["question_id"],
        section_completed=False
    )

@router.post("/answer", response_model=InterviewAnswerResponse)
def answer_interview(payload: InterviewAnswerRequest, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == payload.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    tree_key = get_tree_key(visit.chief_complaint)
    tree_questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    current_q = next((q for q in tree_questions if q["id"] == payload.question_id), None)
    question_text = current_q["question"] if current_q else payload.question_id

    # Store response
    response_entry = InterviewResponse(
        visit_id=visit.id,
        question_id=payload.question_id,
        question=question_text,
        answer=payload.answer
    )
    db.add(response_entry)
    db.commit()

    # Build history for Groq
    past_responses = db.query(InterviewResponse).filter(InterviewResponse.visit_id == visit.id).all()
    history = [{"question": r.question, "answer": r.answer} for r in past_responses]
    answered_ids = [r.question_id for r in past_responses]

    # Find next question from decision tree
    next_tree_q = None
    for q in tree_questions:
        if q["id"] not in answered_ids:
            next_tree_q = q
            break

    if next_tree_q:
        groq_res = generate_interview_question(visit.chief_complaint, next_tree_q, history=history)
        return InterviewAnswerResponse(
            visit_id=visit.id,
            status="in_progress",
            next_question=groq_res["question"],
            next_question_id=groq_res["question_id"]
        )
    else:
        return InterviewAnswerResponse(
            visit_id=visit.id,
            status="section_complete",
            next_question=None,
            next_question_id=None
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

    # Transcribe audio using Groq Whisper-large-v3
    transcript = transcribe_audio(audio_bytes, file.filename or "voice_recording.wav", language=language)

    tree_key = get_tree_key(visit.chief_complaint)
    tree_questions = DECISION_TREES.get(tree_key, DECISION_TREES["default"])

    current_q = next((q for q in tree_questions if q["id"] == question_id), None)
    question_text = current_q["question"] if current_q else question_id

    # Store response same as text answer
    response_entry = InterviewResponse(
        visit_id=visit.id,
        question_id=question_id,
        question=question_text,
        answer=transcript or "(No speech detected)"
    )
    db.add(response_entry)
    db.commit()

    # Build history for Groq question generator
    past_responses = db.query(InterviewResponse).filter(InterviewResponse.visit_id == visit.id).all()
    history = [{"question": r.question, "answer": r.answer} for r in past_responses]
    answered_ids = [r.question_id for r in past_responses]

    next_tree_q = None
    for q in tree_questions:
        if q["id"] not in answered_ids:
            next_tree_q = q
            break

    if next_tree_q:
        groq_res = generate_interview_question(visit.chief_complaint, next_tree_q, history=history)
        return InterviewVoiceAnswerResponse(
            visit_id=visit.id,
            transcript=transcript,
            status="in_progress",
            next_question=groq_res["question"],
            next_question_id=groq_res["question_id"]
        )
    else:
        return InterviewVoiceAnswerResponse(
            visit_id=visit.id,
            transcript=transcript,
            status="section_complete",
            next_question=None,
            next_question_id=None
        )
