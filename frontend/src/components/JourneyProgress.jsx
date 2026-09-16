import React from 'react';

/**
 * JourneyProgress — the "YOUR HEALTH JOURNEY" step rail.
 *
 * steps: [{ key, label }]
 * currentKey: key of the active step (terracotta dot)
 * Completed steps (before current) get sage dots.
 *
 * Rendered on major patient screens; compact enough to sit beside content
 * without competing with it.
 */
export default function JourneyProgress({ steps, currentKey, title = 'YOUR HEALTH JOURNEY' }) {
  const currentIdx = steps.findIndex((s) => s.key === currentKey);

  return (
    <aside style={{ minWidth: '190px' }}>
      <div className="kicker" style={{ marginBottom: '1rem' }}>{title}</div>
      <div className="journey">
        {steps.map((step, idx) => {
          const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : '';
          return (
            <div key={step.key} className={`journey-step ${state}`}>
              <span className="journey-dot" />
              <span className="journey-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
