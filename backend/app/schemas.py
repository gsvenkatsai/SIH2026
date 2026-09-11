from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- Interview Schemas ---
class InterviewStartRequest(BaseModel):
    chief_complaint: str = Field(..., description="Patient's primary complaint")
    patient_name: Optional[str] = "Anonymous Patient"
    language: Optional[str] = "English"

class InterviewStartResponse(BaseModel):
    visit_id: int
    question: str
    question_id: str
    section_completed: bool = False

class InterviewAnswerRequest(BaseModel):
    visit_id: int
    question_id: str
    answer: str

class InterviewAnswerResponse(BaseModel):
    visit_id: int
    status: str  # "in_progress" or "section_complete"
    next_question: Optional[str] = None
    next_question_id: Optional[str] = None

class InterviewVoiceAnswerResponse(BaseModel):
    visit_id: int
    transcript: str
    status: str
    next_question: Optional[str] = None
    next_question_id: Optional[str] = None

# --- Document Extraction Schemas ---
class DocumentExtractResponse(BaseModel):
    doc_id: int
    visit_id: int
    filename: str
    extracted_json: Dict[str, Any]
    confidence: float

# --- Finalize Record Schemas ---
class RecordFinalizeRequest(BaseModel):
    visit_id: int

class RecordFinalizeResponse(BaseModel):
    visit_id: int
    status: str
    structured_record: Dict[str, Any]

# --- Doctor Workflow Schemas ---
class DoctorQueueItem(BaseModel):
    visit_id: int
    patient_name: str
    chief_complaint: str
    status: str
    created_at: datetime
    document_count: int

class DoctorApproveRequest(BaseModel):
    visit_id: int
    edits: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class DoctorApproveResponse(BaseModel):
    visit_id: int
    status: str
    message: str
