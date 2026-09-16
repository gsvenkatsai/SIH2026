import React from 'react';
import { useLanguage } from '../i18n';

export default function RoleSelect({ onSelectRole }) {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: '850px', margin: '3rem auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          {t('welcome.title')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem' }}>
          {t('welcome.subtitle')}
        </p>
      </div>

      <div className="role-grid">
        <div className="role-card" onClick={() => onSelectRole('patient')}>
          <div className="role-icon">🏥</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            {t('welcome.patient')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {t('welcome.patientDesc')}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
            {t('welcome.startPatient')}
          </button>
        </div>

        <div className="role-card" onClick={() => onSelectRole('doctor')}>
          <div className="role-icon">👨‍⚕️</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            {t('welcome.doctor')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {t('welcome.doctorDesc')}
          </p>
          <button className="btn btn-cyan" style={{ marginTop: '1.5rem', width: '100%' }}>
            {t('welcome.openDoctor')}
          </button>
        </div>
      </div>
    </div>
  );
}
