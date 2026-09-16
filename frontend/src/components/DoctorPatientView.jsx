import React, { useState, useEffect } from 'react';

const SOCRATES_CARD_CONFIG = [
  { key: 'site', alias: 'site', label: 'Site', letter: 'S', placeholder: 'e.g. Substernal center of chest' },
  { key: 'onset', alias: 'onset', label: 'Onset', letter: 'O', placeholder: 'e.g. Sudden acute onset 2h ago' },
  { key: 'character', alias: 'character', label: 'Character', letter: 'C', placeholder: 'e.g. Crushing, heavy pressure, sharp' },
  { key: 'radiation', alias: 'radiation', label: 'Radiation', letter: 'R', placeholder: 'e.g. Radiates to left arm, neck, jaw' },
  { key: 'associated', alias: 'associated_symptoms', label: 'Associated', letter: 'A', placeholder: 'e.g. Diaphoresis, dyspnea, nausea' },
  { key: 'timing', alias: 'timing', label: 'Timing', letter: 'T', placeholder: 'e.g. Constant, episodic waves' },
  { key: 'exacerbating', alias: 'exacerbating_relieving', label: 'Factors', letter: 'E', placeholder: 'e.g. Worse on exertion, rest' },
  { key: 'severity', alias: 'severity', label: 'Severity', letter: 'S', placeholder: 'e.g. 8/10 NRS scale' },
];

const LANGUAGE_NAMES = { 'en-IN': 'English', 'hi-IN': 'Hindi', 'kn-IN': 'Kannada' };
const langName = (code) => LANGUAGE_NAMES[code] || code || '—';

const STATUS_ORDER = ['confirmed', 'alert', 'unclear', 'not_reported'];
const STATUS_LABEL = { confirmed: '✓ Confirmed', alert: 'Alert', unclear: 'Unclear', not_reported: 'Not Reported' };
const STATUS_CLASS = { confirmed: 'st-confirmed', alert: 'st-alert', unclear: 'st-unclear', not_reported: 'st-none' };
const STATUS_SLOT_CLASS = { confirmed: 'is-confirmed', alert: 'is-alert', unclear: 'is-unclear', not_reported: '' };

