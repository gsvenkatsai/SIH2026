import React, { useEffect, useRef, useState } from 'react';
import { apiTranscribeVoice } from '../api';
import { useLanguage } from '../i18n';
import { useVoiceRecorder, VOICE_STATE } from '../hooks/useVoiceRecorder';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

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
  visitId: _visitId, // reserved for future in-session resume; not needed by this component
  selectedLanguage: _selectedLanguage, // language flows through the i18n context now
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
  const { t, config } = useLanguage();
  const [answer, setAnswer] = useState('');
  const [voiceError, setVoiceError] = useState(null); // i18n key
  const [transcript, setTranscript] = useState(''); // confirmed-then-committed transcript
  const [editMode, setEditMode] = useState(false);
  const lastConfidenceRef = useRef(0);
  const hasAutoSpokenRef = useRef('');

  const recorder = useVoiceRecorder({
    onRecordingStopped: (blob) => {
      // Audio stopped → upload to backend ASR (browser never sees the Groq key).
      handleTranscribe(blob);
    }
  });

  const tts = useTextToSpeech(config.code);

  const handleTranscribe = async (blob) => {
    setVoiceError(null);
    recorder.setBusy();
    try {
      const result = await apiTranscribeVoice(blob, config.code);
      if (!result.transcript || !result.transcript.trim()) {
        setVoiceError('mic.emptyRecording');
        recorder.reset();
        return;
      }
      setTranscript(result.transcript);
      setEditMode(false);
      lastConfidenceRef.current = result.confidence || 0;
      // PRD audio confirmation: speak the transcript back to the patient.
      tts.speak(`${t('interview.youSaid')} ${result.transcript}`, { force: true });
    } catch (err) {
      setVoiceError(err.kind || 'mic.transcriptionFailed');
      recorder.reset();
    }
  };

  const confirmTranscript = () => {
    // Commit: transcript becomes the answer through the SAME clinical pipeline as typing.
    onAnswer(questionId, transcript, false, {
      language: config.code,
      original_transcript: transcript,
      confidence: lastConfidenceRef.current
    });
    setTranscript('');
    setAnswer('');
    setVoiceError(null);
    recorder.reset();
  };

  const retryRecording = () => {
    setTranscript('');
    setVoiceError(null);
    recorder.reset();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    onAnswer(questionId, answer, false, null);
    setAnswer('');
    setVoiceError(null);
    recorder.reset();
  };

  // Auto-speak each new question once — guarded against re-renders/StrictMode.
  const speakRef = useRef(null);
  useEffect(() => {
    speakRef.current = tts;
  }, [tts]);

  useEffect(() => {
    if (!currentQuestion || !tts.available) return;
    if (hasAutoSpokenRef.current === currentQuestion) return;
    hasAutoSpokenRef.current = currentQuestion;
    const timer = setTimeout(() => speakRef.current?.speak(currentQuestion), 350);
    return () => clearTimeout(timer);
  }, [currentQuestion, tts.available]);

  // Re-speak when the patient switches language mid-interview.
  useEffect(() => {
    hasAutoSpokenRef.current = '';
  }, [config.code]);

  const filledCount = SOCRATES_SCHEMA.filter((dim) => {
    const slot = socratesState?.[dim.key] || socratesState?.[dim.alias];
    return slot && slot.value && slot.value !== 'Not reported' && slot.value !== 'None';
  }).length;

  const progressPercent = Math.max(
    Math.min(((qaHistory.length + 1) / 5) * 100, 100),
    Math.round((filledCount / 8) * 100)
  );

  const vs = recorder.state;
  const isRecording = vs === VOICE_STATE.RECORDING;
  const isBusy = vs === VOICE_STATE.REQUESTING || vs === VOICE_STATE.UPLOADING || vs === VOICE_STATE.TRANSCRIBING;
  const isTranscribed = vs === VOICE_STATE.TRANSCRIBED && transcript;

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
              <strong style={{ color: '#fee2e2', fontSize: '1.1rem', letterSpacing: '0.3px' }}>
                {t('redflag.title')}
              </strong>
              <p style={{ color: '#fecaca', fontSize: '0.88rem', lineHeight: 1.45, marginBottom: '0.85rem' }}>
                {triageMessage || t('redflag.title')}
              </p>
              {canShorten && onShortenIntake && (
                <button type="button" onClick={onShortenIntake} style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #f87171',
                  padding: '0.55rem 1.1rem',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}>
                  {t('redflag.expedite')}
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
            {t('interview.header', { n: qaHistory.length + 1, lang: config.native })}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('interview.answered', { n: qaHistory.length })}
          </span>
        </div>
        <div className="progress-bar-bg" style={{ marginTop: '0.6rem' }}>
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>

        {/* 8-Segment SOCRATES Protocol Coverage Bar */}
        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              {t('interview.tracker')}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: filledCount >= 6 ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
              {t('interview.dimensions', { filled: filledCount, pct: progressPercent })}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.35rem' }}>
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
                <div key={dim.key} style={{ background: bg, border: border, borderRadius: '6px', padding: '0.35rem 0.2rem', textAlign: 'center', cursor: 'default' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color }}>{icon} {dim.letter}</div>
                  <div style={{ fontSize: '0.62rem', color, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <div style={{ fontSize: '1.8rem', background: 'rgba(99, 102, 241, 0.15)', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)' }}>
            🤖
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              {currentQuestion}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('interview.sourceNote')}</span>
              {tts.available ? (
                <>
                  <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => tts.replay(currentQuestion)}>
                    {t('interview.repeat')}
                  </button>
                  {tts.speaking && (
                    <button type="button" className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={tts.stop}>
                      {t('interview.stopAudio')}
                    </button>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>{t('interview.ttsUnavailable')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Voice error banner — patient-friendly, translated, no internal API details */}
        {voiceError && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fda4af',
            padding: '0.8rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginTop: '1rem',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <span>⚠️ {t(voiceError)}</span>
            <button type="button" className="btn btn-outline" style={{ padding: '0.25rem 0.7rem', fontSize: '0.8rem' }} onClick={retryRecording}>
              {t('interview.retryRecording')}
            </button>
          </div>
        )}

        {/* Transcript confirmation card (PRD audio confirmation requirement) */}
        {isTranscribed && !editMode && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.1rem',
            marginTop: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: 600, marginBottom: '0.3rem' }}>
              {t('interview.transcribedVia', { lang: config.native })}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {t('interview.youSaid')}
            </div>
            <div style={{ fontSize: '1.05rem', color: '#f1f5f9', lineHeight: 1.5, marginBottom: '0.9rem' }}>
              “{transcript}”
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={confirmTranscript}>
                {t('interview.confirmTranscript')}
              </button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={() => setEditMode(true)}>
                {t('interview.editTranscript')}
              </button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={retryRecording}>
                {t('interview.retryRecording')}
              </button>
            </div>
          </div>
        )}

        {/* Editable transcript mode */}
        {isTranscribed && editMode && (
          <div style={{ marginTop: '1rem' }}>
            <textarea
              className="form-textarea"
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
              <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={confirmTranscript}>
                {t('interview.confirmTranscript')}
              </button>
              <button type="button" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={() => setEditMode(false)}>
                {t('interview.retryRecording')}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <textarea
              className="form-textarea"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t('interview.typePlaceholder')}
              required
            />

            {/* Mic button with full state machine visuals */}
            <div style={{ position: 'absolute', right: '12px', bottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isRecording && <span style={{ fontSize: '0.78rem', color: '#fda4af' }}>{t('interview.listening')}</span>}
              {vs === VOICE_STATE.TRANSCRIBING && <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{t('interview.understanding')}</span>}
              <button
                type="button"
                onClick={() => (isRecording ? recorder.stopRecording() : recorder.startRecording())}
                disabled={isBusy || isTranscribed}
                aria-label={isRecording ? t('interview.stopAndTranscribe') : t('interview.tapToSpeak')}
                title={isRecording ? t('interview.stopAndTranscribe') : t('interview.tapToSpeak')}
                style={{
                  background: isRecording ? 'rgba(244, 63, 94, 0.35)' : 'rgba(99, 102, 241, 0.15)',
                  border: isRecording ? '2px solid var(--accent-rose)' : '1px solid var(--border-active)',
                  color: isRecording ? '#fda4af' : '#a5b4fc',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  cursor: isBusy || isTranscribed ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: isRecording ? '0 0 14px rgba(244, 63, 94, 0.6)' : 'none',
                  animation: isRecording ? 'pulse 1.2s ease-in-out infinite' : 'none'
                }}
              >
                {vs === VOICE_STATE.REQUESTING ? '⏳' : isRecording ? '⏹️' : vs === VOICE_STATE.TRANSCRIBING ? '🧠' : '🎙️'}
              </button>
            </div>
          </div>

          {isRecording && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-rose)' }}>🔴</span> {t('interview.listening')} — {Math.round(recorder.elapsedMs / 1000)}s
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-outline" onClick={onFinishInterview}>
              {t('interview.skip')}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isBusy || isTranscribed || !answer.trim()}
            >
              {isLoading ? t('interview.processing') : t('interview.submit')}
            </button>
          </div>
        </form>
      </div>

      {/* Prior Q&A History Preview */}
      {qaHistory.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem 2rem' }}>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
            {t('interview.answeredHistory', { n: qaHistory.length })}
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
                  {item.inputMode === 'voice' ? <span className="tag-interview">{t('interview.tagVoice')}</span> : <span className="tag-interview">{t('interview.tagText')}</span>}
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
