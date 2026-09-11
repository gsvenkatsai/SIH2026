import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="Anonymous Patient")
    language = Column(String(50), nullable=False, default="English")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    visits = relationship("Visit", back_populates="patient")

class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    chief_complaint = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft, reviewed, approved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    visit = relationship("Visit", back_populates="responses")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=True)
    extracted_json = Column(JSON, nullable=True)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    visit = relationship("Visit", back_populates="documents")

class FinalRecord(Base):
    __tablename__ = "final_record"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False, unique=True)
    structured_json = Column(JSON, nullable=False)  # Merged data with evidence tags, contradictions, attention flags
    approved_by_doctor = Column(Boolean, default=False)
    doctor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    visit = relationship("Visit", back_populates="final_record")
