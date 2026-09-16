from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- SOCRATES Protocol Schemas ---
class SocratesDimensionValue(BaseModel):
    value: Optional[str] = Field(None, description="Extracted clinical entity or summary value for this dimension")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    source: str = Field("interview", description="Information source: interview, document, or inferred")
    status: str = Field("unfilled", description="Slot filling status: filled, unclear, or unfilled")
    history: List[Dict[str, Any]] = Field(default_factory=list, description="Audit trail of prior values and symptom revisions")

class SocratesProfile(BaseModel):
    site: Optional[SocratesDimensionValue] = Field(
        None, description="Anatomical location (retrosternal, lateral, epigastric)"
    )
    onset: Optional[SocratesDimensionValue] = Field(
        None, description="Sudden vs. gradual, trigger activity"
    )
    character: Optional[SocratesDimensionValue] = Field(
        None, description="Crushing, pressure, sharp, burning, aching"
    )
    radiation: Optional[SocratesDimensionValue] = Field(
        None, description="Left arm, neck, jaw, epigastrium, back"
    )
    associated: Optional[SocratesDimensionValue] = Field(
        None, description="Diaphoresis, dyspnea, nausea, palpitations, presyncope"
    )
    timing: Optional[SocratesDimensionValue] = Field(
        None, description="Constant vs. episodic, duration of episodes"
    )
    exacerbating: Optional[SocratesDimensionValue] = Field(
        None, description="Exertion, respiration, rest, antacids, posture"
    )
    exacerbating_relieving: Optional[SocratesDimensionValue] = Field(
        None, description="Alias for exacerbating / relieving factors"
    )
    severity: Optional[SocratesDimensionValue] = Field(
        None, description="0–10 numeric rating scale (NRS)"
    )

    @model_validator(mode="before")
    @classmethod
    def sync_exacerbating_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "exacerbating_relieving" in data and "exacerbating" not in data:
                data["exacerbating"] = data["exacerbating_relieving"]
            elif "exacerbating" in data and "exacerbating_relieving" not in data:
                data["exacerbating_relieving"] = data["exacerbating"]
        return data

    def to_dict(self) -> Dict[str, Any]:
        """Exports the 8 canonical dimensions as dictionaries."""
        exac = self.exacerbating or self.exacerbating_relieving
        return {
            "site": self.site.model_dump() if self.site else None,
            "onset": self.onset.model_dump() if self.onset else None,
            "character": self.character.model_dump() if self.character else None,
            "radiation": self.radiation.model_dump() if self.radiation else None,
            "associated": self.associated.model_dump() if self.associated else None,
            "timing": self.timing.model_dump() if self.timing else None,
            "exacerbating": exac.model_dump() if exac else None,
            "severity": self.severity.model_dump() if self.severity else None,
        }

    def get_unfilled_dimensions(self) -> List[str]:
        """Returns list of dimension names that are unfilled or have low confidence."""
        core_dims = ["site", "onset", "character", "radiation", "associated", "timing", "exacerbating", "severity"]
        unfilled = []
        d = self.to_dict()
        for dim in core_dims:
            val = d.get(dim)
            if not val or val.get("status") != "filled" or not val.get("value"):
                unfilled.append(dim)
        return unfilled

    def get_filled_dimensions(self) -> List[str]:
        """Returns list of successfully filled dimensions."""
        core_dims = ["site", "onset", "character", "radiation", "associated", "timing", "exacerbating", "severity"]
        filled = []
        d = self.to_dict()
        for dim in core_dims:
            val = d.get(dim)
            if val and val.get("status") == "filled" and val.get("value"):
                filled.append(dim)
        return filled

# --- Decision Tree Models ---
class DecisionTreeQuestion(BaseModel):
    id: str = Field(..., description="Unique question identifier (e.g. cp_site, cp_onset)")
    question: str = Field(..., description="Standard clinical interview question")
    fallback_question: Optional[str] = Field(None, description="Simplified fallback clarification question")
    category: str = Field(..., description="Clinical category")
    socrates_dimension: Optional[str] = Field(None, description="Mapped SOCRATES dimension")
    priority: Optional[int] = Field(None, description="Clinical questioning priority order (1-8)")


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
    socrates_state: Optional[Dict[str, Any]] = None
    triage_level: Optional[str] = "NORMAL"  # "NORMAL", "ALERT", "CRITICAL_RED_FLAG"
    triage_status: Optional[str] = "NORMAL"
    triage_message: Optional[str] = None
    red_flag_alert: bool = False
    can_shorten: bool = False

class InterviewAnswerRequest(BaseModel):
    visit_id: int
    question_id: str
    answer: str
    shorten_intake: Optional[bool] = False
    # Voice-origin metadata (present only when the answer was captured by voice).
    input_mode: Optional[str] = Field("text", description="Input modality: 'text' or 'voice'")
    language: Optional[str] = Field(None, description="Canonical language code used for this response, e.g. 'kn-IN'")
    original_transcript: Optional[str] = Field(None, description="Verbatim ASR transcript preserved as source evidence")
    transcription_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="ASR confidence for voice answers")

class InterviewAnswerResponse(BaseModel):
    visit_id: int
    status: str  # "in_progress" or "section_complete"
    is_complete: bool = False
    next_question: Optional[str] = None
    next_question_id: Optional[str] = None
    socrates_state: Optional[Dict[str, Any]] = None
    triage_level: Optional[str] = "NORMAL"
    triage_status: Optional[str] = "NORMAL"
    triage_message: Optional[str] = None
    red_flag_alert: bool = False
    can_shorten: bool = False

class InterviewVoiceAnswerResponse(BaseModel):
    visit_id: int
    transcript: str
    status: str
    next_question: Optional[str] = None
    next_question_id: Optional[str] = None
    socrates_state: Optional[Dict[str, Any]] = None
    triage_level: Optional[str] = "NORMAL"
    triage_status: Optional[str] = "NORMAL"
    triage_message: Optional[str] = None
    red_flag_alert: bool = False
    can_shorten: bool = False

# --- Voice Transcription (ASR-only) Schemas ---
class VoiceTranscribeResponse(BaseModel):
    """Response for POST /voice/transcribe — transcription only, no clinical interpretation.

    Keeping ASR separate from the interview pipeline preserves the architectural
    boundary: Audio -> ASR -> Transcript -> (separate) clinical interpretation.
    """
    success: bool
    language: str
    transcript: str
    confidence: float = Field(0.0, ge=0.0, le=1.0)

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
    triage_level: Optional[str] = "NORMAL"
    triage_status: Optional[str] = "NORMAL"
    red_flag_alert: bool = False

class DoctorApproveRequest(BaseModel):
    visit_id: int
    edits: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

# --- System Configuration Schemas ---
class LanguageInfo(BaseModel):
    code: str
    name: str
    native: str
    short_code: str
    flag: str

class DoctorApproveResponse(BaseModel):
    visit_id: int
    status: str
    message: str
