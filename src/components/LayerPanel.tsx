import React, { useState } from 'react';
import { Layer, Feature } from '../types';

type LayerPanelProps = {
  layers: Layer[];
  features: Feature[];
  activeLayerId: string;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onChangeLayerOpacity: (id: string, opacity: number) => void;
  onChangeLayerColor: (id: string, color: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
};

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  features,
  activeLayerId,
  onToggleLayerVisible,
  onToggleLayerLock,
  onChangeLayerOpacity,
  onChangeLayerColor,
  onReorderLayer,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onRenameLayer,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  return (
    <div className="layer-panel">
      <div className="layer-list">
        {sortedLayers.map((layer) => {
          const count = features.filter((f) => f.layerId === layer.id).length;
          const isActive = layer.id === activeLayerId;

          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? 'layer-item-active' : ''}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <input
                type="color"
                className="layer-swatch"
                value={layer.color}
                onChange={(e) => onChangeLayerColor(layer.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="layer-info" onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingId(layer.id);
                setEditName(layer.name);
              }}>
                {editingId === layer.id ? (
                  <input
                    className="layer-name-input"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      onRenameLayer(layer.id, editName);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRenameLayer(layer.id, editName);
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="layer-name">{layer.name} ({count})</span>
                )}
              </div>
              <div className="layer-controls">
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleLayerVisible(layer.id); }}
                  title="Toggle Visibility"
                >
                  {layer.visible ? '👁️' : '🕶️'}
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                  title="Toggle Lock"
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onReorderLayer(layer.id, 'up'); }}
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); onReorderLayer(layer.id, 'down'); }}
                  title="Move Down"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="layer-panel-actions">
        <button onClick={onAddLayer}>➕ Add</button>
        <button onClick={() => onDuplicateLayer(activeLayerId)}>📋 Duplicate</button>
        <button onClick={() => onDeleteLayer(activeLayerId)} style={{ color: '#ef4444' }}>🗑️ Delete</button>
      </div>
    </div>
  );
};
