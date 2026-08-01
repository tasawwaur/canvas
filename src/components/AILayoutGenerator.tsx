import React, { useState, useEffect } from 'react';
import { Feature, Layer, Point, Geometry, SymbolType } from '../types';
import { createId, nowIso, toPolygonPoints } from '../lib/geometry';

type AILayoutGeneratorProps = {
  open: boolean;
  onClose: () => void;
  onCommitLayout: (features: Feature[]) => void;
  layers: Layer[];
};

type GeneratorSettings = {
  landSize: number;
  landUnit: string;
  plotSize: number;
  plotUnit: string;
  cornerPlot: boolean;
  roadWidth: number; // in feet
  laneMarking: boolean;
  drains: boolean;
  houses: boolean;
  houseSize: number;
  houseUnit: string;
  parkPercentage: number;
  commercial: boolean;
  commercialPercentage: number;
  temple: boolean;
  mosque: boolean;
};

const UNIT_LABELS: Record<string, string> = {
  sqft: 'Sq Ft',
  sqyd: 'Sq Yard (Gaj)',
  sqm: 'Sq Meter',
  gaj: 'Gaj',
  acre: 'Acre',
  hectare: 'Hectare',
  bigha: 'Bigha',
  biswa: 'Biswa',
  marla: 'Marla',
  kanal: 'Kanal'
};

const convertToSqm = (value: number, unit: string): number => {
  const rates: Record<string, number> = {
    sqft: 0.092903,
    sqyd: 0.836127,
    sqm: 1.0,
    gaj: 0.836127,
    acre: 4046.86,
    hectare: 10000.0,
    bigha: 2529.28,
    biswa: 126.46,
    marla: 25.2929,
    kanal: 505.857
  };
  const key = unit.toLowerCase().replace(/\s/g, '');
  return value * (rates[key] || 1.0);
};

