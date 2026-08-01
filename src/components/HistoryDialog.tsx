import React, { useEffect, useState } from 'react';
import { SavedProjectInfo } from '../types';
import { ProjectManager } from '../core/ProjectManager';

type HistoryDialogProps = {
  open: boolean;
  onClose: () => void;
  onLoadProject: (id: string) => void;
  currentProjectId: string;
};

export const HistoryDialog: React.FC<HistoryDialogProps> = ({
  open,
  onClose,
  onLoadProject,
  currentProjectId
}) => {
  const [historyList, setHistoryList] = useState<SavedProjectInfo[]>([]);

  // Reload history list when dialog opens
  useEffect(() => {
    if (open) {
      setHistoryList(ProjectManager.getHistoryList());
    }
  }, [open]);

  if (!open) return null;

  const handleLoad = (id: string) => {
    if (window.confirm("Do you want to load this project? Unsaved changes in the current project will be lost.")) {
      onLoadProject(id);
      onClose();
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this project from browser history?")) {
      ProjectManager.deleteFromHistory(id);
      setHistoryList(ProjectManager.getHistoryList());
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="print-dialog-overlay" style={{ zIndex: 1050 }}>
      <div className="print-dialog" style={{ width: '500px', maxWidth: '90vw' }}>
        <div className="print-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>📁 Browser Saved Projects</h2>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              fontSize: '1.5rem', 
              cursor: 'pointer',
              padding: '0 4px'
            }}
          >
            &times;
          </button>
        </div>
        <div className="print-dialog-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>📭</p>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No projects saved in browser history yet.</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                Use <strong>"Save to Browser"</strong> in the File menu to save snapshots of your work.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {historyList.map((item) => {
                const isCurrent = item.id === currentProjectId;
                return (
                  <div 
                    key={item.id} 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: isCurrent ? 'rgba(14, 165, 233, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {item.name}
                        </span>
                        {isCurrent && (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: 'var(--accent-primary)', 
                            color: '#000',
                            fontWeight: 600
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        📅 Last Updated: {formatDate(item.updatedAt)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        📐 Elements: {item.featureCount}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button 
                        className="print-dialog-btn print-dialog-btn-primary" 
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem', 
                          fontWeight: 600,
                          background: isCurrent ? 'rgba(14, 165, 233, 0.2)' : 'var(--accent-primary)',
                          color: isCurrent ? 'var(--text-primary)' : '#000'
                        }}
                        onClick={() => handleLoad(item.id)}
                      >
                        📂 Load
                      </button>
                      <button 
                        className="print-dialog-btn" 
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: 'none'
                        }}
                        onClick={(e) => handleDelete(item.id, e)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="print-dialog-footer" style={{ padding: '12px 16px' }}>
          <button className="print-dialog-btn" onClick={onClose} style={{ width: '100px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
