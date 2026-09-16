import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def utc_now():
    """Returns current UTC datetime compatible with SQLAlchemy and Python 3.12+."""
    return datetime.datetime.now(datetime.timezone.utc)

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="Anonymous Patient")
    language = Column(String(50), nullable=False, default="English")
    created_at = Column(DateTime, default=utc_now)

    visits = relationship("Visit", back_populates="patient")

class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    chief_complaint = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft, reviewed, approved
    socrates_state = Column(JSON, nullable=True)
    triage_level = Column(String(50), default="NORMAL")
    triage_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    patient = relationship("Patient", back_populates="visits")
    responses = relationship("InterviewResponse", back_populates="visit", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="visit", cascade="all, delete-orphan")
    final_record = relationship("FinalRecord", back_populates="visit", uselist=False, cascade="all, delete-orphan")

class InterviewResponse(Base):
    __tablename__ = "interview_responses"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    question_id = Column(String(100), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now)

    visit = relationship("Visit", back_populates="responses")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=True)
    extracted_json = Column(JSON, nullable=True)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now)

    visit = relationship("Visit", back_populates="documents")

class FinalRecord(Base):
    __tablename__ = "final_record"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False, unique=True)
    structured_json = Column(JSON, nullable=False)  # Merged data with evidence tags, contradictions, attention flags
    approved_by_doctor = Column(Boolean, default=False)
    doctor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    visit = relationship("Visit", back_populates="final_record")
