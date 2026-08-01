import React, { useState } from 'react';
import { PrintSettings, PaperSize, Orientation } from '../types';

type PrintDialogProps = {
  open: boolean;
  onClose: () => void;
  onPrint: (settings: PrintSettings) => void;
  projectName: string;
};

export const PrintDialog: React.FC<PrintDialogProps> = ({ open, onClose, onPrint, projectName }) => {
  const [settings, setSettings] = useState<PrintSettings>({
    paperSize: 'A4',
    orientation: 'landscape',
    scale: 100,
    fitToPage: true,
    showGrid: false,
    showDimensions: true,
    title: projectName,
  });

  if (!open) return null;

  return (
    <div className="print-dialog-overlay">
      <div className="print-dialog">
        <div className="print-dialog-header">
          <h2>Print Document</h2>
        </div>
        <div className="print-dialog-body">
          <div className="print-dialog-field">
            <label>Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
          </div>
          <div className="print-dialog-field">
            <label>Paper Size</label>
            <select
              value={settings.paperSize}
              onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}
            >
              <option value="A0">A0</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="A3">A3</option>
              <option value="A4">A4</option>
            </select>
          </div>
          <div className="print-dialog-field">
            <label>Orientation</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label>
                <input
                  type="radio"
                  name="orientation"
                  checked={settings.orientation === 'landscape'}
                  onChange={() => setSettings({ ...settings, orientation: 'landscape' })}
                /> Landscape
              </label>
              <label>
                <input
                  type="radio"
                  name="orientation"
                  checked={settings.orientation === 'portrait'}
                  onChange={() => setSettings({ ...settings, orientation: 'portrait' })}
                /> Portrait
              </label>
            </div>
          </div>
          <div className="print-dialog-field">
            <label>Scale</label>
            <select
              value={settings.fitToPage ? 'fit' : settings.scale.toString()}
              onChange={(e) => {
                if (e.target.value === 'fit') {
                  setSettings({ ...settings, fitToPage: true });
                } else {
                  setSettings({ ...settings, fitToPage: false, scale: parseFloat(e.target.value) || 100 });
                }
              }}
            >
              <option value="fit">Fit to Page</option>
              <option value="50">1:50</option>
              <option value="100">1:100</option>
              <option value="200">1:200</option>
              <option value="500">1:500</option>
              <option value="1000">1:1000</option>
              <option value="custom">Custom</option>
            </select>
            {!settings.fitToPage && (
              <input
                type="number"
                value={settings.scale}
                onChange={(e) => setSettings({ ...settings, scale: parseFloat(e.target.value) || 100 })}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>
          <div className="print-dialog-field">
            <label>Options</label>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(e) => setSettings({ ...settings, showGrid: e.target.checked })}
                /> Show Grid
              </label>
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={settings.showDimensions}
                  onChange={(e) => setSettings({ ...settings, showDimensions: e.target.checked })}
                /> Show Dimensions
              </label>
            </div>
          </div>
        </div>
        <div className="print-dialog-footer">
          <button className="print-dialog-btn" onClick={onClose}>Cancel</button>
          <button className="print-dialog-btn print-dialog-btn-primary" onClick={() => onPrint(settings)}>Print</button>
        </div>
      </div>
    </div>
  );
};