export default function DoctorPatientView({ patientRecord, onApprove, onBack, isLoading }) {
  const visitId = patientRecord?.visit_id;
  const patient = patientRecord?.patient || {};
  const rec = patientRecord?.structured_record || {};
  const isApproved = patientRecord?.approved_by_doctor;

  const [notes, setNotes] = useState(patientRecord?.doctor_notes || '');
  const [summary, setSummary] = useState(rec.overall_summary || '');
  const [socratesMatrix, setSocratesMatrix] = useState(rec.socrates_matrix || patientRecord?.socrates_state || {});
  const [evidenceOpen, setEvidenceOpen] = useState(null); // evidence object shown in the drawer
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setNotes(patientRecord?.doctor_notes || '');
    setSummary(rec.overall_summary || '');
    setSocratesMatrix(rec.socrates_matrix || patientRecord?.socrates_state || {});
  }, [patientRecord, rec.socrates_matrix]);

  const handleSlotValueChange = (key, value) => {
    setSocratesMatrix((prev) => {
      const existing = prev[key] || {};
      const newStatus = (!existing.status || existing.status === 'not_reported') && value ? 'confirmed' : (existing.status || 'confirmed');
      return {
        ...prev,
        [key]: {
          ...existing,
          dimension: key,
          value: value,
          status: newStatus,
          source: existing.source || 'interview',
          source_icon: existing.source_icon || '🎤',
          source_details: existing.source_details || 'Verified/edited by physician'
        }
      };
    });
  };

  const handleSlotStatusToggle = (key) => {
    if (isApproved) return;
    setSocratesMatrix((prev) => {
      const existing = prev[key] || {};
      const currentIdx = STATUS_ORDER.indexOf(existing.status || 'not_reported');
      const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
      return {
        ...prev,
        [key]: { ...existing, dimension: key, status: nextStatus }
      };
    });
  };

  const handleApproveSubmit = () => {
    const updatedEdits = {
      ...rec,
      overall_summary: summary,
      socrates_matrix: socratesMatrix
    };
    onApprove(visitId, updatedEdits, notes);
    setConfirming(false);
  };

  const interviewFacts = rec.interview_facts || [];
  const documentFacts = rec.document_facts || [];
  const unclearFacts = rec.unclear_facts || [];
  const contradictions = rec.contradiction_flags || [];
  const attentions = rec.attention_flags || [];
  const hasRedFlag = patientRecord?.triage_level === 'CRITICAL_RED_FLAG' || patientRecord?.red_flag_alert;

  // A slot's evidence: prefer the matching interview fact's transcript,
  // else the slot's own source_details.
  const slotEvidence = (cfg) => {
    const slot = socratesMatrix[cfg.key] || socratesMatrix[cfg.alias] || {};
    const detail = slot.source_details || '';
    const transcriptFact = interviewFacts.find(
      (f) => f.input_mode === 'voice' && f.original_transcript &&
        slot.value && f.fact && slot.value.toLowerCase().slice(0, 24) === String(f.fact).toLowerCase().slice(0, 24)
    );
    if (transcriptFact) {
      return {
        kind: 'voice',
        title: `Voice — ${langName(transcriptFact.language)}`,
        transcript: transcriptFact.original_transcript,
        structured: transcriptFact.fact,
        confidence: transcriptFact.transcription_confidence,
        detail
      };
    }
    return {
      kind: slot.source || 'interview',
      title: slot.source === 'document' ? 'Document extraction' : 'Interview response',
      structured: slot.value,
      detail: detail || undefined
    };
  };

  return (
    <div className="doc-world" style={{ maxWidth: '1060px', margin: '2rem auto', padding: '2rem 2.2rem' }}>

      {/* ── Record header ─────────────────────────────────────────────── */}
      <button className="btn btn-outline" style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem', marginBottom: '1.1rem' }} onClick={onBack}>
        ← Back to Queue
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid var(--doc-line)', paddingBottom: '1.25rem', marginBottom: '1.4rem' }}>
        <div>
          <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.4rem' }}>Patient Record · #{visitId}</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.9rem', lineHeight: 1.2 }}>
            {patient.name || 'Unnamed patient'}
          </h2>
        </div>
        {isApproved ? (
          <span className="status-badge status-approved" style={{ fontSize: '0.95rem', padding: '0.45rem 1.1rem' }}>
            ✓ Approved & Signed
          </span>
        ) : (
          <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={isLoading}>
            Approve & Finalize →
          </button>
        )}
      </div>

      {/* ── 30-second snapshot strip ──────────────────────────────────── */}
      <div className="snap-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.4rem' }}>
        <div className="snap-cell">
          <div className="snap-cell-label">Chief complaint</div>
          <div className="snap-cell-value">{patientRecord?.chief_complaint || '—'}</div>
        </div>
        <div className="snap-cell">
          <div className="snap-cell-label">Language</div>
          <div className="snap-cell-value">{langName(patient.language)}</div>
        </div>
        <div className="snap-cell">
          <div className="snap-cell-label">Documents</div>
          <div className="snap-cell-value">{documentFacts.length} uploaded</div>
        </div>
        <div className="snap-cell">
          <div className="snap-cell-label">Triage</div>
          <div className="snap-cell-value" style={{ color: hasRedFlag ? '#E8A18B' : '#A9C4A9' }}>
            {hasRedFlag ? '🚩 Red flag' : 'No red flags'}
          </div>
        </div>
        <div className="snap-cell">
          <div className="snap-cell-label">Status</div>
          <div className="snap-cell-value" style={{ color: isApproved ? '#A9C4A9' : '#E4C27E' }}>
            {isApproved ? 'Approved' : 'Pending review'}
          </div>
        </div>
      </div>

      {/* ── Flags — terracotta/amber washes, never red panels ─────────── */}
      {hasRedFlag && (
        <div className="flag-critical" style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem', lineHeight: 1.4 }}>🚩</span>
          <div>
            <strong style={{ letterSpacing: '0.02em' }}>Requires prompt assessment.</strong>
            <div style={{ color: 'var(--doc-muted)', fontSize: '0.88rem', marginTop: '0.15rem' }}>
              {patientRecord?.triage_message || 'Automated triage detected a high-risk presentation pattern. Evaluate as soon as possible.'}
            </div>
          </div>
        </div>
      )}
      {contradictions.map((flag, idx) => (
        <div key={`c-${idx}`} className="flag-attention" style={{ display: 'flex', gap: '0.75rem', marginBottom: attentions.length - 1 === idx || attentions.length > 0 ? '0.75rem' : '1.4rem' }}>
          <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>⚠</span>
          <div><strong>Contradiction:</strong> {flag}</div>
        </div>
      ))}
      {attentions.map((flag, idx) => (
        <div key={`a-${idx}`} className="flag-attention" style={{ display: 'flex', gap: '0.75rem', marginBottom: idx === attentions.length - 1 ? '1.4rem' : '0.75rem' }}>
          <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>🚩</span>
          <div><strong>Clinical attention:</strong> {flag}</div>
        </div>
      ))}

      {/* Governance rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', color: 'var(--doc-muted)', fontSize: '0.85rem', marginBottom: '1.8rem', paddingLeft: '0.1rem' }}>
        <span aria-hidden="true">🛡</span>
        <span><strong style={{ color: 'var(--doc-text)' }}>Physician governance:</strong> AI collects and organizes evidence with sources. The physician verifies and decides.</span>
      </div>

      {/* ── SOCRATES matrix ───────────────────────────────────────────── */}
      <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.7rem' }}>SOCRATES Clinical Matrix</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', margin: 0 }}>Eight protocol dimensions</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--doc-faint)' }}>
          {isApproved ? 'Physician-approved snapshot' : 'Click a status badge to cycle it · edit values inline'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.8rem', marginBottom: '2rem' }}>
        {SOCRATES_CARD_CONFIG.map((cfg) => {
          const slot = socratesMatrix[cfg.key] || socratesMatrix[cfg.alias] || {};
          const val = slot.value || '';
          const status = slot.status || (val && val !== 'Not reported' ? 'confirmed' : 'not_reported');
          const source = slot.source || 'interview';
          const sourceIcon = slot.source_icon || (source === 'document' ? '📄' : source === 'combined' ? '🎤📄' : '🎤');
          const confidence = slot.confidence !== undefined ? Math.round(slot.confidence * 100) : null;
          const evidence = slotEvidence(cfg);
          const revised = slot.history && slot.history.length > 0;

          return (
            <div key={cfg.key} className={`soc-slot ${STATUS_SLOT_CLASS[status] || ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <span className="soc-letter">{cfg.letter}</span>
                  <strong style={{ fontSize: '0.88rem' }}>{cfg.label}</strong>
                </div>
                <button
                  type="button"
                  className={`soc-status-btn ${STATUS_CLASS[status] || 'st-none'}`}
                  onClick={() => handleSlotStatusToggle(cfg.key)}
                  disabled={isApproved}
                  title={isApproved ? undefined : 'Click to cycle: Confirmed → Alert → Unclear → Not Reported'}
                >
                  {STATUS_LABEL[status] || STATUS_LABEL.not_reported}
                </button>
              </div>

              <textarea
                rows={2}
                className="soc-textarea"
                value={val === 'Not reported' && !isApproved ? '' : val}
                placeholder={cfg.placeholder}
                onChange={(e) => handleSlotValueChange(cfg.key, e.target.value)}
                disabled={isApproved}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--doc-faint)', marginTop: 'auto', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="evidence-chip"
                  onClick={() => setEvidenceOpen(evidence)}
                  title="View the original evidence"
                >
                  {sourceIcon} {source === 'document' ? 'Document' : source === 'combined' ? 'Voice + Doc' : langName(patient.language) !== '—' ? 'Voice' : 'Source'} ↗
                </button>
                <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                  {revised && <span title={`Prior value: "${slot.history[slot.history.length - 1].previous_value}"`}>🕒 {slot.history.length}</span>}
                  {confidence !== null && (
                    <span style={{ color: confidence >= 70 ? '#A9C4A9' : '#E4C27E' }}>{confidence}%</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Editable clinical summary ─────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.5rem' }}>Structured Clinical Summary</div>
        <textarea
          className="soc-textarea"
          rows={3}
          style={{ fontSize: '0.95rem', padding: '0.7rem 0.9rem' }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={isApproved}
          placeholder="Synthesized clinical snapshot…"
        />
      </div>

      {/* ── Source-tagged evidence columns ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.6rem', marginBottom: '2rem' }}>
        <section>
          <div className="kicker" style={{ color: '#E8A18B', marginBottom: '0.7rem' }}>Interview Evidence ({interviewFacts.length})</div>
          {interviewFacts.length === 0 ? (
            <div style={{ color: 'var(--doc-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>No concrete interview facts recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {interviewFacts.map((item, idx) => (
                <div key={idx} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--doc-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className={item.input_mode === 'voice' ? 'tag-interview' : 'tag-document'} style={{ fontSize: '0.7rem' }}>
                      {item.input_mode === 'voice' ? `🎤 Voice — ${langName(item.language)}` : '✋ Patient input'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--doc-faint)', display: 'inline-flex', gap: '0.5rem' }}>
                      {item.transcription_confidence != null && <span>ASR {Math.round(item.transcription_confidence * 100)}%</span>}
                      {item.timestamp && <span>{new Date(item.timestamp).toLocaleTimeString()}</span>}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.93rem', color: 'var(--doc-text)' }}>{item.fact}</div>
                  {item.input_mode === 'voice' && item.original_transcript && (
                    <button
                      type="button"
                      className="evidence-chip"
                      style={{ marginTop: '0.45rem' }}
                      onClick={() => setEvidenceOpen({
                        kind: 'voice',
                        title: `Voice — ${langName(item.language)}`,
                        transcript: item.original_transcript,
                        structured: item.fact,
                        confidence: item.transcription_confidence
                      })}
                    >
                      View original transcript ↗
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="kicker" style={{ color: '#A9C4A9', marginBottom: '0.7rem' }}>Document Extractions ({documentFacts.length})</div>
          {documentFacts.length === 0 ? (
            <div style={{ color: 'var(--doc-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>No medical documents uploaded for this visit.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {documentFacts.map((item, idx) => (
                <div key={idx} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--doc-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', gap: '0.4rem' }}>
                    <span className="tag-document" style={{ fontSize: '0.7rem' }}>📄 Document</span>
                    {item.filename && <span style={{ fontSize: '0.75rem', color: 'var(--doc-faint)' }}>{item.filename}</span>}
                  </div>
                  <div style={{ fontSize: '0.93rem', color: 'var(--doc-text)' }}>{item.fact}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Unclear data gaps ─────────────────────────────────────────── */}
      {unclearFacts.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.7rem' }}>Data Gaps ({unclearFacts.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
            {unclearFacts.map((item, idx) => (
              <div key={idx} style={{ border: '1px dashed rgba(214, 168, 79, 0.4)', borderRadius: 'var(--radius-md)', padding: '0.85rem', fontSize: '0.88rem' }}>
                <div style={{ color: '#E4C27E', fontWeight: 600, fontSize: '0.84rem' }}>Q: {item.question}</div>
                <div style={{ color: 'var(--doc-text)', marginTop: '0.2rem' }}>Answer: <em>"{item.answer}"</em></div>
                <div style={{ color: 'var(--doc-faint)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {item.issue || 'Patient was unable to provide concrete data.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Physician notes ───────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.8rem' }}>
        <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.5rem' }}>Physician Notes & Directives</div>
        <textarea
          className="soc-textarea"
          rows={3}
          style={{ fontSize: '0.95rem', padding: '0.7rem 0.9rem' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Consultation notes, prescribing orders, follow-up instructions…"
          disabled={isApproved}
        />
      </div>

      {/* ── Footer actions ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.2rem', borderTop: '1px solid var(--doc-line)' }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Queue</button>
        {!isApproved && (
          <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={isLoading}>
            Approve & Finalize →
          </button>
        )}
      </div>

      {/* ── Evidence drawer ───────────────────────────────────────────── */}
      {evidenceOpen && (
        <>
          <div className="evidence-overlay" onClick={() => setEvidenceOpen(null)} />
          <aside className="evidence-drawer" role="dialog" aria-label="Original evidence">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div className="kicker" style={{ color: '#E8A18B' }}>Source Evidence</div>
              <button className="btn btn-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setEvidenceOpen(null)}>Close ✕</button>
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '1rem' }}>{evidenceOpen.title}</h3>

            {evidenceOpen.transcript && (
              <>
                <div className="snap-cell-label" style={{ marginBottom: '0.4rem' }}>Original statement</div>
                <blockquote className="evidence-quote" style={{ marginBottom: '1.2rem' }}>
                  "{evidenceOpen.transcript}"
                </blockquote>
              </>
            )}

            {evidenceOpen.structured && (
              <>
                <div className="snap-cell-label" style={{ marginBottom: '0.4rem' }}>Structured interpretation</div>
                <div style={{ color: 'var(--doc-text)', fontSize: '0.95rem', marginBottom: '1.2rem' }}>{evidenceOpen.structured}</div>
              </>
            )}

            {evidenceOpen.confidence != null && (
              <div style={{ marginBottom: '1.2rem' }}>
                <div className="snap-cell-label" style={{ marginBottom: '0.4rem' }}>Transcription confidence</div>
                <div style={{ color: evidenceOpen.confidence >= 0.7 ? '#A9C4A9' : '#E4C27E', fontWeight: 600 }}>
                  {Math.round(evidenceOpen.confidence * 100)}%
                </div>
              </div>
            )}

            {evidenceOpen.detail && (
              <>
                <div className="snap-cell-label" style={{ marginBottom: '0.4rem' }}>Detail</div>
                <div style={{ color: 'var(--doc-muted)', fontSize: '0.88rem' }}>{evidenceOpen.detail}</div>
              </>
            )}
          </aside>
        </>
      )}

      {/* ── Approve & Finalize confirmation ───────────────────────────── */}
      {confirming && (
        <div className="approve-scrim" onClick={() => setConfirming(false)}>
          <div className="approve-panel" role="dialog" aria-label="Confirm approval" onClick={(e) => e.stopPropagation()}>
            <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.5rem' }}>Final review</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', marginBottom: '0.9rem' }}>
              Approve & finalize this record?
            </h3>
            <p style={{ color: 'var(--doc-muted)', fontSize: '0.92rem', marginBottom: '1.2rem' }}>
              The record will be signed as physician-verified. Inline SOCRATES edits and notes made here are saved with your signature.
            </p>
            <div className="snap-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.4rem' }}>
              <div className="snap-cell">
                <div className="snap-cell-label">SOCRATES confirmed</div>
                <div className="snap-cell-value">
                  {SOCRATES_CARD_CONFIG.filter((c) => {
                    const s = socratesMatrix[c.key] || socratesMatrix[c.alias] || {};
                    return (s.status || 'not_reported') === 'confirmed' && s.value;
                  }).length} / 8 dimensions
                </div>
              </div>
              <div className="snap-cell">
                <div className="snap-cell-label">Evidence items</div>
                <div className="snap-cell-value">{interviewFacts.length + documentFacts.length} tagged</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApproveSubmit} disabled={isLoading}>
                {isLoading ? 'Signing…' : '✓ Sign & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