export const AILayoutGenerator: React.FC<AILayoutGeneratorProps> = ({
  open,
  onClose,
  onCommitLayout,
  layers
}) => {
  const [settings, setSettings] = useState<GeneratorSettings>({
    landSize: 5,
    landUnit: 'bigha',
    plotSize: 100,
    plotUnit: 'gaj',
    cornerPlot: true,
    roadWidth: 25,
    laneMarking: true,
    drains: true,
    houses: true,
    houseSize: 50,
    houseUnit: 'gaj',
    parkPercentage: 10,
    commercial: true,
    commercialPercentage: 10,
    temple: true,
    mosque: false
  });

  const [metrics, setMetrics] = useState({
    totalAreaSqm: 0,
    roadAreaSqm: 0,
    parkAreaSqm: 0,
    commercialAreaSqm: 0,
    residentialAreaSqm: 0,
    remainingAreaSqm: 0,
    estimatedPlots: 0
  });

  // Calculate live metrics on input change
  useEffect(() => {
    const totalArea = convertToSqm(settings.landSize, settings.landUnit);
    const roadRatio = (settings.roadWidth / 80); // approximate roads reservation
    const parkRatio = settings.parkPercentage / 100;
    const commRatio = settings.commercial ? settings.commercialPercentage / 100 : 0;
    const utilRatio = (settings.temple ? 0.03 : 0) + (settings.mosque ? 0.03 : 0);

    const roadArea = totalArea * roadRatio;
    const parkArea = totalArea * parkRatio;
    const commercialArea = totalArea * commRatio;
    const utilityArea = totalArea * utilRatio;
    
    const residentialArea = Math.max(0, totalArea - roadArea - parkArea - commercialArea - utilityArea);
    const plotSizeSqm = convertToSqm(settings.plotSize, settings.plotUnit);
    const estPlots = plotSizeSqm > 0 ? Math.floor(residentialArea / plotSizeSqm) : 0;

    setMetrics({
      totalAreaSqm: Math.round(totalArea),
      roadAreaSqm: Math.round(roadArea),
      parkAreaSqm: Math.round(parkArea),
      commercialAreaSqm: Math.round(commercialArea),
      residentialAreaSqm: Math.round(residentialArea),
      remainingAreaSqm: Math.round(totalArea - (roadArea + parkArea + commercialArea + utilityArea + (estPlots * plotSizeSqm))),
      estimatedPlots: estPlots
    });
  }, [settings]);

  if (!open) return null;

  const handleGenerate = () => {
    const features: Feature[] = [];
    const landAreaSqm = convertToSqm(settings.landSize, settings.landUnit);
    const plotAreaSqm = convertToSqm(settings.plotSize, settings.plotUnit);

    // 1. Calculate boundaries of outer boundary rectangle (Aspect Ratio 1.5)
    const W = Math.round(Math.sqrt(landAreaSqm * 1.5) / 10) * 10;
    const H = Math.round((landAreaSqm / W) / 10) * 10;

    const boundaryPts = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H }
    ];

    // Layers resolving
    const boundaryLayer = layers.find(l => l.name.toLowerCase().includes('boundary')) || layers[0];
    const roadsLayer = layers.find(l => l.name.toLowerCase().includes('road') || l.name.toLowerCase().includes('sewer')) || layers[0];
    const plotsLayer = layers.find(l => l.name.toLowerCase().includes('plot') || l.name.toLowerCase().includes('symbol')) || layers[0];
    const parkLayer = layers.find(l => l.name.toLowerCase().includes('park') || l.name.toLowerCase().includes('water')) || layers[0];
    const utilityLayer = layers.find(l => l.name.toLowerCase().includes('utility') || l.name.toLowerCase().includes('electric')) || layers[0];

    // Add Boundary
    features.push({
      id: createId('feature'),
      layerId: boundaryLayer.id,
      name: 'Colony Boundary',
      geometry: { type: 'polygon', points: boundaryPts },
      style: { fillColor: 'rgba(255,255,255,0.01)', borderColor: '#eab308', lineWidth: 3 },
      properties: { area: landAreaSqm },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      zIndex: 1
    });

    const mainRoadWidth = settings.roadWidth * 0.3048; // convert ft to meters
    const internalRoadWidth = Math.max(6.0, mainRoadWidth * 0.75);

    // Main road running horizontally through center
    const yMain = H / 2;
    features.push({
      id: createId('feature'),
      layerId: roadsLayer.id,
      name: `Main Road (${settings.roadWidth} Ft)`,
      geometry: { type: 'polyline', points: [{ x: 0, y: yMain }, { x: W, y: yMain }] },
      style: { borderColor: '#334155', lineWidth: mainRoadWidth },
      properties: { roadWidth: settings.roadWidth },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      zIndex: 2
    });

    if (settings.laneMarking) {
      features.push({
        id: createId('feature'),
        layerId: roadsLayer.id,
        name: 'Main Road Lane Markings',
        geometry: { type: 'polyline', points: [{ x: 0, y: yMain }, { x: W, y: yMain }] },
        style: { borderColor: '#ffffff', lineWidth: 1, lineStyle: 'dashed' },
        properties: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
        zIndex: 3
      });
    }

    // Vertical internal roads spaced by double plot depth
    const plotDepth = Math.max(12.0, Math.sqrt(plotAreaSqm * 1.5));
    const roadSpacing = plotDepth * 2 + internalRoadWidth;
    const numVerticalRoads = Math.max(1, Math.floor(W / roadSpacing) - 1);

    const verticalRoadXCoords: number[] = [];
    const actualSpacing = W / (numVerticalRoads + 1);
    for (let i = 1; i <= numVerticalRoads; i++) {
      verticalRoadXCoords.push(i * actualSpacing);
    }

    verticalRoadXCoords.forEach((x, idx) => {
      features.push({
        id: createId('feature'),
        layerId: roadsLayer.id,
        name: `Internal Road ${idx + 1}`,
        geometry: { type: 'polyline', points: [{ x, y: 0 }, { x, y: H }] },
        style: { borderColor: '#475569', lineWidth: internalRoadWidth },
        properties: { roadWidth: Math.round(internalRoadWidth / 0.3048) },
        createdAt: nowIso(),
        updatedAt: nowIso(),
        zIndex: 2
      });
    });

    // Create block coordinates
    const xSplits = [0, ...verticalRoadXCoords, W];
    const topBlockY = [0, yMain - mainRoadWidth / 2];
    const bottomBlockY = [yMain + mainRoadWidth / 2, H];

    const blocks: { x1: number; x2: number; y1: number; y2: number; type: 'residential' | 'park' | 'commercial' | 'utility' }[] = [];
    for (let i = 0; i < xSplits.length - 1; i++) {
      const x1 = xSplits[i] + internalRoadWidth / 2;
      const x2 = xSplits[i+1] - internalRoadWidth / 2;
      if (x2 - x1 < 10) continue;

      blocks.push({ x1, x2, y1: topBlockY[0], y2: topBlockY[1], type: 'residential' });
      blocks.push({ x1, x2, y1: bottomBlockY[0], y2: bottomBlockY[1], type: 'residential' });
    }

    // Allocate Parks & Commercial blocks
    const parkBlockIdx = Math.floor(blocks.length / 4) * 2;
    if (blocks[parkBlockIdx]) blocks[parkBlockIdx].type = 'park';

    const commBlockIdx = 1;
    if (settings.commercial && blocks[commBlockIdx]) {
      blocks[commBlockIdx].type = 'commercial';
    }

    const utilBlockIdx = blocks.length - 1;
    if ((settings.temple || settings.mosque) && blocks[utilBlockIdx]) {
      blocks[utilBlockIdx].type = 'utility';
    }

    let plotCounter = 1;
    let shopCounter = 1;

    blocks.forEach((blk) => {
      const blockW = blk.x2 - blk.x1;
      const blockH = blk.y2 - blk.y1;

      if (blk.type === 'park') {
        // Park layout polygon
        const parkPts = [
          { x: blk.x1, y: blk.y1 },
          { x: blk.x2, y: blk.y1 },
          { x: blk.x2, y: blk.y2 },
          { x: blk.x1, y: blk.y2 }
        ];
        features.push({
          id: createId('feature'),
          layerId: parkLayer.id,
          name: 'Green Park 🌳',
          geometry: { type: 'polygon', points: parkPts },
          style: { fillColor: 'rgba(34, 197, 94, 0.25)', borderColor: '#22c55e', lineWidth: 2 },
          properties: { category: 'park' },
          createdAt: nowIso(),
          updatedAt: nowIso(),
          zIndex: 1
        });

        // Trees inside park
        for (let tx = blk.x1 + 4; tx < blk.x2 - 4; tx += 10) {
          for (let ty = blk.y1 + 4; ty < blk.y2 - 4; ty += 10) {
            features.push({
              id: createId('feature'),
              layerId: parkLayer.id,
              name: 'Park Tree',
              geometry: { type: 'symbol', point: { x: tx + Math.random()*2, y: ty + Math.random()*2 }, symbolType: 'tree', size: 12 },
              style: { borderColor: '#166534' },
              properties: {},
              createdAt: nowIso(),
              updatedAt: nowIso(),
              zIndex: 3
            });
          }
        }
      } 
      else if (blk.type === 'utility') {
        const parkPts = [
          { x: blk.x1, y: blk.y1 },
          { x: blk.x2, y: blk.y1 },
          { x: blk.x2, y: blk.y2 },
          { x: blk.x1, y: blk.y2 }
        ];
        const utilityName = settings.temple ? 'Community Temple 🛕' : (settings.mosque ? 'Community Mosque 🕌' : 'Community Utility Block');
        const symbolType = settings.temple ? 'temple' : (settings.mosque ? 'mosque' : 'school');

        features.push({
          id: createId('feature'),
          layerId: utilityLayer.id,
          name: utilityName,
          geometry: { type: 'polygon', points: parkPts },
          style: { fillColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', lineWidth: 2 },
          properties: { category: 'utility' },
          createdAt: nowIso(),
          updatedAt: nowIso(),
          zIndex: 1
        });

        features.push({
          id: createId('feature'),
          layerId: utilityLayer.id,
          name: `${utilityName} Icon`,
          geometry: { type: 'symbol', point: { x: (blk.x1 + blk.x2) / 2, y: (blk.y1 + blk.y2) / 2 }, symbolType, size: 24 },
          style: { borderColor: '#ef4444' },
          properties: { category: 'utility' },
          createdAt: nowIso(),
          updatedAt: nowIso(),
          zIndex: 3
        });
      }
      else if (blk.type === 'commercial') {
        const shopWidth = 6.0;
        const numShops = Math.floor(blockW / shopWidth);
        const actualShopW = blockW / numShops;

        for (let i = 0; i < numShops; i++) {
          const sx1 = blk.x1 + i * actualShopW;
          const sx2 = sx1 + actualShopW;
          const shopPts = [
            { x: sx1, y: blk.y1 },
            { x: sx2, y: blk.y1 },
            { x: sx2, y: blk.y2 },
            { x: sx1, y: blk.y2 }
          ];
          features.push({
            id: createId('feature'),
            layerId: plotsLayer.id,
            name: `Shop ${shopCounter}`,
            geometry: { type: 'polygon', points: shopPts },
            style: { fillColor: 'rgba(14, 165, 233, 0.18)', borderColor: '#0ea5e9', lineWidth: 1.5 },
            properties: { 
              category: 'commercial', 
              plotNumber: `S-${shopCounter}`, 
              status: 'available' 
            },
            createdAt: nowIso(),
            updatedAt: nowIso(),
            zIndex: 2
          });
          shopCounter++;
        }
      }
      else {
        // Residential plots
        const rowDep = blockH / 2;
        const targetPlotW = plotAreaSqm / rowDep;
        const numPlots = Math.floor(blockW / targetPlotW);
        const actualPlotW = blockW / numPlots;

        const rows = [
          { y1: blk.y1, y2: blk.y1 + rowDep },
          { y1: blk.y1 + rowDep, y2: blk.y2 }
        ];

        rows.forEach((row, rowIdx) => {
          for (let i = 0; i < numPlots; i++) {
            const px1 = blk.x1 + i * actualPlotW;
            const px2 = px1 + actualPlotW;
            const plotPts = [
              { x: px1, y: row.y1 },
              { x: px2, y: row.y1 },
              { x: px2, y: row.y2 },
              { x: px1, y: row.y2 }
            ];

            const isCorner = (i === 0 || i === numPlots - 1) && settings.cornerPlot;

            features.push({
              id: createId('feature'),
              layerId: plotsLayer.id,
              name: `Plot ${plotCounter}`,
              geometry: { type: 'polygon', points: plotPts },
              style: { 
                fillColor: isCorner ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)',
                borderColor: isCorner ? '#fb923c' : '#64748b',
                lineWidth: isCorner ? 1.8 : 1.2
              },
              properties: { 
                category: 'residential', 
                plotNumber: `${plotCounter}`, 
                status: 'available',
                remarks: isCorner ? 'Corner Plot' : 'Residential Plot'
              },
              createdAt: nowIso(),
              updatedAt: nowIso(),
              zIndex: 2
            });

            // Houses footprint placement
            if (settings.houses) {
              const insetX = 1.2;
              const insetY = 1.5;
              const hx1 = px1 + insetX;
              const hx2 = px2 - insetX;
              const hy1 = row.y1 + (rowIdx === 0 ? insetY * 1.5 : insetY);
              const hy2 = row.y2 - (rowIdx === 0 ? insetY : insetY * 1.5);
              
              if (hx2 - hx1 > 3 && hy2 - hy1 > 3) {
                features.push({
                  id: createId('feature'),
                  layerId: plotsLayer.id,
                  name: `House footprint ${plotCounter}`,
                  geometry: { type: 'polygon', points: [
                    { x: hx1, y: hy1 }, { x: hx2, y: hy1 }, { x: hx2, y: hy2 }, { x: hx1, y: hy2 }
                  ]},
                  style: { fillColor: 'rgba(244, 63, 94, 0.04)', borderColor: 'rgba(244, 63, 94, 0.3)', lineWidth: 1, lineStyle: 'dashed' },
                  properties: { plotNumber: `${plotCounter}` },
                  createdAt: nowIso(),
                  updatedAt: nowIso(),
                  zIndex: 3
                });
              }
            }

            plotCounter++;
          }
        });
      }
    });

    // Street plantation & poles
    verticalRoadXCoords.forEach((x) => {
      for (let y = 12; y < H - 12; y += 22) {
        if (Math.abs(y - yMain) < mainRoadWidth) continue;

        // Tree
        features.push({
          id: createId('feature'),
          layerId: parkLayer.id,
          name: 'Avenue Tree',
          geometry: { type: 'symbol', point: { x: x - internalRoadWidth/2 - 1.5, y }, symbolType: 'tree', size: 10 },
          style: { borderColor: '#22c55e' },
          properties: {},
          createdAt: nowIso(),
          updatedAt: nowIso(),
          zIndex: 3
        });

        // Pole
        features.push({
          id: createId('feature'),
          layerId: utilityLayer.id,
          name: 'Street Pole',
          geometry: { type: 'symbol', point: { x: x + internalRoadWidth/2 + 1.5, y }, symbolType: 'pole', size: 8 },
          style: { borderColor: '#eab308' },
          properties: {},
          createdAt: nowIso(),
          updatedAt: nowIso(),
          zIndex: 3
        });

        // Drains
        if (settings.drains) {
          features.push({
            id: createId('feature'),
            layerId: utilityLayer.id,
            name: 'Storm Drain Line',
            geometry: { type: 'polyline', points: [{ x: x - internalRoadWidth/2 - 0.5, y: 0 }, { x: x - internalRoadWidth/2 - 0.5, y: H }] },
            style: { borderColor: '#1e3a8a', lineWidth: 0.8 },
            properties: {},
            createdAt: nowIso(),
            updatedAt: nowIso(),
            zIndex: 1
          });
        }
      }
    });

    // Security entry gates
    features.push({
      id: createId('feature'),
      layerId: utilityLayer.id,
      name: 'Main Colony Entry Gate 🚧',
      geometry: { type: 'symbol', point: { x: 5, y: yMain }, symbolType: 'gate', size: 16 },
      style: { borderColor: '#f43f5e' },
      properties: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
      zIndex: 4
    });

    onCommitLayout(features);
    onClose();
  };

  return (
    <div className="print-dialog-overlay" style={{ background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="print-dialog" style={{ width: '800px', display: 'flex', flexDirection: 'column', height: '620px' }}>
        <div className="print-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🤖 SMART AI LAND LAYOUT GENERATOR</span>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div className="print-dialog-body" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', overflowY: 'auto' }}>
          {/* Left panel: Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '10px' }}>
            <h4 style={{ color: '#fb923c', borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '4px' }}>
              📍 Land & Plot Parameters
            </h4>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Total Land Size</label>
                <input 
                  type="number" 
                  className="prop-input" 
                  style={{ width: '100%' }}
                  value={settings.landSize} 
                  onChange={(e) => setSettings({ ...settings, landSize: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Unit</label>
                <select 
                  className="prop-select" 
                  value={settings.landUnit} 
                  onChange={(e) => setSettings({ ...settings, landUnit: e.target.value })}
                >
                  {Object.keys(UNIT_LABELS).map(k => (
                    <option key={k} value={k}>{UNIT_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Target Plot Size</label>
                <input 
                  type="number" 
                  className="prop-input" 
                  style={{ width: '100%' }}
                  value={settings.plotSize} 
                  onChange={(e) => setSettings({ ...settings, plotSize: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Unit</label>
                <select 
                  className="prop-select" 
                  value={settings.plotUnit} 
                  onChange={(e) => setSettings({ ...settings, plotUnit: e.target.value })}
                >
                  <option value="gaj">Gaj</option>
                  <option value="sqft">Sq Ft</option>
                  <option value="sqm">Sq Meter</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="cornerCheck"
                checked={settings.cornerPlot} 
                onChange={(e) => setSettings({ ...settings, cornerPlot: e.target.checked })} 
              />
              <label htmlFor="cornerCheck" style={{ fontSize: '12px' }}>Highlight Corner Plots 🟨</label>
            </div>

            <h4 style={{ color: '#fb923c', borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '4px', marginTop: '8px' }}>
              🛣️ Road & Infrastructure
            </h4>

            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Main Road Width</label>
              <select 
                className="prop-select" 
                style={{ width: '100%' }}
                value={settings.roadWidth} 
                onChange={(e) => setSettings({ ...settings, roadWidth: parseInt(e.target.value) })}
              >
                <option value="15">15 Ft (Minor)</option>
                <option value="20">20 Ft (Standard)</option>
                <option value="25">25 Ft (Colony Arterial)</option>
                <option value="30">30 Ft (Main Boulevard)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={settings.laneMarking} onChange={e => setSettings({ ...settings, laneMarking: e.target.checked })} />
                Lane Marking
              </label>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={settings.drains} onChange={e => setSettings({ ...settings, drains: e.target.checked })} />
                Storm Drains
              </label>
            </div>

            <h4 style={{ color: '#fb923c', borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '4px', marginTop: '8px' }}>
              🏡 Zoning & Reserve Areas
            </h4>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Park Reservation</label>
                <select 
                  className="prop-select" 
                  value={settings.parkPercentage} 
                  onChange={(e) => setSettings({ ...settings, parkPercentage: parseInt(e.target.value) })}
                >
                  <option value="5">5% Park</option>
                  <option value="10">10% Park</option>
                  <option value="15">15% Park</option>
                  <option value="20">20% Park</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Commercial Shops</label>
                <select 
                  className="prop-select" 
                  value={settings.commercialPercentage} 
                  onChange={(e) => setSettings({ ...settings, commercialPercentage: parseInt(e.target.value) })}
                >
                  <option value="5">5% Shops</option>
                  <option value="10">10% Shops</option>
                  <option value="15">15% Shops</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={settings.houses} onChange={e => setSettings({ ...settings, houses: e.target.checked })} />
                Place House Footprints
              </label>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={settings.temple} onChange={e => setSettings({ ...settings, temple: e.target.checked, mosque: false })} />
                Include Temple
              </label>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="checkbox" checked={settings.mosque} onChange={e => setSettings({ ...settings, mosque: e.target.checked, temple: false })} />
                Include Mosque
              </label>
            </div>
          </div>

          {/* Right panel: Live calculation summary */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: '#14b8a6', borderBottom: '1px solid rgba(148,163,184,0.12)', paddingBottom: '4px' }}>
              📊 Real-time CAD Calculations
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Total Land Area:</span>
                <span style={{ fontWeight: 'bold' }}>{metrics.totalAreaSqm.toLocaleString()} sqm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Road Reservation Area:</span>
                <span>{metrics.roadAreaSqm.toLocaleString()} sqm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Park Reservation (Green):</span>
                <span>{metrics.parkAreaSqm.toLocaleString()} sqm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Commercial Zoning (Shops):</span>
                <span>{metrics.commercialAreaSqm.toLocaleString()} sqm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px dashed rgba(148,163,184,0.12)', paddingTop: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Net Residential Plot Area:</span>
                <span style={{ color: '#14b8a6', fontWeight: 600 }}>{metrics.residentialAreaSqm.toLocaleString()} sqm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Remaining Open Spaces:</span>
                <span>{metrics.remainingAreaSqm.toLocaleString()} sqm</span>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>MAXIMIZED YIELD</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#14b8a6' }}>{metrics.estimatedPlots}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Residential Plots Generated</div>
            </div>
          </div>
        </div>

        <div className="print-dialog-footer">
          <button className="print-dialog-btn" onClick={onClose}>Cancel</button>
          <button 
            className="print-dialog-btn print-dialog-btn-primary" 
            style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleGenerate}
          >
            ⚡ Generate Colony Layout
          </button>
        </div>
      </div>
    </div>
  );
};
