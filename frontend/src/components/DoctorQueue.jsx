import React from 'react';

export default function DoctorQueue({ queue, onSelectVisit, onRefresh }) {
  return (
    <div style={{ maxWidth: '980px', margin: '2rem auto' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '0.25rem' }}>
              👨‍⚕️ Physician Verification Queue
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Select a patient intake record to review source-tagged evidence, check flags, edit, and approve.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onRefresh}>
            🔄 Refresh Queue
          </button>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
            No patient intake records in queue. Start a patient intake session to populate queue.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Visit ID</th>
                  <th>Patient Name</th>
                  <th>Chief Complaint</th>
                  <th>Docs</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.visit_id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      #{item.visit_id}
                    </td>
                    <td style={{ fontWeight: 500, color: '#f8fafc' }}>
                      {item.patient_name}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {item.chief_complaint}
                    </td>
                    <td>
                      <span className="tag-document">📄 {item.document_count}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-cyan"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                        onClick={() => onSelectVisit(item.visit_id)}
                      >
                        Review Record →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
