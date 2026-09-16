import React, { useState } from 'react';
import { useLanguage } from '../i18n';

export default function DocumentUpload({ visitId, onUpload, uploadedDocs, onNext, isLoading }) {
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
    <div style={{ maxWidth: '780px', margin: '2rem auto' }}>
      <div className="glass-card">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>
          {t('upload.title')}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {t('upload.subtitle')}
        </p>

        {/* Upload Form Box */}
        <form onSubmit={handleUploadSubmit} style={{ marginBottom: '2rem' }}>
          <div
            style={{
              border: '2px dashed var(--border-active)',
              borderRadius: 'var(--radius-lg)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              background: 'rgba(99, 102, 241, 0.04)',
              cursor: 'pointer',
              marginBottom: '1rem',
              transition: 'all 0.2s ease'
            }}
            onClick={() => document.getElementById('file-upload-input').click()}
          >
            <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>📑</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#f1f5f9' }}>
              {selectedFile ? selectedFile.name : t('upload.dropzone')}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
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

        {/* Extracted Documents Display */}
        {uploadedDocs.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
              {t('upload.extracted', { n: uploadedDocs.length })}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {uploadedDocs.map((doc, idx) => {
                const ext = doc.extracted_json || {};
                return (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="tag-document">📄 Document</span> {doc.filename}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                        {t('upload.confidence', { pct: Math.round((doc.confidence || 0.9) * 100) })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-muted)' }}>{t('upload.diagnoses')}</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem', color: '#cbd5e1' }}>
                          {(ext.diagnoses || ['None']).map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text-muted)' }}>{t('upload.medications')}</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem', color: '#cbd5e1' }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-subtle)', alignSelf: 'center' }}>
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
