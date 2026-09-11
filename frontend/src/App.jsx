import React, { useState, useEffect } from 'react';
import RoleSelect from './components/RoleSelect';
import LanguageSelect from './components/LanguageSelect';
import ChiefComplaint from './components/ChiefComplaint';
import AdaptiveInterview from './components/AdaptiveInterview';
import DocumentUpload from './components/DocumentUpload';
import PatientSummary from './components/PatientSummary';
import DoctorQueue from './components/DoctorQueue';
import DoctorPatientView from './components/DoctorPatientView';

import {
  apiStartInterview,
  apiAnswerInterview,
  apiUploadDocument,
  apiFinalizeRecord,
  apiGetDoctorQueue,
  apiGetPatientRecord,
  apiApproveRecord
} from './api';

export default function App() {
  // Navigation / Role states
  const [activeRole, setActiveRole] = useState('none'); // 'none' | 'patient' | 'doctor'
  const [patientStep, setPatientStep] = useState(1); // 1: Lang, 2: Complaint, 3: Interview, 4: Upload, 5: Summary

  // Patient Intake States
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [visitId, setVisitId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [finalRecord, setFinalRecord] = useState(null);

  // Doctor Portal States
  const [doctorQueue, setDoctorQueue] = useState([]);
  const [selectedDoctorVisitId, setSelectedDoctorVisitId] = useState(null);
  const [selectedDoctorRecord, setSelectedDoctorRecord] = useState(null);

  // Global UI State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-fetch Doctor Queue when switching to Doctor role
  useEffect(() => {
    if (activeRole === 'doctor') {
      fetchDoctorQueue();
    }
  }, [activeRole]);

  const fetchDoctorQueue = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetDoctorQueue();
      setDoctorQueue(data);
      setErrorMessage('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Unable to connect to backend server. Make sure FastAPI is running on port 8000.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Patient Kiosk Handlers ---
  const handleStartInterview = async (chiefComplaint, patientName) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await apiStartInterview(chiefComplaint, patientName, selectedLanguage);
      setVisitId(res.visit_id);
      setCurrentQuestion(res.question);
      setQuestionId(res.question_id);
      setPatientStep(3); // Advance to Interview
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to start intake interview. Check backend status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerInterview = async (qId, answer) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      // Push to history
      setQaHistory((prev) => [...prev, { question: currentQuestion, answer }]);

      const res = await apiAnswerInterview(visitId, qId, answer);
      if (res.status === 'in_progress' && res.next_question) {
        setCurrentQuestion(res.next_question);
        setQuestionId(res.next_question_id);
      } else {
        // Section complete -> move to document upload
        setPatientStep(4);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to submit answer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDoc = async (file) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await apiUploadDocument(visitId, file);
      setUploadedDocs((prev) => [...prev, res]);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to upload document.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToSummary = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await apiFinalizeRecord(visitId);
      setFinalRecord(res);
      setPatientStep(5); // Summary Screen
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to compile patient summary.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Doctor Portal Handlers ---
  const handleSelectDoctorVisit = async (vId) => {
    try {
      setIsLoading(true);
      setSelectedDoctorVisitId(vId);
      const data = await apiGetPatientRecord(vId);
      setSelectedDoctorRecord(data);
      setErrorMessage('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load patient record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDoctorRecord = async (vId, edits, notes) => {
    try {
      setIsLoading(true);
      await apiApproveRecord(vId, edits, notes);
      // Refresh record & queue
      const updated = await apiGetPatientRecord(vId);
      setSelectedDoctorRecord(updated);
      await fetchDoctorQueue();
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to approve patient record.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPatientFlow = () => {
    setVisitId(null);
    setQaHistory([]);
    setUploadedDocs([]);
    setFinalRecord(null);
    setPatientStep(1);
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand" onClick={() => setActiveRole('none')} style={{ cursor: 'pointer' }}>
          <span className="brand-icon">🩺</span>
          <span>MediKiosk</span>
        </div>

        <div className="nav-controls">
          {activeRole !== 'none' && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setActiveRole('none');
                resetPatientFlow();
                setSelectedDoctorVisitId(null);
              }}
            >
              🔄 Change Role
            </button>
          )}

          {activeRole === 'patient' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.15)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
              Patient Mode ({selectedLanguage})
            </span>
          )}

          {activeRole === 'doctor' && (
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-indigo)', background: 'rgba(99, 102, 241, 0.15)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
              👨‍⚕️ Doctor Mode
            </span>
          )}
        </div>
      </header>

      {/* Main Body Content */}
      <main style={{ flex: 1, padding: '1rem 1.5rem' }}>
        {errorMessage && (
          <div style={{
            maxWidth: '800px',
            margin: '1rem auto',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#fda4af',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 1. Role Selection Screen */}
        {activeRole === 'none' && (
          <RoleSelect
            onSelectRole={(role) => {
              setActiveRole(role);
              if (role === 'patient') resetPatientFlow();
            }}
          />
        )}

        {/* 2. Patient Kiosk Flow */}
        {activeRole === 'patient' && (
          <>
            {patientStep === 1 && (
              <LanguageSelect
                selectedLanguage={selectedLanguage}
                onSelectLanguage={setSelectedLanguage}
                onNext={() => setPatientStep(2)}
              />
            )}

            {patientStep === 2 && (
              <ChiefComplaint
                onStartInterview={handleStartInterview}
                isLoading={isLoading}
              />
            )}

            {patientStep === 3 && (
              <AdaptiveInterview
                visitId={visitId}
                selectedLanguage={selectedLanguage}
                currentQuestion={currentQuestion}
                questionId={questionId}
                qaHistory={qaHistory}
                onAnswer={handleAnswerInterview}
                onFinishInterview={() => setPatientStep(4)}
                isLoading={isLoading}
              />
            )}

            {patientStep === 4 && (
              <DocumentUpload
                visitId={visitId}
                onUpload={handleUploadDoc}
                uploadedDocs={uploadedDocs}
                onNext={handleProceedToSummary}
                isLoading={isLoading}
              />
            )}

            {patientStep === 5 && (
              <PatientSummary
                finalRecord={finalRecord}
                onComplete={() => {
                  setActiveRole('doctor');
                  handleSelectDoctorVisit(visitId);
                }}
                onReturnToHome={() => setActiveRole('none')}
              />
            )}
          </>
        )}

        {/* 3. Doctor Portal Flow */}
        {activeRole === 'doctor' && (
          <>
            {selectedDoctorVisitId && selectedDoctorRecord ? (
              <DoctorPatientView
                patientRecord={selectedDoctorRecord}
                onApprove={handleApproveDoctorRecord}
                onBack={() => {
                  setSelectedDoctorVisitId(null);
                  setSelectedDoctorRecord(null);
                  fetchDoctorQueue();
                }}
                isLoading={isLoading}
              />
            ) : (
              <DoctorQueue
                queue={doctorQueue}
                onSelectVisit={handleSelectDoctorVisit}
                onRefresh={fetchDoctorQueue}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
