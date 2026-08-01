import React, { useState } from 'react';
import { Feature, ProjectSettings, FeatureStyle } from '../types';
import { areaOfPolygon, perimeterOfPolygon, polylineLength, geometryBounds, toPolygonPoints } from '../lib/geometry';
import { formatArea, formatLength } from '../lib/units';

type PropertiesPanelProps = {
  feature: Feature | null;
  settings: ProjectSettings;
  onUpdateProperty: (featureId: string, key: string, value: string | number) => void;
  onUpdateStyle: (featureId: string, style: Partial<FeatureStyle>) => void;
  onDeleteFeature: (featureId: string) => void;
  onDuplicateFeature: (featureId: string) => void;
  onBringForward: (featureId: string) => void;
  onSendBackward: (featureId: string) => void;
  onCommitFeature?: (f: Feature) => void;
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  feature,
  settings,
  onUpdateProperty,
  onUpdateStyle,
  onDeleteFeature,
  onDuplicateFeature,
  onBringForward,
  onSendBackward,
  onCommitFeature,
}) => {
  const [smartPlotSize, setSmartPlotSize] = useState(100);
  const [smartRoadWidth, setSmartRoadWidth] = useState(8);
  if (!feature) {
    return (
      <aside className="properties-panel">
        <div className="prop-empty-state">No feature selected</div>
      </aside>
    );
  }

  const geom = feature.geometry;
  let area = 0;
  let length = 0;

  if (geom.type === 'polygon' || geom.type === 'rectangle' || geom.type === 'circle') {
    const points = toPolygonPoints(geom);
    area = areaOfPolygon(points);
    length = perimeterOfPolygon(points);
  } else if (geom.type === 'line' || geom.type === 'polyline') {
    length = polylineLength(geom.points);
  }

  const { width, height } = geometryBounds(geom);

  const addAdjacentPlot = (side: 'left' | 'right') => {
    if (!feature || !onCommitFeature) return;
    const bounds = geometryBounds(geom);
    const depth = bounds.height;
    const areaSqm = smartPlotSize * 0.836127;
    const plotW = areaSqm / depth;

    let px1 = 0, px2 = 0;
    if (side === 'right') {
      px1 = bounds.maxX;
      px2 = bounds.maxX + plotW;
    } else {
      px1 = bounds.minX - plotW;
      px2 = bounds.minX;
    }

    const newPlotPts = [
      { x: px1, y: bounds.minY },
      { x: px2, y: bounds.minY },
      { x: px2, y: bounds.maxY },
      { x: px1, y: bounds.maxY }
    ];

    onCommitFeature({
      id: `feature-${Math.random().toString(36).substr(2, 9)}`,
      layerId: feature.layerId,
      name: `Plot (AI)`,
      geometry: { type: 'polygon', points: newPlotPts },
      style: { fillColor: 'rgba(255,255,255,0.02)', borderColor: '#64748b', lineWidth: 1.2 },
      properties: {
        category: 'residential',
        status: 'available',
        plotNumber: 'New',
        remarks: 'AI Extension Plot'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      zIndex: feature.zIndex
    });
  };

  const addAdjacentRoad = (side: 'left' | 'right') => {
    if (!feature || !onCommitFeature) return;
    const bounds = geometryBounds(geom);
    const roadWidthMeters = smartRoadWidth * 0.3048;

    let rx1 = 0, rx2 = 0;
    if (side === 'right') {
      rx1 = bounds.maxX;
      rx2 = bounds.maxX + roadWidthMeters;
    } else {
      rx1 = bounds.minX - roadWidthMeters;
      rx2 = bounds.minX;
    }

    const newRoadPts = [
      { x: rx1, y: bounds.minY },
      { x: rx2, y: bounds.minY },
      { x: rx2, y: bounds.maxY },
      { x: rx1, y: bounds.maxY }
    ];

    onCommitFeature({
      id: `feature-${Math.random().toString(36).substr(2, 9)}`,
      layerId: feature.layerId,
      name: `Road (${smartRoadWidth} Ft)`,
      geometry: { type: 'polygon', points: newRoadPts },
      style: { fillColor: 'rgba(71, 85, 105, 0.25)', borderColor: '#475569', lineWidth: 1.5 },
      properties: {
        roadWidth: smartRoadWidth
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      zIndex: feature.zIndex
    });
  };

  const addPlotLabel = () => {
    if (!feature || !onCommitFeature) return;
    const bounds = geometryBounds(geom);
    const labelX = (bounds.minX + bounds.maxX) / 2;
    const labelY = bounds.maxY + 2.5;

    const text = window.prompt("Enter label text:", `${feature.name} Label`);
    if (!text) return;

    onCommitFeature({
      id: `feature-${Math.random().toString(36).substr(2, 9)}`,
      layerId: feature.layerId,
      name: `Label: ${text}`,
      geometry: { type: 'label', point: { x: labelX, y: labelY }, text },
      style: { fillColor: '#ffffff' },
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      zIndex: feature.zIndex + 1
    });
  };

  return (
    <aside className="properties-panel">
      <div className="prop-section">
        <div className="prop-section-title">Feature Info</div>
        <div className="prop-row">
          <span className="prop-label">Name</span>
          <input
            type="text"
            className="prop-input"
            value={feature.name}
            onChange={(e) => onUpdateProperty(feature.id, 'name', e.target.value)}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Type</span>
          <span className="prop-value">{geom.type}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Layer</span>
          <span className="prop-value">{feature.layerId}</span>
        </div>
        {geom.type === 'label' && (
          <div className="prop-row">
            <span className="prop-label">Label Text 🔤</span>
            <input
              type="text"
              className="prop-input"
              value={(geom as any).text || ''}
              onChange={(e) => onUpdateProperty(feature.id, 'text', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="prop-section">
        <div className="prop-section-title">Measurements</div>
        {area > 0 && (
          <div className="prop-row">
            <span className="prop-label">Area</span>
            <span className="prop-value">{formatArea(area, settings)}</span>
          </div>
        )}
        {length > 0 && (
          <div className="prop-row">
            <span className="prop-label">{area > 0 ? 'Perimeter' : 'Length'}</span>
            <span className="prop-value">{formatLength(length)}</span>
          </div>
        )}
        <div className="prop-row">
          <span className="prop-label">Width</span>
          <span className="prop-value">{formatLength(width)}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Height</span>
          <span className="prop-value">{formatLength(height)}</span>
        </div>
      </div>

      <div className="prop-section">
        <div className="prop-section-title">Plot Information</div>
        <div className="prop-row">
          <span className="prop-label">Plot Number</span>
          <input
            type="text"
            className="prop-input"
            value={feature.properties.plotNumber || ''}
            onChange={(e) => onUpdateProperty(feature.id, 'plotNumber', e.target.value)}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Owner Name</span>
          <input
            type="text"
            className="prop-input"
            value={feature.properties.ownerName || ''}
            onChange={(e) => onUpdateProperty(feature.id, 'ownerName', e.target.value)}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Mobile Number</span>
          <input
            type="text"
            className="prop-input"
            value={feature.properties.mobileNumber || ''}
            onChange={(e) => onUpdateProperty(feature.id, 'mobileNumber', e.target.value)}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Rate</span>
          <input
            type="number"
            className="prop-input"
            value={feature.properties.rate || 0}
            onChange={(e) => {
              const rate = parseFloat(e.target.value) || 0;
              onUpdateProperty(feature.id, 'rate', rate);
              onUpdateProperty(feature.id, 'totalValue', area * rate);
            }}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Total Value</span>
          <span className="prop-value">{feature.properties.totalValue || 0}</span>
        </div>
        <div className="prop-row">
          <span className="prop-label">Status</span>
          <select
            className={`prop-select prop-status-badge status-${feature.properties.status || 'available'}`}
            value={feature.properties.status || 'available'}
            onChange={(e) => onUpdateProperty(feature.id, 'status', e.target.value)}
          >
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="booked">Booked</option>
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">Category</span>
          <select
            className="prop-select"
            value={feature.properties.category || 'residential'}
            onChange={(e) => onUpdateProperty(feature.id, 'category', e.target.value)}
          >
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="park">Park</option>
            <option value="institutional">Institutional</option>
            <option value="utility">Utility</option>
          </select>
        </div>
        <div className="prop-row">
          <span className="prop-label">Remarks</span>
          <input
            type="text"
            className="prop-input"
            value={feature.properties.remarks || ''}
            onChange={(e) => onUpdateProperty(feature.id, 'remarks', e.target.value)}
          />
        </div>
      </div>

      <div className="prop-section">
        <div className="prop-section-title">Style</div>
        <div className="prop-row">
          <span className="prop-label">Fill Color</span>
          <input
            type="color"
            className="prop-color-input"
            value={feature.style.fillColor || '#ffffff'}
            onChange={(e) => onUpdateStyle(feature.id, { fillColor: e.target.value })}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Border Color</span>
          <input
            type="color"
            className="prop-color-input"
            value={feature.style.borderColor || '#000000'}
            onChange={(e) => onUpdateStyle(feature.id, { borderColor: e.target.value })}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Fill Opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            className="prop-input"
            value={feature.style.fillOpacity ?? 1}
            onChange={(e) => onUpdateStyle(feature.id, { fillOpacity: parseFloat(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Line Width</span>
          <input
            type="number"
            className="prop-input"
            value={feature.style.lineWidth || 1}
            onChange={(e) => onUpdateStyle(feature.id, { lineWidth: parseFloat(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Rotation 🔄</span>
          <input
            type="number"
            className="prop-input"
            value={feature.rotation || 0}
            onChange={(e) => onUpdateProperty(feature.id, 'rotation', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="prop-row">
          <span className="prop-label">Scale 🔍</span>
          <input
            type="number"
            step="0.1"
            className="prop-input"
            value={feature.scale || 1}
            onChange={(e) => onUpdateProperty(feature.id, 'scale', parseFloat(e.target.value) || 1)}
          />
        </div>
        {geom.type === 'label' && (
          <div className="prop-row">
            <span className="prop-label">Font Size 🔤</span>
            <input
              type="number"
              className="prop-input"
              value={(feature.style as any).fontSize || 12}
              onChange={(e) => onUpdateStyle(feature.id, { fontSize: parseInt(e.target.value) || 12 } as any)}
            />
          </div>
        )}
      </div>

      {(geom.type === 'polygon' || geom.type === 'rectangle') && onCommitFeature && (
        <div className="prop-section">
          <div className="prop-section-title">🤖 AI Smart Actions</div>
          <div className="prop-row">
            <span className="prop-label">Plot Size (Gaj)</span>
            <input 
              type="number" 
              className="prop-input" 
              value={smartPlotSize} 
              onChange={e => setSmartPlotSize(parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className="prop-row">
            <span className="prop-label">Road Width (Ft)</span>
            <input 
              type="number" 
              className="prop-input" 
              value={smartRoadWidth} 
              onChange={e => setSmartRoadWidth(parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className="prop-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 16px' }}>
            <button className="ribbon-btn" style={{ fontSize: '11px', padding: '6px' }} onClick={() => addAdjacentPlot('left')}>
              🏡 +Plot (Left)
            </button>
            <button className="ribbon-btn" style={{ fontSize: '11px', padding: '6px' }} onClick={() => addAdjacentPlot('right')}>
              🏡 +Plot (Right)
            </button>
            <button className="ribbon-btn" style={{ fontSize: '11px', padding: '6px' }} onClick={() => addAdjacentRoad('left')}>
              🛣️ +Road (Left)
            </button>
            <button className="ribbon-btn" style={{ fontSize: '11px', padding: '6px' }} onClick={() => addAdjacentRoad('right')}>
              🛣️ +Road (Right)
            </button>
            <button className="ribbon-btn" style={{ fontSize: '11px', padding: '6px', gridColumn: 'span 2', background: 'rgba(20, 184, 166, 0.15)', borderColor: '#14b8a6' }} onClick={addPlotLabel}>
              🔤 Add Label near Plot
            </button>
          </div>
        </div>
      )}

      <div className="prop-section">
        <div className="prop-section-title">Actions</div>
        <div className="prop-actions">
          <button onClick={() => onDuplicateFeature(feature.id)}>Duplicate</button>
          <button onClick={() => onBringForward(feature.id)}>Bring Forward</button>
          <button onClick={() => onSendBackward(feature.id)}>Send Backward</button>
          <button onClick={() => onDeleteFeature(feature.id)} style={{ color: 'red' }}>Delete</button>
        </div>
      </div>
    </aside>
  );
};

