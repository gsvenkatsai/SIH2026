import React, { useState } from 'react';

const QUICK_CHIPS = [
  "Chest pain radiating to left arm",
  "High fever with chills for 3 days",
  "Persistent dry cough for 2 weeks",
  "Severe headache and dizziness",
  "Abdominal pain and nausea"
];

export default function ChiefComplaint({ onStartInterview, isLoading }) {
  const [patientName, setPatientName] = useState('Rahul Sharma');
  const [complaint, setComplaint] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!complaint.trim()) return;
    onStartInterview(complaint, patientName);
  };

  return (
    <div style={{ maxWidth: '680px', margin: '2rem auto' }}>
      <div className="glass-card">
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>
          📝 What brings you to the doctor today?
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Please describe your primary symptoms or main health concern in your own words.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Patient Name (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Chief Complaint / Primary Symptoms *</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. I have been having chest pain and shortness of breath since morning..."
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Quick Selection:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setComplaint(chip)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.borderColor = 'var(--accent-indigo)'}
                  onMouseLeave={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={isLoading || !complaint.trim()}>
              {isLoading ? 'Starting Interview...' : 'Start AI Interview →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
