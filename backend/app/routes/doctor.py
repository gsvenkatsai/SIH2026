from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Visit, FinalRecord, Document, Patient
from app.schemas import DoctorQueueItem, DoctorApproveRequest, DoctorApproveResponse

router = APIRouter(prefix="/doctor", tags=["Doctor"])

@router.get("/queue", response_model=List[DoctorQueueItem])
def get_doctor_queue(db: Session = Depends(get_db)):
    visits = db.query(Visit).order_by(Visit.created_at.desc()).all()
    queue = []
    for v in visits:
        doc_count = db.query(Document).filter(Document.visit_id == v.id).count()
        patient_name = v.patient.name if v.patient else "Anonymous Patient"
        queue.append(DoctorQueueItem(
            visit_id=v.id,
            patient_name=patient_name,
            chief_complaint=v.chief_complaint,
            status=v.status,
            created_at=v.created_at,
            document_count=doc_count
        ))
    return queue

@router.get("/patient/{visit_id}")
def get_patient_record(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    record = db.query(FinalRecord).filter(FinalRecord.visit_id == visit_id).first()
    
    return {
        "visit_id": visit.id,
        "chief_complaint": visit.chief_complaint,
        "status": visit.status,
        "patient": {
            "id": visit.patient.id if visit.patient else None,
            "name": visit.patient.name if visit.patient else "Anonymous",
            "language": visit.patient.language if visit.patient else "English"
        },
        "created_at": visit.created_at,
        "structured_record": record.structured_json if record else None,
        "approved_by_doctor": record.approved_by_doctor if record else False,
        "doctor_notes": record.doctor_notes if record else None
    }

@router.post("/approve", response_model=DoctorApproveResponse)
def approve_patient_record(payload: DoctorApproveRequest, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.id == payload.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    record = db.query(FinalRecord).filter(FinalRecord.visit_id == payload.visit_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Final record not found for this visit. Finalize record first.")

    # Apply doctor edits if provided
    if payload.edits:
        record.structured_json = payload.edits
    
    if payload.notes:
        record.doctor_notes = payload.notes

    record.approved_by_doctor = True
    visit.status = "approved"
    db.commit()

    return DoctorApproveResponse(
        visit_id=visit.id,
        status="approved",
        message="Patient record successfully verified and approved by physician."
    )
