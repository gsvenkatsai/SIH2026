import React from 'react';

const LANGUAGES = [
  { code: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ', icon: '🇮🇳' },
  { code: 'Hindi', label: 'Hindi', native: 'हिन्दी', icon: '🇮🇳' },
  { code: 'English', label: 'English', native: 'English', icon: '🇬🇧' }
];

export default function LanguageSelect({ selectedLanguage, onSelectLanguage, onNext }) {
  return (
    <div style={{ maxWidth: '680px', margin: '2rem auto' }}>
      <div className="glass-card">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.5rem', textAlign: 'center' }}>
          🌐 Select Your Language / भाषा चुनें
        </h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
          Choose your preferred language for the interactive kiosk intake interview.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => onSelectLanguage(lang.code)}
                style={{
                  padding: '1.2rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{lang.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', color: isSelected ? '#a5b4fc' : 'var(--text-main)' }}>
                  {lang.label}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lang.native}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onNext}>
            Continue to Chief Complaint →
          </button>
        </div>
      </div>
    </div>
  );
}
