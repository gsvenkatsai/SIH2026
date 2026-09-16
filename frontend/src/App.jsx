import React, { useState, useEffect } from 'react';
import { I18nProvider, useLanguage, normalizeLanguage, LANGUAGE_LIST } from './i18n';
import RoleSelect from './components/RoleSelect';
import BrandMark from './components/BrandMark';
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
  return (
    <I18nProvider>
      <KioskApp />
    </I18nProvider>
  );
}

function KioskApp() {
  const { t, language, setLanguage: setI18nLanguage, config: langConfig } = useLanguage();
  // Navigation / Role states
  const [activeRole, setActiveRole] = useState('none'); // 'none' | 'patient' | 'doctor'
  const [patientStep, setPatientStep] = useState(1); // 1: Complaint, 2: Interview, 3: Upload, 4: Summary

  // LANGUAGE IS THE FIRST SCREEN: the kiosk opens on language selection;
  // role selection follows once a language is chosen.
  const [languageChosen, setLanguageChosen] = useState(false);

  // Patient Intake States (canonical language code, e.g. 'kn-IN')
  const [selectedLanguage, setSelectedLanguage] = useState(langConfig.code);

  // Keep the i18n layer in sync when the kiosk language changes.
  const changeLanguage = (lang) => {
    const canonical = normalizeLanguage(lang);
    setSelectedLanguage(canonical);
    setI18nLanguage(canonical);
  };
  const [visitId, setVisitId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [finalRecord, setFinalRecord] = useState(null);

  // SOCRATES & Triage States
  const [socratesState, setSocratesState] = useState(null);
  const [redFlagAlert, setRedFlagAlert] = useState(false);
  const [triageStatus, setTriageStatus] = useState('NORMAL');
  const [triageMessage, setTriageMessage] = useState('');
  const [canShorten, setCanShorten] = useState(false);

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
      setErrorMessage(t('err.backend'));
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
      setSocratesState(res.socrates_state || null);
      setRedFlagAlert(res.red_flag_alert || false);
      setTriageStatus(res.triage_status || 'NORMAL');
      setTriageMessage(res.message || '');
      setCanShorten(res.can_shorten || false);
      setPatientStep(2); // Advance to Interview
    } catch (err) {
      console.error(err);
      setErrorMessage(t('err.startFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerInterview = async (qId, answer, shorten = false, voiceMeta = null) => {
    // Always send the CURRENT language so a mid-interview switch (navbar)
    // propagates to the backend without resetting clinical state.
    const meta = {
      language: selectedLanguage,
      ...(voiceMeta ? { input_mode: 'voice', ...voiceMeta } : {})
    };
    try {
      setIsLoading(true);
      setErrorMessage('');

      // Push to history (input mode is preserved so history shows 🎤 vs ⌨️)
      if (answer && answer.trim()) {
        setQaHistory((prev) => [...prev, {
          question: currentQuestion,
          answer,
          inputMode: voiceMeta ? 'voice' : 'text'
        }]);
      }

      const res = await apiAnswerInterview(visitId, qId, answer, shorten, meta);
      if (res.socrates_state) setSocratesState(res.socrates_state);
      if (res.red_flag_alert !== undefined) setRedFlagAlert(res.red_flag_alert);
      if (res.triage_status) setTriageStatus(res.triage_status);
      if (res.message) setTriageMessage(res.message);
      if (res.can_shorten !== undefined) setCanShorten(res.can_shorten);

      if (res.is_complete || res.status === 'completed' || shorten || !res.next_question) {
        // Section complete -> move to document upload
        setPatientStep(3);
      } else if (res.status === 'in_progress' && res.next_question) {
        setCurrentQuestion(res.next_question);
        setQuestionId(res.next_question_id);
      } else {
        setPatientStep(3);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(t('err.submitFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShortenIntake = async () => {
    await handleAnswerInterview(questionId, "Patient requested immediate emergency intake transfer.", true);
  };

  const handleUploadDoc = async (file) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const res = await apiUploadDocument(visitId, file);
      setUploadedDocs((prev) => [...prev, res]);
    } catch (err) {
      console.error(err);
      setErrorMessage(t('err.uploadFailed'));
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
      setPatientStep(4); // Summary Screen
    } catch (err) {
      console.error(err);
      setErrorMessage(t('err.summaryFailed'));
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
          <span className="brand-icon"><BrandMark size={26} /></span>
          <span>MediKiosk</span>
        </div>

        <div className="nav-controls">
          {/* Language switcher — always available once a language is chosen
              (except doctor mode, which is intentionally untranslated).
              Switching mid-interview keeps all collected clinical state. */}
          {languageChosen && activeRole !== 'doctor' && (
            <select
              aria-label="Language / भाषा / ಭಾಷೆ"
              value={selectedLanguage}
              onChange={(e) => changeLanguage(e.target.value)}
              style={{
                background: 'var(--terracotta-wash)',
                color: 'var(--terracotta-deep)',
                border: '1px solid rgba(201, 106, 74, 0.4)',
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.8rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {LANGUAGE_LIST.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          )}

          {activeRole !== 'none' && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setActiveRole('none');
                resetPatientFlow();
                setSelectedDoctorVisitId(null);
              }}
            >
              {t('nav.changeRole')}
            </button>
          )}

          {activeRole === 'patient' && (
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--sage)', background: 'var(--sage-wash)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(120, 155, 120, 0.35)' }}>
              {t('nav.patientMode', { lang: langConfig.native })}
            </span>
          )}

          {activeRole === 'doctor' && (
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--indigo-800)', background: 'var(--indigo-100)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
              {t('nav.doctorMode')}
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

        {/* 1. LANGUAGE FIRST — the kiosk's very first touchpoint (PRD §7.1) */}
        {activeRole === 'none' && !languageChosen && (
          <LanguageSelect
            selectedLanguage={selectedLanguage}
            onSelectLanguage={changeLanguage}
            onNext={() => setLanguageChosen(true)}
          />
        )}

        {/* 2. Role Selection (rendered in the chosen language) */}
        {activeRole === 'none' && languageChosen && (
          <RoleSelect
            onSelectRole={(role) => {
              setActiveRole(role);
              if (role === 'patient') resetPatientFlow();
            }}
          />
        )}

        {/* 3. Patient Kiosk Flow (language already chosen) */}
        {activeRole === 'patient' && (
          <>
            {patientStep === 1 && (
              <ChiefComplaint
                onStartInterview={handleStartInterview}
                isLoading={isLoading}
              />
            )}

            {patientStep === 2 && (
              <AdaptiveInterview
                visitId={visitId}
                selectedLanguage={selectedLanguage}
                currentQuestion={currentQuestion}
                questionId={questionId}
                qaHistory={qaHistory}
                socratesState={socratesState}
                redFlagAlert={redFlagAlert}
                triageStatus={triageStatus}
                triageMessage={triageMessage}
                canShorten={canShorten}
                onShortenIntake={handleShortenIntake}
                onAnswer={handleAnswerInterview}
                onFinishInterview={() => setPatientStep(3)}
                isLoading={isLoading}
              />
            )}

            {patientStep === 3 && (
              <DocumentUpload
                visitId={visitId}
                onUpload={handleUploadDoc}
                uploadedDocs={uploadedDocs}
                onNext={handleProceedToSummary}
                isLoading={isLoading}
              />
            )}

            {patientStep === 4 && (
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
