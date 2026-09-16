import React, { useState } from 'react';
import { useLanguage } from '../i18n';
import JourneyProgress from './JourneyProgress';

// Complaint chips stay clinical-English on purpose: the backend tree router
// (get_tree_key) matches English keywords, and SOCRATES extraction is
// language-neutral. The patient types their complaint in whichever language
// they prefer — extraction handles it.
const QUICK_CHIPS = [
  "Chest pain radiating to left arm",
  "High fever with chills for 3 days",
  "Persistent dry cough for 2 weeks",
  "Severe headache and dizziness",
  "Abdominal pain and nausea"
];

export default function ChiefComplaint({ onStartInterview, isLoading }) {
  const { t } = useLanguage();
  const [patientName, setPatientName] = useState('');
  const [complaint, setComplaint] = useState('');
  const [mode, setMode] = useState('type'); // 'type' | 'choose'

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!complaint.trim()) return;
    onStartInterview(complaint, patientName);
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '2.5rem auto', padding: '0 1.5rem', display: 'flex', gap: '3rem' }}>
      <div style={{ paddingTop: '0.5rem' }}>
        <JourneyProgress
          steps={[
            { key: 'complaint', label: t('journey.complaint') },
            { key: 'interview', label: t('journey.interview') },
            { key: 'records', label: t('journey.records') },
            { key: 'review', label: t('journey.review') },
            { key: 'doctor', label: t('journey.doctor') }
          ]}
          currentKey="complaint"
        />
      </div>

      <div style={{ flex: 1, maxWidth: '640px' }}>
        <div className="question-index">{t('complaint.kicker')}</div>
        <h1 className="question-text" style={{ marginBottom: '0.6rem' }}>
          {t('complaint.title')}
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '1.02rem', marginBottom: '2rem', maxWidth: '52ch' }}>
          {t('complaint.subtitle')}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Interaction paths — voice primary, choose secondary, type as base */}
          <div style={{ display: 'flex', gap: '1.6rem', marginBottom: '1.6rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{
              flex: '1 1 200px',
              border: '2px solid var(--terracotta)',
              borderRadius: 'var(--radius-md)',
              padding: '1.1rem 1.2rem',
              background: 'var(--terracotta-wash)'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🎙</div>
              <div style={{ fontWeight: 700, color: 'var(--terracotta-deep)' }}>{t('complaint.pathVoice')}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: '0.15rem' }}>
                {t('complaint.pathVoiceHint')}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === 'choose' ? 'type' : 'choose')}
              style={{
                flex: '1 1 150px',
                border: '1.5px solid var(--line-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '1.1rem 1.2rem',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-body)'
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>✋</div>
              <div style={{ fontWeight: 700, color: 'var(--indigo-800)' }}>{t('complaint.pathChoose')}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: '0.15rem' }}>
                {t('complaint.pathChooseHint')}
              </div>
            </button>
          </div>

          {mode === 'choose' && (
            <div className="form-group">
              <label className="form-label">{t('complaint.quick')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {QUICK_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setComplaint(chip)}
                    className="btn btn-outline"
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('complaint.label')}</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder={t('complaint.placeholder')}
              required
              style={{ fontSize: '1.05rem' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 500 }}>{t('complaint.name')}</label>
            <input
              type="text"
              className="form-input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder={t('complaint.namePlaceholder')}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" type="submit" disabled={isLoading || !complaint.trim()}
              style={{ padding: '0.9rem 1.8rem' }}>
              {isLoading ? t('complaint.starting') : t('complaint.start')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
