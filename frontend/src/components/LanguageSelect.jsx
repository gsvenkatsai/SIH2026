import React from 'react';
import { useLanguage, LANGUAGE_LIST } from '../i18n';

export default function LanguageSelect({ selectedLanguage, onSelectLanguage, onNext }) {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: '680px', margin: '2rem auto' }}>
      <div className="glass-card">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.5rem', textAlign: 'center' }}>
          🌐 {t('lang.title')} / भाषा चुनें / ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ
        </h2>
        {/* Trilingual by construction: this screen appears BEFORE any language
            is known, so every static line must be readable in all three. */}
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
          Choose your preferred language · अपनी भाषा चुनें · ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {LANGUAGE_LIST.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => onSelectLanguage(lang.code)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectLanguage(lang.code)}
                style={{
                  padding: '1.4rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '1.9rem', marginBottom: '0.3rem' }}>{lang.flag}</div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: isSelected ? '#a5b4fc' : 'var(--text-main)' }}>
                  {lang.native}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lang.name}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onNext}>
            ಮುಂದುವರಿಯಿರಿ · आगे बढ़ें · Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
