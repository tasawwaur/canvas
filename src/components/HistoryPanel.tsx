import React from 'react';

type HistoryPanelProps = {
  past: number;
  future: number;
  onJumpToPast: (index: number) => void;
  onJumpToFuture: (index: number) => void;
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  past,
  future,
  onJumpToPast,
  onJumpToFuture
}) => {
  return (
    <div className="panel-card history-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
      <div className="panel-title" style={{ fontSize: '0.9rem', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '0.25rem' }}>
        📜 Action History Stack
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Future states (Redo stack) - shown in reverse order so present is in middle */}
        {Array.from({ length: future }).map((_, i) => {
          const index = future - 1 - i;
          return (
            <div
              key={`future-${index}`}
              className="history-item future-item"
              onClick={() => onJumpToFuture(index + 1)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#64748b',
                background: 'rgba(251, 146, 60, 0.05)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251, 146, 60, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(251, 146, 60, 0.05)'; }}
            >
              ↪️ Redo State (Fast-Forward {index + 1})
            </div>
          );
        })}

        {/* Present state */}
        <div
          className="history-item present-item"
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            color: '#fb923c',
            background: 'rgba(251, 146, 60, 0.15)',
            borderLeft: '3px solid #fb923c'
          }}
        >
          🟢 Current State
        </div>

        {/* Past states (Undo stack) - shown in reverse order so latest past is next to present */}
        {Array.from({ length: past }).map((_, i) => {
          const index = past - 1 - i;
          return (
            <div
              key={`past-${index}`}
              className="history-item past-item"
              onClick={() => onJumpToPast(past - index)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#e5eefb',
                background: 'rgba(148, 163, 184, 0.03)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.03)'; }}
            >
              ↩️ Revert Action (Revert {past - index} steps)
            </div>
          );
        })}
      </div>
    </div>
  );
};
