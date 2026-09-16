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

export default function DoctorPatientView({ patientRecord, onApprove, onBack, isLoading }) {
  const visitId = patientRecord?.visit_id;
  const patient = patientRecord?.patient || {};
  const rec = patientRecord?.structured_record || {};
  const isApproved = patientRecord?.approved_by_doctor;

  const [notes, setNotes] = useState(patientRecord?.doctor_notes || '');
  const [summary, setSummary] = useState(rec.overall_summary || '');
  const [socratesMatrix, setSocratesMatrix] = useState(rec.socrates_matrix || patientRecord?.socrates_state || {});

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
      const statusOrder = ['confirmed', 'alert', 'unclear', 'not_reported'];
      const currentIdx = statusOrder.indexOf(existing.status || 'not_reported');
      const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
      return {
        ...prev,
        [key]: {
          ...existing,
          dimension: key,
          status: nextStatus
        }
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
  };

  const interviewFacts = rec.interview_facts || [];
  const documentFacts = rec.document_facts || [];
  const unclearFacts = rec.unclear_facts || [];
  const contradictions = rec.contradiction_flags || [];
  const attentions = rec.attention_flags || [];

  return (
    <div style={{ maxWidth: '1000px', margin: '2rem auto' }}>
      <div className="glass-card">
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', pb: '1rem' }}>
          <div>
            <button className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem', marginBottom: '0.5rem' }} onClick={onBack}>
              ← Back to Queue
            </button>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>
              Patient Record #{visitId} — {patient.name}
            </h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
              <span>Language: <strong>{patient.language}</strong></span>
              <span>Chief Complaint: <strong>{patientRecord?.chief_complaint}</strong></span>
              <span>Status: <strong style={{ color: isApproved ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{isApproved ? 'Approved' : 'Pending Review'}</strong></span>
            </div>
          </div>

          <div>
            {isApproved ? (
              <span className="status-badge status-approved" style={{ fontSize: '1rem', padding: '0.5rem 1.25rem' }}>
                ✓ Record Approved
              </span>
            ) : (
              <button className="btn btn-primary" onClick={handleApproveSubmit} disabled={isLoading}>
                {isLoading ? 'Approving...' : '✓ Approve Record'}
              </button>
            )}
          </div>
        </div>

        {/* Priority Red Flag Alert Banner for Doctor */}
        {(patientRecord?.triage_level === 'CRITICAL_RED_FLAG' || patientRecord?.red_flag_alert) && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.35))',
            border: '2px solid rgba(239, 68, 68, 0.8)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span style={{ fontSize: '2rem' }}>🚨</span>
            <div>
              <strong style={{ color: '#fee2e2', fontSize: '1.05rem', letterSpacing: '0.3px' }}>
                PRIORITY RED-FLAG PATIENT: Suspected Acute Coronary Syndrome (ACS)
              </strong>
              <div style={{ color: '#fecaca', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                {patientRecord?.triage_message || 'Automated triage detected high-risk ischemic chest pain presentation. Please evaluate immediately.'}
              </div>
            </div>
          </div>
        )}

        {/* Safety Banner */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1.25rem',
          fontSize: '0.9rem',
          color: '#a5b4fc',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span>🛡️</span>
          <div>
            <strong>Physician Governance Rule:</strong> AI collects and organizes facts with source evidence tags. Doctor verifies and decides.
          </div>
        </div>

        {/* Contradiction & Attention Flags */}
        {(contradictions.length > 0 || attentions.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {contradictions.map((flag, idx) => (
              <div key={idx} className="badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <strong>Contradiction Flag:</strong> {flag}
                </div>
              </div>
            ))}

            {attentions.map((flag, idx) => (
              <div key={idx} className="badge-alert" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🚨</span>
                <div>
                  <strong>Clinical Attention Flag:</strong> {flag}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SOCRATES Pain & Symptom Matrix (Interactive 8-Dimension Grid) */}
        <div style={{
          marginBottom: '2rem',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span>🩺</span> SOCRATES Clinical Matrix (8 Protocol Dimensions)
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {!isApproved ? 'Click badge to toggle status • Edit slot values inline before sign-off' : 'Physician-approved protocol snapshot'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.85rem'
          }}>
            {SOCRATES_CARD_CONFIG.map((cfg) => {
              const slot = socratesMatrix[cfg.key] || socratesMatrix[cfg.alias] || {};
              const val = slot.value || '';
              const status = slot.status || (val && val !== 'Not reported' ? 'confirmed' : 'not_reported');
              const source = slot.source || 'interview';
              const sourceIcon = slot.source_icon || (source === 'document' ? '📄' : source === 'combined' ? '🎤 📄' : '🎤');
              const confidence = slot.confidence !== undefined ? Math.round(slot.confidence * 100) : null;
              const sourceDetails = slot.source_details || '';

              let borderColor = 'rgba(255, 255, 255, 0.08)';
              let cardBg = 'rgba(15, 23, 42, 0.6)';
              let badgeBg = 'rgba(148, 163, 184, 0.12)';
              let badgeColor = '#94a3b8';
              let badgeText = 'Not Reported';

              if (status === 'alert') {
                borderColor = 'rgba(239, 68, 68, 0.5)';
                cardBg = 'rgba(239, 68, 68, 0.08)';
                badgeBg = 'rgba(239, 68, 68, 0.22)';
                badgeColor = '#fca5a5';
                badgeText = '🚨 Alert';
              } else if (status === 'confirmed') {
                borderColor = 'rgba(16, 185, 129, 0.35)';
                cardBg = 'rgba(16, 185, 129, 0.05)';
                badgeBg = 'rgba(16, 185, 129, 0.2)';
                badgeColor = '#6ee7b7';
                badgeText = '✓ Confirmed';
              } else if (status === 'unclear') {
                borderColor = 'rgba(245, 158, 11, 0.35)';
                cardBg = 'rgba(245, 158, 11, 0.06)';
                badgeBg = 'rgba(245, 158, 11, 0.2)';
                badgeColor = '#fcd34d';
                badgeText = '⚠️ Unclear';
              }

              return (
                <div
                  key={cfg.key}
                  style={{
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: status === 'alert' ? '0 0 12px rgba(239, 68, 68, 0.15)' : 'none'
                  }}
                >
                  {/* Top Bar: Letter, Name, Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{
                        background: 'rgba(99, 102, 241, 0.25)',
                        color: '#a5b4fc',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px'
                      }}>
                        {cfg.letter}
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>
                        {cfg.label}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSlotStatusToggle(cfg.key)}
                      title={!isApproved ? 'Click to toggle status (Confirmed → Alert → Unclear → Not Reported)' : undefined}
                      style={{
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '999px',
                        padding: '0.15rem 0.5rem',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        cursor: !isApproved ? 'pointer' : 'default',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {badgeText}
                    </button>
                  </div>

                  {/* Slot Value (Editable by Doctor) */}
                  <textarea
                    rows={2}
                    value={val === 'Not reported' && !isApproved ? '' : val}
                    placeholder={cfg.placeholder}
                    onChange={(e) => handleSlotValueChange(cfg.key, e.target.value)}
                    disabled={isApproved}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      padding: '0.4rem 0.55rem',
                      color: val && val !== 'Not reported' ? '#f8fafc' : 'var(--text-muted)',
                      fontSize: '0.85rem',
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />

                  {/* Revision History Badge */}
                  {slot.history && slot.history.length > 0 && (
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: '#93c5fd',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title={`Prior value: "${slot.history[slot.history.length - 1].previous_value}"`}
                    >
                      <span>🕒</span>
                      <span>Revised ({slot.history.length})</span>
                    </div>
                  )}

                  {/* Footer: Source & Confidence */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 'auto' }}>
                    <span title={sourceDetails || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span>{sourceIcon}</span>
                      <span style={{ textTransform: 'capitalize' }}>{source}</span>
                    </span>
                    {confidence !== null && (
                      <span style={{ color: confidence >= 70 ? '#6ee7b7' : '#fcd34d' }}>
                        {confidence}% conf
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clinical Snapshot Summary (Editable by Doctor) */}
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
            Structured Clinical Summary (Editable by Doctor)
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isApproved}
          />
        </div>

        {/* Source-Tagged Evidence Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Interview Facts */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '0.75rem', color: '#a5b4fc' }}>
              🎤 Adaptive Interview Evidence ({interviewFacts.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {interviewFacts.length === 0 ? (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No concrete interview facts.
                </div>
              ) : (
                interviewFacts.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.9rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span className="tag-interview">🎤 Interview</span>
                      {item.timestamp && <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{new Date(item.timestamp).toLocaleTimeString()}</span>}
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>{item.fact}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Document Facts */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '0.75rem', color: '#67e8f9' }}>
              📄 Document OCR Extractions ({documentFacts.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {documentFacts.length === 0 ? (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No medical documents uploaded for this visit.
                </div>
              ) : (
                documentFacts.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.9rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span className="tag-document">📄 Document</span>
                      {item.filename && <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{item.filename}</span>}
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>{item.fact}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Incomplete / Unclear Section for Doctor */}
        {unclearFacts.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '0.75rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ❓ Incomplete / Unclear Patient Data Gaps ({unclearFacts.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {unclearFacts.map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px dashed rgba(245, 158, 11, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  fontSize: '0.88rem'
                }}>
                  <div style={{ color: '#fcd34d', fontWeight: 600, fontSize: '0.85rem' }}>
                    Q: {item.question}
                  </div>
                  <div style={{ color: '#e2e8f0', marginTop: '0.2rem' }}>
                    Answer: <em>"{item.answer}"</em>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
                    ⚠️ {item.issue || 'Patient was unable to provide concrete data.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Physician Notes */}
        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
            Physician Clinical Notes & Directives
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add consultation notes, prescribing orders, or follow-up instructions..."
            disabled={isApproved}
          />
        </div>

        {/* Action Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-outline" onClick={onBack}>
            ← Back to Queue
          </button>

          {!isApproved && (
            <button className="btn btn-primary" onClick={handleApproveSubmit} disabled={isLoading}>
              {isLoading ? 'Processing Approval...' : '✓ Approve & Sign Record'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
