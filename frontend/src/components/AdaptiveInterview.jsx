import React, { useEffect, useRef, useState } from 'react';
import { apiTranscribeVoice } from '../api';
import { useLanguage } from '../i18n';
import { useVoiceRecorder, VOICE_STATE } from '../hooks/useVoiceRecorder';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import JourneyProgress from './JourneyProgress';
import VoiceField from './VoiceField';
import TranscriptConfirmation from './TranscriptConfirmation';

const SOCRATES_SCHEMA = [
  { key: 'site', alias: 'site', label: 'S', full: 'Site' },
  { key: 'onset', alias: 'onset', label: 'O', full: 'Onset' },
  { key: 'character', alias: 'character', label: 'C', full: 'Character' },
  { key: 'radiation', alias: 'radiation', label: 'R', full: 'Radiation' },
  { key: 'associated', alias: 'associated_symptoms', label: 'A', full: 'Associated' },
  { key: 'timing', alias: 'timing', label: 'T', full: 'Timing' },
  { key: 'exacerbating', alias: 'exacerbating_relieving', label: 'E', full: 'Factors' },
  { key: 'severity', alias: 'severity', label: 'S', full: 'Severity' }
];

export default function AdaptiveInterview({
  visitId: _visitId,
  selectedLanguage: _selectedLanguage,
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
  const [transcript, setTranscript] = useState('');
  const [editMode, setEditMode] = useState(false);
  const lastConfidenceRef = useRef(0);
  const hasAutoSpokenRef = useRef('');

  const recorder = useVoiceRecorder({
    onRecordingStopped: (blob) => handleTranscribe(blob)
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
      recorder.setTranscribed();
      // Audio confirmation: speak the words back to the patient.
      tts.speak(`${t('interview.youSaid')} ${result.transcript}`, { force: true });
    } catch (err) {
      setVoiceError(err.kind || 'mic.transcriptionFailed');
      recorder.reset();
    }
  };

  const confirmTranscript = () => {
    onAnswer(questionId, transcript, false, {
      input_mode: 'voice',
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
    setEditMode(false);
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

  // Auto-speak each new question once — re-render/StrictMode guarded.
  const speakRef = useRef(null);
  useEffect(() => { speakRef.current = tts; }, [tts]);
  useEffect(() => {
    if (!currentQuestion || !tts.available) return;
    if (hasAutoSpokenRef.current === currentQuestion) return;
    hasAutoSpokenRef.current = currentQuestion;
    const timer = setTimeout(() => speakRef.current?.speak(currentQuestion), 350);
    return () => clearTimeout(timer);
  }, [currentQuestion, tts.available]);

  useEffect(() => { hasAutoSpokenRef.current = ''; }, [config.code]);

  const filledCount = SOCRATES_SCHEMA.filter((dim) => {
    const slot = socratesState?.[dim.key] || socratesState?.[dim.alias];
    return slot && slot.value && slot.value !== 'Not reported' && slot.value !== 'None';
  }).length;

  const vs = recorder.state;
  const voiceActive = vs !== VOICE_STATE.IDLE && vs !== VOICE_STATE.ERROR || vs === VOICE_STATE.ERROR;
  const isTranscribed = vs === VOICE_STATE.TRANSCRIBED && transcript;
  const questionNumber = qaHistory.length + 1;

  return (
    <div style={{ maxWidth: '1060px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', gap: '3rem' }}>
      {/* LEFT — journey + SOCRATES coverage */}
      <div style={{ paddingTop: '0.5rem' }}>
        <JourneyProgress
          steps={[
            { key: 'complaint', label: t('journey.complaint') },
            { key: 'interview', label: t('journey.interview') },
            { key: 'records', label: t('journey.records') },
            { key: 'review', label: t('journey.review') },
            { key: 'doctor', label: t('journey.doctor') }
          ]}
          currentKey="interview"
        />

        <div style={{ marginTop: '2.2rem' }}>
          <div className="kicker" style={{ marginBottom: '0.7rem' }}>{t('interview.trackerShort')}</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '150px' }}>
            {SOCRATES_SCHEMA.map((dim) => {
              const slot = socratesState?.[dim.key] || socratesState?.[dim.alias];
              const filled = Boolean(slot && slot.value && slot.value !== 'Not reported' && slot.value !== 'None');
              const alert = slot?.status === 'alert';
              return (
                <div
                  key={dim.key}
                  title={`${dim.full}: ${slot?.value || t('interview.unfilled')}`}
                  style={{
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.72rem', fontWeight: 700,
                    background: alert ? 'var(--terracotta-wash)' : filled ? 'var(--sage-wash)' : 'transparent',
                    color: alert ? 'var(--terracotta-deep)' : filled ? '#4E6B4E' : 'var(--ink-faint)',
                    border: `1.5px solid ${alert ? 'var(--terracotta)' : filled ? 'var(--sage)' : 'var(--line-strong)'}`
                  }}
                >
                  {dim.label}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.6rem' }}>
            {t('interview.dimensionsShort', { filled: filledCount, pct: Math.round((filledCount / 8) * 100) })}
          </div>
        </div>
      </div>

      {/* RIGHT — the question */}
      <div style={{ flex: 1, maxWidth: '660px' }}>
        {/* Red-flag banner — warm warning, never a red panel */}
        {(redFlagAlert || triageStatus === 'CRITICAL_RED_FLAG') && (
          <div className="flag-critical" style={{ marginBottom: '1.6rem' }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.4rem' }}>🚨</span>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{t('redflag.title')}</strong>
                <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>{triageMessage}</span>
                {canShorten && onShortenIntake && (
                  <button type="button" className="btn btn-primary" style={{ marginTop: '0.8rem', padding: '0.55rem 1.1rem', fontSize: '0.88rem' }} onClick={onShortenIntake}>
                    {t('redflag.expedite')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="question-index">
          {t('interview.questionOf', { n: questionNumber })} · {config.native}
        </div>
        <h1 className="question-text">{currentQuestion}</h1>

        <hr className="section-rule" style={{ margin: '1.4rem 0 1.6rem' }} />

        {/* Question controls: replay / stop */}
        <div style={{ display: 'flex', gap: '0.7rem', marginBottom: '1.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {tts.available ? (
            <>
              <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 1rem', fontSize: '0.86rem' }} onClick={() => tts.replay(currentQuestion)}>
                🔊 {t('interview.repeat')}
              </button>
              {tts.speaking && (
                <button type="button" className="btn btn-outline" style={{ padding: '0.45rem 1rem', fontSize: '0.86rem' }} onClick={tts.stop}>
                  🔇 {t('interview.stopAudio')}
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>{t('interview.ttsUnavailable')}</span>
          )}
        </div>

        {/* Voice field — appears as the primary interaction */}
        {voiceActive && !isTranscribed ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <VoiceField
              state={vs}
              elapsedMs={recorder.elapsedMs}
              onStart={recorder.startRecording}
              onStop={recorder.stopRecording}
              disabled={isLoading}
              idleLabel={t('interview.tapToSpeak')}
              listeningLabel={t('interview.listening')}
              sendingLabel={t('interview.sending')}
              understandingLabel={t('interview.understanding')}
              errorLabel={t(voiceError || 'mic.generic')}
              hintLabel={t('interview.speakNaturally')}
              error={voiceError ? t(voiceError) : null}
              onRetry={retryRecording}
              retryLabel={t('interview.retryRecording')}
            />
          </div>
        ) : !isTranscribed && (
          <button
            type="button"
            className="btn btn-indigo"
            style={{ padding: '0.85rem 1.6rem', fontSize: '1rem' }}
            onClick={recorder.startRecording}
            disabled={isLoading}
          >
            🎙 {t('interview.tapToSpeak')}
          </button>
        )}

        {/* Transcript confirmation — editorial pull-quote */}
        {isTranscribed && (
          <div style={{ marginBottom: '1.5rem' }}>
            <TranscriptConfirmation
              transcript={transcript}
              langLabel={config.native}
              heading={t('interview.youSaid')}
              confirmLabel={t('interview.confirmTranscript')}
              editLabel={t('interview.editTranscript')}
              retryLabel={t('interview.retryRecording')}
              hearAgainLabel={t('interview.hearAgain')}
              onConfirm={confirmTranscript}
              onEdit={() => setEditMode(true)}
              onRetry={retryRecording}
              onHearAgain={() => tts.replay(`${t('interview.youSaid')} ${transcript}`)}
              editMode={editMode}
              onTranscriptChange={setTranscript}
            />
          </div>
        )}

        {/* Typed answer — the quiet alternative */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('interview.typeLabel')}</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t('interview.typePlaceholder')}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline" onClick={onFinishInterview}>
              {t('interview.skip')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !answer.trim()}>
              {isLoading ? t('interview.processing') : t('interview.submit')}
            </button>
          </div>
        </form>

        {/* Answered history — quiet editorial list, not cards */}
        {qaHistory.length > 0 && (
          <div style={{ marginTop: '2.4rem', borderTop: '1px solid var(--line)', paddingTop: '1.4rem' }}>
            <div className="kicker" style={{ marginBottom: '1rem' }}>
              {t('interview.answeredHistory', { n: qaHistory.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {qaHistory.map((item, idx) => (
                <div key={idx} style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.84rem', color: 'var(--ink-faint)', marginBottom: '0.15rem' }}>
                    {item.question}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={item.inputMode === 'voice' ? 'tag-interview' : 'tag-document'} style={{ fontSize: '0.7rem' }}>
                      {item.inputMode === 'voice' ? t('interview.tagVoice') : t('interview.tagText')}
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>{item.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
