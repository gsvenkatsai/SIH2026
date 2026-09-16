import React from 'react';

export default function DoctorQueue({ queue, onSelectVisit, onRefresh }) {
  return (
    <div className="doc-world" style={{ maxWidth: '1040px', margin: '2rem auto', padding: '2rem 2.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="kicker" style={{ color: '#E4C27E', marginBottom: '0.4rem' }}>Clinical Review</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', marginBottom: '0.2rem' }}>
              Physician Verification Queue
            </h2>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              Source-tagged evidence, flags, and approvals — verified before anything reaches the record.
            </p>
          </div>
          <button className="btn btn-outline" onClick={onRefresh}>
            🔄 Refresh Queue
          </button>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--doc-faint)' }}>
            No patient intake records in queue. Start a patient intake session to populate queue.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Token</th>
                  <th>Chief Complaint</th>
                  <th>Attention</th>
                  <th>Docs</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.visit_id}>
                    <td style={{ fontWeight: 600 }}>
                      {item.patient_name}
                    </td>
                    <td style={{ color: 'var(--doc-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      #A{String(item.visit_id).padStart(4, '0')}
                    </td>
                    <td style={{ color: 'var(--doc-muted)', maxWidth: '260px' }}>
                      {item.chief_complaint}
                    </td>
                    <td>
                      {item.red_flag_alert ? (
                        <span className="tag-interview" style={{ fontSize: '0.72rem' }}>🚨 Prompt assessment</span>
                      ) : item.triage_level === 'ALERT' ? (
                        <span className="tag-document" style={{ fontSize: '0.72rem' }}>⚠ Attention</span>
                      ) : (
                        <span style={{ color: 'var(--doc-faint)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="tag-document" style={{ fontSize: '0.72rem' }}>📄 {item.document_count}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.83rem' }}
                        onClick={() => onSelectVisit(item.visit_id)}
                      >
                        Review →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
