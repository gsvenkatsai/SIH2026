import React, { useState } from 'react';
import { useLanguage } from '../i18n';
import JourneyProgress from './JourneyProgress';

const JOURNEY_STEPS = [
  { key: 'complaint', label: 'journey.complaint' },
  { key: 'interview', label: 'journey.interview' },
  { key: 'records', label: 'journey.records' },
  { key: 'review', label: 'journey.review' },
  { key: 'doctor', label: 'journey.doctor' }
];

export default function DocumentUpload({ onUpload, uploadedDocs, onNext, isLoading }) {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    onUpload(selectedFile);
    setSelectedFile(null);
  };

  return (
    <div style={{ maxWidth: '860px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', gap: '3rem' }}>
      <div style={{ paddingTop: '0.5rem' }}>
        <JourneyProgress
          steps={JOURNEY_STEPS.map((s) => ({ ...s, label: t(s.label) }))}
          currentKey="records"
        />
      </div>

      <div style={{ flex: 1, maxWidth: '620px' }}>
      <div className="question-index">{t('journey.records')}</div>
      <h1 className="question-text" style={{ marginBottom: '0.6rem' }}>
        {t('upload.heading')}
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '1.02rem', marginBottom: '1.8rem', maxWidth: '52ch' }}>
        {t('upload.subtitle')}
      </p>

      {/* Document type strip — a patient's file, not a SaaS uploader */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.4rem' }}>
        {['📜 ' + t('upload.typePrescription'), '🧪 ' + t('upload.typeLab'), '🏥 ' + t('upload.typeDischarge'), '🗂 ' + t('upload.typeOther')].map((label) => (
          <span key={label} style={{
            fontSize: '0.84rem', fontWeight: 600, color: 'var(--indigo-800)',
            border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-full)',
            padding: '0.35rem 0.85rem', background: 'var(--paper)'
          }}>{label}</span>
        ))}
      </div>

        {/* Upload area — tactile file folder, not a dashed SaaS box */}
        <form onSubmit={handleUploadSubmit} style={{ marginBottom: '2rem' }}>
          <div
            style={{
              border: '1.5px solid var(--line-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '2.2rem 1.5rem',
              textAlign: 'center',
              background: 'var(--paper)',
              cursor: 'pointer',
              marginBottom: '1rem',
              transition: 'border-color 0.2s ease, background 0.2s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => document.getElementById('file-upload-input').click()}
          >
            {/* folder tab accent */}
            <div style={{ position: 'absolute', top: 0, left: '1.5rem', width: '90px', height: '8px', background: 'var(--saffron)', borderRadius: '0 0 6px 6px' }} />
            <div style={{ fontSize: '2.4rem', marginBottom: '0.4rem' }}>🗂️</div>
            <div style={{ fontWeight: 600, fontSize: '1.08rem', color: 'var(--ink)' }}>
              {selectedFile ? selectedFile.name : t('upload.dropzone')}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-faint)', marginTop: '0.25rem' }}>
              {t('upload.formats')}
            </p>
            <input
              id="file-upload-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            {selectedFile && (
              <button className="btn btn-primary" type="submit" disabled={isLoading}>
                {isLoading ? t('upload.extracting') : t('upload.uploadExtract')}
              </button>
            )}
          </div>
        </form>

        {/* Extracted Documents — split preview: file left, facts right */}
        {uploadedDocs.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div className="kicker" style={{ marginBottom: '1rem' }}>
              {t('upload.extracted', { n: uploadedDocs.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {uploadedDocs.map((doc, idx) => {
                const ext = doc.extracted_json || {};
                return (
                  <div key={idx} style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--paper)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.1rem', borderBottom: '1px solid var(--line)', background: 'var(--ivory)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem' }}>
                        <span className="tag-document">📄</span> {doc.filename}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#4E6B4E', background: 'var(--sage-wash)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)' }}>
                        {t('upload.confidence', { pct: Math.round((doc.confidence || 0.9) * 100) })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem 1.1rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('upload.diagnoses')}</strong>
                        <ul style={{ paddingLeft: '1.2rem', color: 'var(--ink)' }}>
                          {(ext.diagnoses || ['None']).map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('upload.medications')}</strong>
                        <ul style={{ paddingLeft: '1.2rem', color: 'var(--ink)' }}>
                          {(ext.medications || []).map((m, i) => (
                            <li key={i}>{typeof m === 'object' ? `${m.name} (${m.dosage})` : m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.2rem', paddingTop: '1.4rem', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--ink-faint)' }}>
            {uploadedDocs.length === 0 ? t('upload.noneYet') : t('upload.count', { n: uploadedDocs.length })}
          </span>

          <button className="btn btn-primary" onClick={onNext}>
            {t('upload.proceed')}
          </button>
        </div>
      </div>
    </div>
  );
}
