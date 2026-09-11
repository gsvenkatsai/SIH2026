import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Visit, Document
from app.schemas import DocumentExtractResponse
from app.groq_service import extract_document_info

router = APIRouter(prefix="/document", tags=["Document"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/extract", response_model=DocumentExtractResponse)
async def extract_document(
    visit_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    file_path = os.path.join(UPLOAD_DIR, f"visit_{visit_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Perform extraction via Groq Vision / LLM service
    extracted = extract_document_info(file_path, file.filename)
    confidence = extracted.get("confidence", 0.90)

    doc_entry = Document(
        visit_id=visit.id,
        image_path=file_path,
        filename=file.filename,
        extracted_json=extracted,
        confidence=confidence
    )
    db.add(doc_entry)
    db.commit()
    db.refresh(doc_entry)

    return DocumentExtractResponse(
        doc_id=doc_entry.id,
        visit_id=visit.id,
        filename=file.filename,
        extracted_json=extracted,
        confidence=confidence
    )
