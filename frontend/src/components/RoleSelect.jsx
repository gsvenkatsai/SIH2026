import React from 'react';
import BrandMark from './BrandMark';
import { useLanguage } from '../i18n';

/**
 * Welcome — asymmetric editorial opening.
 * LEFT: brand, headline, supporting line, CTA.
 * RIGHT: a calm custom healthcare illustration (inline SVG — patient form,
 * leaf, pulse line) so no stock-AI imagery is introduced.
 */
export default function RoleSelect({ onSelectRole }) {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: '1080px', margin: '2.5rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '3rem', alignItems: 'center' }}>
        {/* LEFT — the story */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--indigo-800)', marginBottom: '2.2rem' }}>
            <BrandMark size={34} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.3rem' }}>MediKiosk</span>
            <span className="brand-tagline">{t('brand.tagline')}</span>
          </div>

          <div className="kicker" style={{ marginBottom: '0.9rem' }}>{t('welcome.kicker')}</div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(2.4rem, 5vw, 3.4rem)',
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            color: 'var(--indigo-800)',
            marginBottom: '1.1rem'
          }}>
            {t('welcome.headline')}
          </h1>
          <p style={{ fontSize: '1.12rem', color: 'var(--ink-soft)', maxWidth: '46ch', lineHeight: 1.65, marginBottom: '2.2rem' }}>
            {t('welcome.sub')}
          </p>

          <button
            className="btn btn-primary"
            style={{ padding: '0.95rem 1.9rem', fontSize: '1.05rem' }}
            onClick={() => onSelectRole('patient')}
          >
            {t('welcome.cta')} →
          </button>

          <div style={{ marginTop: '2.6rem', borderTop: '1px solid var(--line)', paddingTop: '1.2rem' }}>
            <button
              className="btn btn-outline"
              onClick={() => onSelectRole('doctor')}
              style={{ fontSize: '0.88rem' }}
            >
              {t('welcome.doctorLink')}
            </button>
          </div>
        </div>

        {/* RIGHT — calm illustration: a patient record sheet with pulse & leaf */}
        <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="340" height="400" viewBox="0 0 340 400" fill="none">
            {/* Botanical stem behind */}
            <path d="M60 380 C 90 300, 55 250, 95 190 C 125 145, 110 110, 130 70"
              stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M95 250 C 80 235, 78 215, 88 200 C 102 212, 106 232, 95 250Z" fill="var(--sage)" opacity="0.25" />
            <path d="M118 150 C 103 135, 101 115, 111 100 C 125 112, 129 132, 118 150Z" fill="var(--sage)" opacity="0.32" />

            {/* Record sheet */}
            <rect x="118" y="48" width="190" height="252" rx="8" fill="var(--paper)" stroke="var(--line-strong)" strokeWidth="1.5" />
            <rect x="118" y="48" width="190" height="40" rx="8" fill="var(--indigo-800)" />
            <rect x="118" y="78" width="190" height="10" fill="var(--indigo-800)" />
            <text x="136" y="74" fontFamily="Outfit, sans-serif" fontWeight="700" fontSize="13" fill="#F2EDE2" letterSpacing="2">HEALTH RECORD</text>

            {/* pulse line */}
            <path d="M138 128 h22 l7 -14 10 26 8 -18 6 6 h22" stroke="var(--terracotta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* data rows */}
            <rect x="138" y="160" width="120" height="7" rx="3.5" fill="var(--line-strong)" />
            <rect x="138" y="180" width="150" height="7" rx="3.5" fill="var(--line)" />
            <rect x="138" y="200" width="98" height="7" rx="3.5" fill="var(--line)" />
            <rect x="138" y="220" width="132" height="7" rx="3.5" fill="var(--line)" />

            {/* voice badge on sheet */}
            <circle cx="284" cy="196" r="20" fill="var(--terracotta-wash)" stroke="var(--terracotta)" strokeWidth="1.5" />
            <rect x="280" y="188" width="8" height="16" rx="4" fill="var(--terracotta)" />
            <path d="M277 194 a7 7 0 0 0 14 0" stroke="var(--terracotta)" strokeWidth="1.6" fill="none" strokeLinecap="round" />

            {/* saffron seal */}
            <circle cx="308" cy="280" r="17" fill="var(--saffron-wash)" stroke="var(--saffron)" strokeWidth="1.5" />
            <path d="M300 280 l5 5 11 -11" stroke="var(--saffron)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* grounding line */}
            <ellipse cx="215" cy="330" rx="130" ry="9" fill="rgba(23,32,51,0.06)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
