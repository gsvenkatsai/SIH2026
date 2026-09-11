import React from 'react';

export default function RoleSelect({ onSelectRole }) {
  return (
    <div style={{ maxWidth: '850px', margin: '3rem auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Welcome to MediKiosk
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem' }}>
          Kiosk-based patient history taking & clinical verification platform. Please select your role to proceed.
        </p>
      </div>

      <div className="role-grid">
        <div className="role-card" onClick={() => onSelectRole('patient')}>
          <div className="role-icon">🏥</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Patient Kiosk
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Answer adaptive intake questions and upload existing medical documents prior to your consultation.
          </p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
            Start Patient Intake →
          </button>
        </div>

        <div className="role-card" onClick={() => onSelectRole('doctor')}>
          <div className="role-icon">👨‍⚕️</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Doctor Portal
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Review source-tagged patient records, inspect contradiction flags, edit, and approve consultations.
          </p>
          <button className="btn btn-cyan" style={{ marginTop: '1.5rem', width: '100%' }}>
            Open Doctor Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
