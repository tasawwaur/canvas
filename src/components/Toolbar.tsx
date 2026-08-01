import React from 'react';
import { Tool } from '../types';

type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  scale: number;
};

type ToolGroupInfo = {
  name: string;
  tools: { id: Tool; label: string; icon: React.ReactNode }[];
};

const ICONS = {
  select: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7 18 3-7 7-3-18-8z" /></svg>,
  pan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 2v7l-2-2m4-5v7l2-2m-8 6H2l2-2m-4 5h7l-2 2m8-6v7l-2-2m4-5v7l2-2m-4-6h7l-2-2m-5 4h7l-2 2" /></svg>,
  line: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4" /></svg>,
  polyline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20l6-6 4 4 6-12" /></svg>,
  rectangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" /></svg>,
  circle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg>,
  polygon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 6-3 11H6l-3-11z" /></svg>,
  freehand: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15c3-6 7-6 10-2s8-4 8-10" /></svg>,
  plotBoundary: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" strokeDasharray="4 2" /></svg>,
  road: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 22V2M16 22V2M12 22v-4m0-4v-4m0-4V2" /></svg>,
  divider: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M12 4v16" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-5-5l5 5-5 5" /></svg>,
  label: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>,
  point: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>,
  measure: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15l4-4 4 4 4-4 6 6" /></svg>,
  gate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V2m16 20V2M4 12h16M4 6h16" /></svg>,
  tree: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22v-6m-4-6c0-4 8-4 8 0 0 2-2 3-4 6-2-3-4-4-4-6z" /></svg>,
  pole: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M8 6h8M8 12h8" /></svg>,
  waterTank: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="8" width="12" height="14" rx="2" /><path d="M8 8V6a2 2 0 014 0v2" /></svg>,
  park: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22v-4a6 6 0 0112 0v4M12 18v-8M9 6a3 3 0 116 0" /></svg>,
  school: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V10l8-6 8 6v12H4zm8-12v10M8 22v-4m8 4v-4" /></svg>,
  temple: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 10h16zM6 10v12h12V10M10 22v-6h4v6" /></svg>,
  mosque: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c-2 2-4 5-4 8v12h8V10c0-3-2-6-4-8zM4 22v-8c0-2 2-4 4-4M20 22v-8c0-2-2-4-4-4" /></svg>,
};

const GROUPS: ToolGroupInfo[] = [
  {
    name: 'Navigate',
    tools: [
      { id: 'select', label: 'Select', icon: ICONS.select },
      { id: 'pan', label: 'Pan', icon: ICONS.pan },
    ],
  },
  {
    name: 'Draw',
    tools: [
      { id: 'line', label: 'Line', icon: ICONS.line },
      { id: 'polyline', label: 'Polyline', icon: ICONS.polyline },
      { id: 'rectangle', label: 'Rectangle', icon: ICONS.rectangle },
      { id: 'circle', label: 'Circle', icon: ICONS.circle },
      { id: 'polygon', label: 'Polygon', icon: ICONS.polygon },
      { id: 'freehand', label: 'Freehand', icon: ICONS.freehand },
    ],
  },
  {
    name: 'Property',
    tools: [
      { id: 'plotBoundary', label: 'Plot Boundary', icon: ICONS.plotBoundary },
      { id: 'road', label: 'Road', icon: ICONS.road },
      { id: 'divider', label: 'Divider', icon: ICONS.divider },
      { id: 'arrow', label: 'Arrow', icon: ICONS.arrow },
    ],
  },
  {
    name: 'Annotate',
    tools: [
      { id: 'label', label: 'Label', icon: ICONS.label },
      { id: 'point', label: 'Survey Point', icon: ICONS.point },
      { id: 'measure', label: 'Measure', icon: ICONS.measure },
    ],
  },
  {
    name: 'Symbols',
    tools: [
      { id: 'gate', label: 'Gate', icon: ICONS.gate },
      { id: 'tree', label: 'Tree', icon: ICONS.tree },
      { id: 'pole', label: 'Pole', icon: ICONS.pole },
      { id: 'waterTank', label: 'Water Tank', icon: ICONS.waterTank },
      { id: 'park', label: 'Park', icon: ICONS.park },
      { id: 'school', label: 'School', icon: ICONS.school },
      { id: 'temple', label: 'Temple', icon: ICONS.temple },
      { id: 'mosque', label: 'Mosque', icon: ICONS.mosque },
    ],
  },
];

export const Toolbar: React.FC<ToolbarProps> = ({ tool, onToolChange, scale }) => {
  return (
    <div className="toolbar">
      {GROUPS.map((group, i) => (
        <React.Fragment key={group.name}>
          <div className="tool-group">
            {group.tools.map((t) => (
              <button
                key={t.id}
                className={`tool-btn ${tool === t.id ? 'tool-btn-active' : ''}`}
                onClick={() => onToolChange(t.id)}
                title={t.label}
              >
                {t.icon}
                <span className="tool-tooltip">{t.label}</span>
              </button>
            ))}
          </div>
          {i < GROUPS.length - 1 && <div className="tool-separator" />}
        </React.Fragment>
      ))}
    </div>
  );
};
