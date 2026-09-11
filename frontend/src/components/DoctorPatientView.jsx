import React, { useState, useEffect } from 'react';

export default function DoctorPatientView({ patientRecord, onApprove, onBack, isLoading }) {
  const visitId = patientRecord?.visit_id;
  const patient = patientRecord?.patient || {};
  const rec = patientRecord?.structured_record || {};
  const isApproved = patientRecord?.approved_by_doctor;

  const [notes, setNotes] = useState(patientRecord?.doctor_notes || '');
  const [summary, setSummary] = useState(rec.overall_summary || '');

  useEffect(() => {
    setNotes(patientRecord?.doctor_notes || '');
    setSummary(rec.overall_summary || '');
  }, [patientRecord]);

  const handleApproveSubmit = () => {
    const updatedEdits = {
      ...rec,
      overall_summary: summary
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
