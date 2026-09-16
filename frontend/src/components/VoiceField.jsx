import React from 'react';
import { VOICE_STATE } from '../hooks/useVoiceRecorder';

/**
 * VoiceField — the signature MediKiosk voice interaction.
 *
 * A deep-indigo field with the central microphone, concentric rings, and a
 * saffron waveform. The visuals map 1:1 to the REAL recorder state machine
 * (idle / requesting / recording / uploading / transcribing / transcribed /
 * error) — no simulated states.
 */
const WAVE_BARS = 9;

export default function VoiceField({
  state,
  elapsedMs = 0,
  onStart,
  onStop,
  disabled = false,
  idleLabel,
  listeningLabel,
  sendingLabel,
  understandingLabel,
  errorLabel,
  hintLabel,
  error = null,
  onRetry = null,
  retryLabel
}) {
  const isRecording = state === VOICE_STATE.RECORDING;
  const isBusy =
    state === VOICE_STATE.REQUESTING ||
    state === VOICE_STATE.UPLOADING ||
    state === VOICE_STATE.TRANSCRIBING;

  let status = idleLabel;
  let icon = '🎙';
  if (state === VOICE_STATE.REQUESTING) { status = listeningLabel; icon = '⏳'; }
  if (isRecording) { status = listeningLabel; icon = '🎙'; }
  if (state === VOICE_STATE.UPLOADING) { status = sendingLabel; icon = '⏳'; }
  if (state === VOICE_STATE.TRANSCRIBING) { status = understandingLabel; icon = '🧠'; }
  if (state === VOICE_STATE.ERROR) { status = errorLabel; icon = '🎙'; }

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="voice-field">
      <div style={{ position: 'relative' }}>
        <div className="mic-rings">
          <button
            type="button"
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? onStop : onStart}
            disabled={disabled || isBusy}
            aria-label={status}
            title={status}
          >
            {icon}
          </button>
        </div>

        <div style={{ marginTop: '1.1rem', fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.01em' }}>
          {status}
          {isRecording && (
            <span style={{ opacity: 0.75, fontWeight: 500, marginLeft: '0.5rem' }}>
              {seconds}s
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.9rem' }}>
          <div className={`waveform ${isRecording ? 'live' : ''}`} aria-hidden="true">
            {Array.from({ length: WAVE_BARS }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>

        {state === VOICE_STATE.ERROR ? (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#E8C9BD', fontSize: '0.9rem' }}>
              {error || errorLabel}
            </p>
            {onRetry && (
              <button type="button" className="btn btn-outline" style={{ marginTop: '0.7rem', borderColor: 'rgba(247,243,234,0.35)', color: '#F2EDE2' }} onClick={onRetry}>
                {retryLabel}
              </button>
            )}
          </div>
        ) : (
          <p style={{ marginTop: '0.9rem', color: 'rgba(247,243,234,0.72)', fontSize: '0.9rem' }}>
            {hintLabel}
          </p>
        )}
      </div>
    </div>
  );
}
