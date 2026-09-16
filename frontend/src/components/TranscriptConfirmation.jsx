import React from 'react';

/**
 * TranscriptConfirmation — editorial pull-quote view of the patient's words.
 * The original language transcript is always shown verbatim; nothing here
 * translates or replaces it.
 */
export default function TranscriptConfirmation({
  transcript,
  langLabel,
  confirmLabel,
  editLabel,
  retryLabel,
  hearAgainLabel,
  heading,
  onConfirm,
  onEdit,
  onRetry,
  onHearAgain,
  editMode = false,
  onTranscriptChange
}) {
  if (editMode) {
    return (
      <div className="transcript-quote">
        <div className="kicker" style={{ marginBottom: '0.6rem' }}>{heading} · {langLabel}</div>
        <textarea
          className="form-textarea"
          rows={3}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          style={{ fontSize: '1.1rem' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="btn btn-outline" onClick={onRetry}>{retryLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="transcript-quote">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="kicker">{heading}</div>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '0.3rem 0.8rem', fontSize: '0.82rem' }}
          onClick={onHearAgain}
          title={hearAgainLabel}
        >
          🔊 {hearAgainLabel}
        </button>
      </div>
      <blockquote style={{ marginTop: '0.8rem' }}>
        “{transcript}”
      </blockquote>
      <div style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: '0.5rem' }}>
        {langLabel}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className="btn btn-secondary" onClick={onEdit}>{editLabel}</button>
        <button type="button" className="btn btn-outline" onClick={onRetry}>{retryLabel}</button>
      </div>
    </div>
  );
}
