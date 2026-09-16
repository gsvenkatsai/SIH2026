import React from 'react';
import { useLanguage } from '../i18n';

export default function PatientSummary({ finalRecord, onComplete, onReturnToHome }) {
  const { t } = useLanguage();
  const rec = finalRecord?.structured_record || {};
  const interviewFacts = rec.interview_facts || [];
  const documentFacts = rec.document_facts || [];
  const unclearFacts = rec.unclear_facts || [];

  return (
    <div style={{ maxWidth: '860px', margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Completion header — editorial, with brand tagline */}
      <div style={{ textAlign: 'center', marginBottom: '2.2rem' }}>
        <div className="kicker" style={{ marginBottom: '0.7rem' }}>{t('summary.kicker')}</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.9rem, 4vw, 2.6rem)',
          fontWeight: 700,
          color: 'var(--indigo-800)',
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem'
        }}>
          {t('summary.title')}
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '1.02rem', maxWidth: '56ch', margin: '0 auto' }}>
          {t('summary.subtitle')}
        </p>
        <div style={{ marginTop: '0.9rem', fontSize: '0.85rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
          {t('brand.tagline')}
        </div>
      </div>

      {/* Record body — tactile paper panel */}
      <div className="glass-card">

        {/* Chief complaint — editorial lead statement */}
        <div style={{
          borderLeft: '4px solid var(--indigo-800)',
          paddingLeft: '1.4rem',
          marginBottom: '2.2rem'
        }}>
          <div className="kicker" style={{ color: 'var(--indigo-800)', marginBottom: '0.3rem' }}>
            {t('summary.chiefComplaint')}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>
            {rec.chief_complaint || 'General Consultation'}
          </div>
        </div>

        {/* Facts & documents — editorial two-column with source badges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px', gap: '0 2rem', marginBottom: '2rem' }}>
          <div style={{ borderTop: '1px solid var(--line)', gridColumn: '1 / -1' }} />

          {/* Interview Facts */}
          <div style={{ paddingTop: '1.2rem' }}>
            <div className="kicker" style={{ marginBottom: '0.9rem' }}>
              {t('summary.interviewFacts', { n: interviewFacts.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {interviewFacts.length === 0 ? (
                <div style={{ color: 'var(--ink-faint)', fontSize: '0.9rem' }}>{t('summary.noInterviewFacts')}</div>
              ) : (
                interviewFacts.map((item, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="tag-interview" style={{ fontSize: '0.7rem' }}>🎙</span>
                      <span style={{ color: 'var(--ink)', fontSize: '0.94rem' }}>{item.fact}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Document Facts */}
          <div style={{ paddingTop: '1.2rem', borderLeft: '1px solid var(--line)', paddingLeft: '2rem' }}>
            <div className="kicker" style={{ marginBottom: '0.9rem', color: '#4E6B4E' }}>
              {t('summary.documentEvidence', { n: documentFacts.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {documentFacts.length === 0 ? (
                <div style={{ color: 'var(--ink-faint)', fontSize: '0.9rem' }}>{t('summary.noDocFacts')}</div>
              ) : (
                documentFacts.map((item, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="tag-document" style={{ fontSize: '0.7rem' }}>📄</span>
                      <span style={{ color: 'var(--ink)', fontSize: '0.94rem' }}>{item.fact}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Incomplete / unclear gaps — warm amber wash, calm wording */}
        {unclearFacts.length > 0 && (
          <div className="flag-attention" style={{ marginBottom: '2rem' }}>
            <div className="kicker" style={{ color: '#7A5F1E', marginBottom: '0.7rem' }}>
              {t('summary.unclear', { n: unclearFacts.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {unclearFacts.map((item, idx) => (
                <div key={idx} style={{ padding: '0.5rem 0', borderBottom: '1px dashed rgba(214, 168, 79, 0.4)', fontSize: '0.9rem' }}>
                  <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: '0.86rem' }}>
                    Q: {item.question}
                  </div>
                  <div style={{ color: 'var(--ink-soft)', marginTop: '0.15rem' }}>
                    {t('summary.givenAnswer')} <em>"{item.answer}"</em>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety note — quiet indigo band */}
        <div style={{
          background: 'rgba(24, 35, 63, 0.05)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.9rem 1.2rem',
          fontSize: '0.88rem',
          color: 'var(--ink-soft)',
          marginBottom: '1.8rem',
          textAlign: 'center'
        }}>
          🛡️ <strong style={{ color: 'var(--indigo-800)' }}>{t('summary.safety')}</strong> {t('summary.safetyText')}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={onComplete}>
            {t('summary.handover')}
          </button>
          <button className="btn btn-outline" onClick={onReturnToHome}>
            {t('summary.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
