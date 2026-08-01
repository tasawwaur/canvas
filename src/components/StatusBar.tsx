import React from 'react';
import { Tool, Viewport, Point, ProjectSettings, SnapMode, AreaUnit } from '../types';

type StatusBarProps = {
  tool: Tool;
  viewport: Viewport;
  cursorWorld: Point | null;
  settings: ProjectSettings;
  selectedCount: number;
  featureCount: number;
  onZoomChange: (scale: number) => void;
  onUnitChange: (unit: AreaUnit) => void;
  snapModes: SnapMode[];
  onToggleSnap: (mode: SnapMode) => void;
  fps?: number;
};

const SNAP_LABELS: Record<SnapMode, string> = {
  endpoint: 'E',
  midpoint: 'M',
  intersection: 'I',
  grid: 'G',
  vertex: 'V'
};

const ALL_SNAP_MODES: SnapMode[] = ['endpoint', 'midpoint', 'intersection', 'grid', 'vertex'];

export const StatusBar: React.FC<StatusBarProps> = ({
  tool,
  viewport,
  cursorWorld,
  settings,
  selectedCount,
  featureCount,
  onZoomChange,
  onUnitChange,
  snapModes,
  onToggleSnap,
  fps = 60
}) => {
  return (
    <footer className="status-bar">
      <div className="status-section">
        <div className="status-item">
          <span className="status-label">🛠️ Tool:</span>
          <span className="status-value">{tool.toUpperCase()}</span>
        </div>
        <div className="status-item">
          <span className="status-label">📍 Cursor:</span>
          <span className="status-value">
            {cursorWorld ? `${cursorWorld.x.toFixed(2)}, ${cursorWorld.y.toFixed(2)}` : '-'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">⚡ FPS:</span>
          <span className="status-value" style={{ color: fps > 40 ? '#22c55e' : '#ef4444' }}>{fps}</span>
        </div>
      </div>

      <div className="status-section" style={{ flex: 1, justifyContent: 'center' }}>
        <div className="status-item">
          <span className="status-label">🧲 Snap:</span>
          {ALL_SNAP_MODES.map((mode) => (
            <button
              key={mode}
              className={`status-snap-badge ${snapModes.includes(mode) ? 'status-snap-active' : ''}`}
              onClick={() => onToggleSnap(mode)}
              title={`Toggle ${mode} snap`}
            >
              {SNAP_LABELS[mode]}
            </button>
          ))}
        </div>
        <div className="status-item">
          <span className="status-label">🌐 Grid:</span>
          <span className="status-value">{settings.gridSize}</span>
        </div>
      </div>

      <div className="status-section">
        <div className="status-item">
          <select
            className="status-unit-select"
            value={settings.units}
            onChange={(e) => onUnitChange(e.target.value as AreaUnit)}
          >
            <option value="sqft">Sq Ft</option>
            <option value="sqm">Sq M</option>
            <option value="sqyd">Sq Yd</option>
            <option value="acre">Acre</option>
            <option value="hectare">Hectare</option>
            <option value="bigha">Bigha</option>
            <option value="biswa">Biswa</option>
            <option value="marla">Marla</option>
            <option value="kanal">Kanal</option>
          </select>
        </div>
        <div className="status-item">
          <span className="status-label">🔍 Zoom:</span>
          <input
            type="range"
            className="status-zoom-slider"
            min="0.1"
            max="40"
            step="0.1"
            value={viewport.scale}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          />
          <span className="status-value">{Math.round(viewport.scale * 100)}%</span>
        </div>
        <div className="status-item">
          <span className="status-label">📦 Objects:</span>
          <span className="status-value">{selectedCount} / {featureCount}</span>
        </div>
      </div>
    </footer>
  );
};
