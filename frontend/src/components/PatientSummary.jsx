import React from 'react';

export default function PatientSummary({ finalRecord, onComplete, onReturnToHome }) {
  const rec = finalRecord?.structured_record || {};
  const interviewFacts = rec.interview_facts || [];
  const documentFacts = rec.document_facts || [];
  const unclearFacts = rec.unclear_facts || [];

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <div className="glass-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', marginBottom: '0.5rem' }}>
            Intake Completed & Source-Tagged!
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Your history and uploaded documents have been compiled into a structured clinical snapshot for your doctor.
          </p>
        </div>

        {/* Chief Complaint Banner */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-indigo)', textTransform: 'uppercase' }}>
            CHIEF COMPLAINT
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>
            {rec.chief_complaint || 'General Consultation'}
          </div>
        </div>

        {/* Facts & Gaps Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Interview Facts */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🎤 Interview Facts ({interviewFacts.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {interviewFacts.length === 0 ? (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>No concrete interview facts logged.</div>
              ) : (
                interviewFacts.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem'
                  }}>
                    <span className="tag-interview">🎤 Interview</span>
                    <div style={{ color: '#f1f5f9', marginTop: '0.3rem' }}>{item.fact}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Document Facts */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '0.75rem', color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📄 Document Evidence ({documentFacts.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {documentFacts.length === 0 ? (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>No document extractions logged.</div>
              ) : (
                documentFacts.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem'
                  }}>
                    <span className="tag-document">📄 Document</span>
                    <div style={{ color: '#f1f5f9', marginTop: '0.3rem' }}>{item.fact}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Separate Incomplete / Unclear Responses Section */}
        {unclearFacts.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.75rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ❓ Incomplete / Unclear Data Gaps ({unclearFacts.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {unclearFacts.map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px dashed rgba(245, 158, 11, 0.4)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem'
                }}>
                  <div style={{ color: '#fcd34d', fontWeight: 600, fontSize: '0.82rem' }}>
                    Q: {item.question}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Given Answer: <em>"{item.answer}"</em>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
                    ⚠️ {item.issue || 'Unclear or incomplete response — doctor review needed.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Rule Note */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          🛡️ <strong>Safety Guarantee:</strong> AI collects and organizes facts. Nothing reaches your permanent record without explicit physician review and approval.
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={onComplete}>
            Handover to Doctor Portal →
          </button>
          <button className="btn btn-outline" onClick={onReturnToHome}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
