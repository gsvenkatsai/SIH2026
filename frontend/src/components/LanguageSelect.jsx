import React from 'react';
import { useLanguage, LANGUAGE_LIST } from '../i18n';

/**
 * Language selection — typographic composition, all three scripts equal.
 * Nothing here assumes English is the default visual choice.
 */
const SUBTITLES = {
  'en-IN': "Let's begin",
  'hi-IN': 'आइए शुरू करें',
  'kn-IN': 'ಪ್ರಾರಂಭಿಸೋಣ',
};

const GLYPHS = { 'en-IN': 'En', 'hi-IN': 'हि', 'kn-IN': 'ಕ' };

export default function LanguageSelect({ selectedLanguage, onSelectLanguage, onNext }) {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: '860px', margin: '3rem auto', padding: '0 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div className="kicker" style={{ marginBottom: '0.8rem' }}>मेडीकियोस्क · ಮೆಡಿಕಿಯೋಸ್ಕ್</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.9rem, 4vw, 2.6rem)',
          fontWeight: 700,
          color: 'var(--indigo-800)',
          letterSpacing: '-0.02em'
        }}>
          {t('lang.howContinue')}
        </h1>
      </div>

      <div className="lang-options" role="radiogroup" aria-label="Language / भाषा / ಭಾಷೆ">
        {LANGUAGE_LIST.map((lang) => {
          const selected = selectedLanguage === lang.code;
          return (
            <div
              key={lang.code}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              className={`lang-option ${selected ? 'selected' : ''}`}
              onClick={() => onSelectLanguage(lang.code)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectLanguage(lang.code)}
            >
              <span className="lang-check">✓</span>
              <div className="lang-glyph">{GLYPHS[lang.code]}</div>
              <div className="lang-native">{lang.native}</div>
              <div className="lang-sub">{SUBTITLES[lang.code]}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.8rem' }}>
        <button className="btn btn-primary" style={{ padding: '0.9rem 2rem' }} onClick={onNext}>
          ಮುಂದುವರಿಯಿರಿ · आगे बढ़ें · Continue →
        </button>
      </div>
    </div>
  );
}
