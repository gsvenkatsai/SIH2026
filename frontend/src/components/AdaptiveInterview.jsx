import React, { useState, useRef } from 'react';
import { apiAnswerInterviewVoice } from '../api';

const SOCRATES_SCHEMA = [
  { key: 'site', alias: 'site', label: 'Site', letter: 'S' },
  { key: 'onset', alias: 'onset', label: 'Onset', letter: 'O' },
  { key: 'character', alias: 'character', label: 'Character', letter: 'C' },
  { key: 'radiation', alias: 'radiation', label: 'Radiation', letter: 'R' },
  { key: 'associated', alias: 'associated_symptoms', label: 'Associated', letter: 'A' },
  { key: 'timing', alias: 'timing', label: 'Timing', letter: 'T' },
  { key: 'exacerbating', alias: 'exacerbating_relieving', label: 'Factors', letter: 'E' },
  { key: 'severity', alias: 'severity', label: 'Severity', letter: 'S' }
];

export default function AdaptiveInterview({
  visitId,
  selectedLanguage = 'English',
  currentQuestion,
  questionId,
  qaHistory,
  socratesState,
  redFlagAlert = false,
  triageStatus = 'NORMAL',
  triageMessage = '',
  canShorten = false,
  onShortenIntake,
  onAnswer,
  onFinishInterview,
  isLoading
}) {
  const [answer, setAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceSuccess, setVoiceSuccess] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onAnswer(questionId, answer);
    setAnswer('');
    setVoiceSuccess('');
    setVoiceError('');
  };

  const startRecording = async () => {
    setVoiceError('');
    setVoiceSuccess('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError('Microphone access is not supported in this browser. Please type your response manually.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      setVoiceError('Microphone permission denied or device not found. Please type your response manually below.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
  };

  const handleAudioUpload = async (audioBlob) => {
    try {
      setIsTranscribing(true);
      const result = await apiAnswerInterviewVoice(visitId, questionId, audioBlob, selectedLanguage);
      if (result && result.transcript) {
        setAnswer(result.transcript);
        setVoiceSuccess(`Transcribed via Groq Whisper-large-v3 (${selectedLanguage}). Please review or edit before submitting.`);
      } else {
        setVoiceError('No speech recognized in recording. Please type your answer manually.');
      }
    } catch (err) {
      console.error('Groq Whisper error:', err);
      setVoiceError(`Voice transcription error (${err.message || 'Groq API failure'}). Please type your response manually below.`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const filledCount = SOCRATES_SCHEMA.filter(dim => {
    const slot = socratesState?.[dim.key] || socratesState?.[dim.alias];
    return slot && slot.value && slot.value !== 'Not reported' && slot.value !== 'None';
  }).length;

  const progressPercent = Math.max(
    Math.min(((qaHistory.length + 1) / 5) * 100, 100),
    Math.round((filledCount / 8) * 100)
  );

  return (
    <div style={{ maxWidth: '720px', margin: '2rem auto' }}>
      {/* Emergency Red-Flag Circuit Breaker Alert Banner */}
      {(redFlagAlert || triageStatus === 'CRITICAL_RED_FLAG') && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.35))',
          border: '2px solid rgba(239, 68, 68, 0.8)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 0 24px rgba(239, 68, 68, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>🚨</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong style={{ color: '#fee2e2', fontSize: '1.1rem', letterSpacing: '0.3px' }}>
                  EMERGENCY RED FLAG: Potential Acute Coronary Syndrome
                </strong>
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Emergency Triage Alert
                </span>
              </div>
              <p style={{ color: '#fecaca', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                {triageMessage || 'High-risk cardiac presentation detected (crushing chest pain radiating to left arm/jaw with autonomic distress or severe pain >= 7). Clinical triage staff have been prioritized.'}
              </p>
              {canShorten && onShortenIntake && (
                <button
                  type="button"
                  onClick={onShortenIntake}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: '1px solid #f87171',
                    padding: '0.55rem 1.1rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
                  }}
                >
                  ⚡ Expedite Intake — Move Immediately to Doctor Review →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress & SOCRATES Header */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>
            ADAPTIVE AI INTERVIEW — QUESTION #{qaHistory.length + 1} ({selectedLanguage})
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {qaHistory.length} Answered
          </span>
        </div>
        <div className="progress-bar-bg" style={{ marginTop: '0.6rem' }}>
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>

        {/* 8-Segment SOCRATES Protocol Coverage Bar */}
        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              SOCRATES Clinical Protocol Tracker
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: filledCount >= 6 ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
              {filledCount}/8 Dimensions Captured ({progressPercent}%)
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '0.35rem'
          }}>
            {SOCRATES_SCHEMA.map((dim) => {
              const slot = socratesState?.[dim.key] || socratesState?.[dim.alias];
              const isFilled = Boolean(slot && slot.value && slot.value !== 'Not reported' && slot.value !== 'None');
              const isAlert = slot?.status === 'alert';
              const isUnclear = slot?.status === 'unclear';

              let bg = 'rgba(30, 41, 59, 0.4)';
              let border = '1px dashed rgba(148, 163, 184, 0.25)';
              let color = '#64748b';
              let icon = '○';

              if (isAlert) {
                bg = 'rgba(239, 68, 68, 0.2)';
                border = '1px solid rgba(239, 68, 68, 0.6)';
                color = '#fca5a5';
                icon = '🚨';
              } else if (isFilled) {
                bg = 'rgba(16, 185, 129, 0.15)';
                border = '1px solid rgba(16, 185, 129, 0.4)';
                color = '#6ee7b7';
                icon = '✓';
              } else if (isUnclear) {
                bg = 'rgba(245, 158, 11, 0.15)';
                border = '1px solid rgba(245, 158, 11, 0.4)';
                color = '#fcd34d';
                icon = '~';
              }

              return (
                <div
                  key={dim.key}
                  title={isFilled ? `${dim.label}: ${slot.value}` : `${dim.label} (unfilled)`}
                  style={{
                    background: bg,
                    border: border,
                    borderRadius: '6px',
                    padding: '0.35rem 0.2rem',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: color }}>
                    {icon} {dim.letter}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: color, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dim.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Question Box */}
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: '1.8rem',
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius-md)'
          }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              {currentQuestion}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Source-tagged to clinical decision tree • Voice input via Groq Whisper-large-v3
            </p>
          </div>
        </div>

        {/* Error / Fallback Alert Banner */}
        {voiceError && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fda4af',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginTop: '1rem',
            fontSize: '0.88rem'
          }}>
            ⚠️ {voiceError}
          </div>
        )}

        {/* Success Transcription Banner */}
        {voiceSuccess && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#6ee7b7',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginTop: '1rem',
            fontSize: '0.88rem'
          }}>
            ✓ {voiceSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <textarea
              className="form-textarea"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Type your response in ${selectedLanguage} (or click the microphone icon to record)...`}
              required
            />

            {/* Real Mic Capture Button */}
            <div style={{ position: 'absolute', right: '12px', bottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isTranscribing && (
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                  Transcribing (Whisper)...
                </span>
              )}
              <button
                type="button"
                onClick={toggleMic}
                disabled={isTranscribing}
                title={isRecording ? 'Click to stop recording & transcribe' : 'Click to start voice recording'}
                style={{
                  background: isRecording ? 'rgba(244, 63, 94, 0.35)' : 'rgba(99, 102, 241, 0.15)',
                  border: isRecording ? '2px solid var(--accent-rose)' : '1px solid var(--border-active)',
                  color: isRecording ? '#fda4af' : '#a5b4fc',
                  borderRadius: '50%',
                  width: '42px',
                  height: '42px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: isRecording ? '0 0 12px rgba(244, 63, 94, 0.6)' : 'none'
                }}
              >
                🎙️
              </button>
            </div>
          </div>

          {isRecording && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="pulse-dot" style={{ color: 'var(--accent-rose)' }}>🔴</span> Recording audio in {selectedLanguage}... Click microphone icon again to stop & transcribe.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onFinishInterview}
            >
              Skip to Document Upload →
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isTranscribing || !answer.trim()}
            >
              {isLoading ? 'Processing...' : 'Submit Answer →'}
            </button>
          </div>
        </form>
      </div>

      {/* Prior Q&A History Preview */}
      {qaHistory.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem 2rem' }}>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
            📋 Answered History ({qaHistory.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {qaHistory.map((item, idx) => (
              <div key={idx} style={{
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-color)',
                padding: '0.8rem 1rem',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  Q{idx + 1}: {item.question}
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="tag-interview">🎤 Interview</span> {item.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
