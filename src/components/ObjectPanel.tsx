import React, { useState } from 'react';
import { Feature, Layer } from '../types';

type ObjectPanelProps = {
  features: Feature[];
  layers: Layer[];
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  onToggleFeatureVisibility?: (id: string) => void;
};

const GEOM_ICONS: Record<string, React.ReactNode> = {
  point: <circle cx="12" cy="12" r="4" fill="currentColor" />,
  line: <path d="M4 20L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  polyline: <path d="M4 20l6-6 4 4 6-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />,
  polygon: <path d="M12 3l9 6-3 11H6l-3-11z" stroke="currentColor" strokeWidth="2" fill="none" />,
  rectangle: <rect x="4" y="6" width="16" height="12" stroke="currentColor" strokeWidth="2" fill="none" />,
  circle: <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />,
  label: <text x="6" y="16" fontSize="14" fill="currentColor" fontFamily="sans-serif">T</text>,
  arrow: <path d="M5 12h14m-5-5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  symbol: <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke="currentColor" strokeWidth="2" fill="none" />,
};

export const ObjectPanel: React.FC<ObjectPanelProps> = ({
  features,
  layers,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(new Set());

  const toggleLayer = (layerId: string) => {
    const next = new Set(collapsedLayers);
    if (next.has(layerId)) next.delete(layerId);
    else next.add(layerId);
    setCollapsedLayers(next);
  };

  if (features.length === 0) {
    return (
      <div className="object-panel">
        <div className="object-empty">No objects in project</div>
      </div>
    );
  }

  return (
    <div className="object-panel">
      {layers.map((layer) => {
        const layerFeatures = features.filter((f) => f.layerId === layer.id);
        if (layerFeatures.length === 0) return null;

        const isCollapsed = collapsedLayers.has(layer.id);

        return (
          <div key={layer.id} className="object-layer-group">
            <div
              className="object-layer-header"
              onClick={() => toggleLayer(layer.id)}
            >
              <span>{isCollapsed ? '▶' : '▼'}</span> {layer.name} ({layerFeatures.length})
            </div>
            {!isCollapsed && (
              <div>
                {layerFeatures.map((f) => (
                  <div
                    key={f.id}
                    className={`object-item ${selectedFeatureId === f.id ? 'object-item-selected' : ''}`}
                    onClick={() => onSelectFeature(f.id)}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: layer.color,
                        marginRight: '8px',
                        flexShrink: 0
                      }}
                    />
                    <svg viewBox="0 0 24 24" className="object-item-icon" width="16" height="16">
                      {GEOM_ICONS[f.geometry.type]}
                    </svg>
                    <span className="object-item-name" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
