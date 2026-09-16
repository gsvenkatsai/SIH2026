from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Visit, InterviewResponse, Document, FinalRecord
from app.schemas import RecordFinalizeRequest, RecordFinalizeResponse
from app.groq_service import merge_record_and_flag

router = APIRouter(prefix="/record", tags=["Record"])

@router.post("/finalize", response_model=RecordFinalizeResponse)
def finalize_record(payload: RecordFinalizeRequest, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == payload.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    responses = db.query(InterviewResponse).filter(InterviewResponse.visit_id == visit.id).all()
    documents = db.query(Document).filter(Document.visit_id == visit.id).all()

    interview_data = [
        {
            "question_id": r.question_id,
            "question": r.question,
            "answer": r.answer,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None
        }
        for r in responses
    ]

    document_data = [
        {
            "filename": d.filename,
            "extracted_json": d.extracted_json
        }
        for d in documents
    ]

    patient_name = visit.patient.name if visit.patient else "Anonymous Patient"
    patient_lang = visit.patient.language if visit.patient else "English"

    # Execute Groq synthesis prompt
    structured_record = merge_record_and_flag(
        chief_complaint=visit.chief_complaint,
        patient_name=patient_name,
        patient_language=patient_lang,
        interview_responses=interview_data,
        documents=document_data,
        socrates_state=visit.socrates_state or {}
    )

    # Save to FinalRecord
    existing_record = db.query(FinalRecord).filter(FinalRecord.visit_id == visit.id).first()
    if existing_record:
        existing_record.structured_json = structured_record
    else:
        new_record = FinalRecord(
            visit_id=visit.id,
            structured_json=structured_record,
            approved_by_doctor=False
        )
        db.add(new_record)

    visit.status = "reviewed"
    db.commit()

    return RecordFinalizeResponse(
        visit_id=visit.id,
        status="reviewed",
        structured_record=structured_record
    )
