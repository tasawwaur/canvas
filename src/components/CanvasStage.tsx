import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Point, Viewport, Tool, Layer, Feature, DraftState, 
  ProjectSettings, Geometry, SymbolType 
} from '../types';
import { 
  createId, distance, normalizeRectangle, hitTestGeometry, 
  translateGeometry, toPolygonPoints, polygonIsClosedEnough, 
  roundTo, centroid, areaOfPolygon, splitPolygonByLine, boundsOfPoints,
  geometryBounds
} from '../lib/geometry';
import { formatArea, formatLength } from '../lib/units';

class ImageCache {
  private static cache: Record<string, HTMLImageElement> = {};
  private static loading: Record<string, boolean> = {};

  static get(src: string): HTMLImageElement | null {
    const img = this.cache[src];
    if (img && img.complete) return img;
    return null;
  }

  static load(src: string, onLoad: () => void): void {
    if (this.loading[src]) return;
    this.loading[src] = true;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      this.cache[src] = img;
      this.loading[src] = false;
      onLoad();
    };
    img.onerror = () => {
      this.loading[src] = false;
    };
  }
}
const convertToMeters = (val: number, unit: string): number => {
  const rates: Record<string, number> = {
    ft: 0.3048,
    gaj: 0.9144,
    yd: 0.9144,
    m: 1.0,
    meter: 1.0
  };
  return val * (rates[unit.toLowerCase()] || 1.0);
};

type CanvasStageProps = {
  layers: Layer[];
  features: Feature[];
  viewport: Viewport;
  tool: Tool;
  activeLayerId: string;
  selectedFeatureId: string | null;
  selectedFeatureIds?: string[];
  draft: DraftState;
  settings: ProjectSettings;
  onViewportChange: (viewport: Viewport) => void;
  onSelectFeature: (id: string | null) => void;
  onCommitFeature: (feature: Feature) => void;
  onUpdateFeature: (id: string | string[], updater: (f: Feature) => Feature) => void;
  onCursorMove: (point: Point | null) => void;
  onDraftChange: (draft: DraftState) => void;
  onFinishDraft: () => void;
  onCancelDraft: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onMerge?: () => void;
  onExportCropArea?: (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => void;
  activeEmoji?: string;
  boundaryPlacement?: {
    width: number;
    height: number;
    unit: string;
    type: 'plot' | 'colony';
  } | null;
};

export const CanvasStage: React.FC<CanvasStageProps> = (props) => {
  const {
    layers, features, viewport, tool, activeLayerId, selectedFeatureId, selectedFeatureIds,
    draft, settings, onViewportChange, onSelectFeature, onCommitFeature,
    onUpdateFeature, onCursorMove, onDraftChange, onFinishDraft,
    onCancelDraft, onCanvasReady, onMerge, onExportCropArea, activeEmoji = '🚧',
    boundaryPlacement
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  
  const [isPanning, setIsPanning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, show: boolean } | null>(null);
  const [reshapeFeatureId, setReshapeFeatureId] = useState<string | null>(null);
  const [toolSize, setToolSize] = useState<number>(30);
  const toolSizeRef = useRef<number>(30);
  const activeVertexIndexRef = useRef<number | null>(null);
  const resizeRef = useRef<{ featureId: string; handle: string; startPt: Point; origGeom: any } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);
  
  const lastMousePos = useRef<Point | null>(null);
  const draftRef = useRef(draft);
  const viewportRef = useRef(viewport);
  const featuresRef = useRef(features);
  const layersRef = useRef(layers);
  const selectedFeatureIdRef = useRef(selectedFeatureId);
  const selectedFeatureIdsRef = useRef(selectedFeatureIds || []);
  const settingsRef = useRef(settings);
  const currentCursorRef = useRef<Point | null>(null);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { featuresRef.current = features; }, [features]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { selectedFeatureIdRef.current = selectedFeatureId; }, [selectedFeatureId]);
  useEffect(() => { selectedFeatureIdsRef.current = selectedFeatureIds || []; }, [selectedFeatureIds]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const screenToWorld = useCallback((sx: number, sy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const vp = viewportRef.current;
    const cw = canvas.width / 2;
    const ch = canvas.height / 2;
    return {
      x: (sx - cw) / vp.scale + vp.x,
      y: (sy - ch) / vp.scale + vp.y
    };
  }, []);

  const worldToScreen = useCallback((wx: number, wy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const vp = viewportRef.current;
    const cw = canvas.width / 2;
    const ch = canvas.height / 2;
    return {
      x: (wx - vp.x) * vp.scale + cw,
      y: (wy - vp.y) * vp.scale + ch
    };
  }, []);

  const snapPoint = useCallback((pt: Point): Point => {
    // simplified snap for brevity, would check grid & endpoints based on settingsRef.current.snapModes
    let snapped = { ...pt };
    const s = settingsRef.current;
    if (s.snapModes.includes("grid")) {
      const g = s.gridSize;
      snapped.x = Math.round(pt.x / g) * g;
      snapped.y = Math.round(pt.y / g) * g;
    }
    // basic endpoint snap loop... (skipped full implementation for space)
    return snapped;
  }, []);

  const drawSymbol = (ctx: CanvasRenderingContext2D, type: SymbolType, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2 / viewportRef.current.scale;
    
    ctx.beginPath();
    switch(type) {
      case 'gate':
        ctx.strokeRect(-size/2, -size/2, size, size);
        ctx.clearRect(-size/4, -size/2 - 1, size/2, 2);
        break;
      case 'tree':
        ctx.moveTo(0, size/2);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -size/4, size/2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'pole':
        ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0);
        ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2);
        ctx.stroke();
        break;
      case 'waterTank':
        ctx.arc(0, 0, size/2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size/3, -size/4); ctx.lineTo(size/3, -size/4);
        ctx.moveTo(-size/2.5, 0); ctx.lineTo(size/2.5, 0);
        ctx.moveTo(-size/3, size/4); ctx.lineTo(size/3, size/4);
        ctx.stroke();
        break;
      case 'park':
        ctx.arc(-size/4, size/4, size/3, 0, Math.PI*2);
        ctx.arc(size/4, size/4, size/3, 0, Math.PI*2);
        ctx.arc(0, -size/4, size/2.5, 0, Math.PI*2);
        ctx.stroke();
        break;
      case 'school':
        ctx.strokeRect(-size/2, -size/4, size, size/1.5);
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/4); ctx.lineTo(0, -size/1.5); ctx.lineTo(size/2, -size/4);
        ctx.stroke();
        break;
      case 'temple':
        ctx.moveTo(-size/2, size/2); ctx.lineTo(0, -size/2); ctx.lineTo(size/2, size/2); ctx.closePath();
        ctx.stroke();
        break;
      case 'mosque':
        ctx.arc(0, 0, size/2, Math.PI, 0);
        ctx.stroke();
        break;
      default:
        ctx.font = `${size}px Inter, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type, 0, 0);
        break;
    }
    ctx.restore();
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp = viewportRef.current;
    const w = canvas.width;
    const h = canvas.height;

    // 1. Clear
    ctx.clearRect(0, 0, w, h);

    // 2. Background
    const bgColor = settingsRef.current.backgroundColor || '#0a0f1e';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    
    // 3. Transform
    ctx.translate(w / 2, h / 2);
    ctx.scale(vp.scale, vp.scale);
    ctx.translate(-vp.x, -vp.y);

    // 4. Grid
    if (settingsRef.current.showGrid) {
      const gridSize = settingsRef.current.gridSize;
      const left = vp.x - w / 2 / vp.scale;
      const right = vp.x + w / 2 / vp.scale;
      const top = vp.y - h / 2 / vp.scale;
      const bottom = vp.y + h / 2 / vp.scale;

      const startX = Math.floor(left / gridSize) * gridSize;
      const startY = Math.floor(top / gridSize) * gridSize;

      ctx.lineWidth = 1 / vp.scale;
      for (let x = startX; x <= right; x += gridSize) {
        ctx.strokeStyle = Math.abs(x % (gridSize * 5)) < 0.001 ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.07)';
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      }
      for (let y = startY; y <= bottom; y += gridSize) {
        ctx.strokeStyle = Math.abs(y % (gridSize * 5)) < 0.001 ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.07)';
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      }
    }

    // 5. Features
    const sortedFeatures = [...featuresRef.current].sort((a, b) => {
      const lA = layersRef.current.find(l => l.id === a.layerId);
      const lB = layersRef.current.find(l => l.id === b.layerId);
      if (lA && lB && lA.order !== lB.order) return lA.order - lB.order;
      return a.zIndex - b.zIndex;
    });

    for (const f of sortedFeatures) {
      const layer = layersRef.current.find(l => l.id === f.layerId);
      if (!layer || !layer.visible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity * (f.style.fillOpacity ?? 1);
      ctx.strokeStyle = f.style.borderColor || layer.color;
      ctx.fillStyle = f.style.fillColor || layer.color;
      ctx.lineWidth = (f.style.lineWidth || layer.lineWidth) / vp.scale;
      
      const lineStyle = f.style.lineStyle || layer.lineStyle;
      if (lineStyle === 'dashed') ctx.setLineDash([12 / vp.scale, 8 / vp.scale]);
      else if (lineStyle === 'dotted') ctx.setLineDash([3 / vp.scale, 8 / vp.scale]);
      else ctx.setLineDash([]);

      if (f.properties.status === 'available') {
        ctx.fillStyle = 'rgba(34,197,94,0.15)';
      } else if (f.properties.status === 'sold') {
        ctx.fillStyle = 'rgba(239,68,68,0.15)';
      } else if (f.properties.status === 'booked') {
        ctx.fillStyle = 'rgba(249,115,22,0.15)';
      }

      ctx.beginPath();
      const geom = f.geometry;
      if (geom.type === 'line') {
        ctx.moveTo(geom.points[0].x, geom.points[0].y);
        ctx.lineTo(geom.points[1].x, geom.points[1].y);
        ctx.stroke();
      } else if (geom.type === 'rectangle') {
        ctx.rect(geom.origin.x, geom.origin.y, geom.width, geom.height);
        ctx.fill(); ctx.stroke();
        if (f.name.toLowerCase().includes('house') || f.name.toLowerCase().includes('footprint')) {
          ctx.save();
          ctx.strokeStyle = f.style.borderColor || 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1.0 / vp.scale;
          const r1 = { x: geom.origin.x, y: geom.origin.y };
          const r2 = { x: geom.origin.x + geom.width, y: geom.origin.y };
          const r3 = { x: geom.origin.x + geom.width, y: geom.origin.y + geom.height };
          const r4 = { x: geom.origin.x, y: geom.origin.y + geom.height };
          const center = { x: geom.origin.x + geom.width/2, y: geom.origin.y + geom.height/2 };
          const ridgeW = geom.width * 0.4;
          const rd1 = { x: center.x - ridgeW/2, y: center.y };
          const rd2 = { x: center.x + ridgeW/2, y: center.y };
          ctx.beginPath();
          ctx.moveTo(rd1.x, rd1.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.moveTo(r1.x, r1.y); ctx.lineTo(rd1.x, rd1.y);
          ctx.moveTo(r4.x, r4.y); ctx.lineTo(rd1.x, rd1.y);
          ctx.moveTo(r2.x, r2.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.moveTo(r3.x, r3.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.stroke();
          ctx.restore();
        }
      } else if (geom.type === 'circle') {
        ctx.arc(geom.center.x, geom.center.y, geom.radius, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (geom.type === 'polyline' || geom.type === 'polygon') {
        const isRoad = geom.type === 'polyline' && (f.properties?.roadWidth !== undefined || f.name.toLowerCase().includes('road'));
        if (isRoad) {
          ctx.save();
          // Only yellow dashed line — no dark background
          ctx.beginPath();
          ctx.moveTo(geom.points[0].x, geom.points[0].y);
          for (let i = 1; i < geom.points.length; i++) {
            ctx.lineTo(geom.points[i].x, geom.points[i].y);
          }
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = Math.max(1, 2 / vp.scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([8 / vp.scale, 8 / vp.scale]);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.moveTo(geom.points[0].x, geom.points[0].y);
          for (let i = 1; i < geom.points.length; i++) ctx.lineTo(geom.points[i].x, geom.points[i].y);
          if (geom.type === 'polygon') ctx.closePath();
          if (geom.type === 'polygon') ctx.fill();
          ctx.stroke();
        }
        if (geom.type === 'polygon' && geom.points.length === 4 && (f.name.toLowerCase().includes('house') || f.name.toLowerCase().includes('footprint'))) {
          ctx.save();
          ctx.strokeStyle = f.style.borderColor || 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1.0 / vp.scale;
          const [p1, p2, p3, p4] = geom.points;
          const midTop = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
          const midBottom = { x: (p3.x + p4.x)/2, y: (p3.y + p4.y)/2 };
          const center = { x: (midTop.x + midBottom.x)/2, y: (midTop.y + midBottom.y)/2 };
          const dx = distance(p1, p2);
          const ridgeW = dx * 0.4;
          const rd1 = { x: center.x - ridgeW/2, y: center.y };
          const rd2 = { x: center.x + ridgeW/2, y: center.y };
          ctx.beginPath();
          ctx.moveTo(rd1.x, rd1.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(rd1.x, rd1.y);
          ctx.moveTo(p4.x, p4.y); ctx.lineTo(rd1.x, rd1.y);
          ctx.moveTo(p2.x, p2.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.moveTo(p3.x, p3.y); ctx.lineTo(rd2.x, rd2.y);
          ctx.stroke();
          ctx.restore();
        }
      } else if (geom.type === 'symbol') {
        drawSymbol(ctx, geom.symbolType, geom.point.x, geom.point.y, geom.size, ctx.strokeStyle as string);
      } else if (geom.type === 'label' && vp.scale >= 0.3) {
        const fontSize = (f.style as any).fontSize || settingsRef.current.labelFontSize || 12;
        ctx.font = `${fontSize / vp.scale}px Inter`;
        ctx.fillStyle = f.style.fillColor || '#fff';
        ctx.fillText(geom.text, geom.point.x, geom.point.y);
      } else if (geom.type === 'image') {
        const img = ImageCache.get(geom.src);
        if (img) {
          ctx.save();
          ctx.translate(geom.origin.x + geom.width / 2, geom.origin.y + geom.height / 2);
          if (f.rotation) ctx.rotate(f.rotation * Math.PI / 180);
          const s = f.scale ?? 1;
          ctx.scale(s, s);
          ctx.globalAlpha = layer.opacity * (f.style.fillOpacity ?? 1);
          
          ctx.drawImage(img, -geom.width / 2, -geom.height / 2, geom.width, geom.height);
          
          if (selectedFeatureIdsRef.current.includes(f.id)) {
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 1.5 / vp.scale;
            ctx.setLineDash([4 / vp.scale, 4 / vp.scale]);
            ctx.strokeRect(-geom.width / 2, -geom.height / 2, geom.width, geom.height);
          }
          ctx.restore();
        } else {
          ImageCache.load(geom.src, () => {});
        }
      }
      
      // Auto Area Labels for Polygons and Rectangles (LOD Culling: only show when zoomed in)
      if (vp.scale >= 0.5 && (geom.type === 'polygon' || geom.type === 'rectangle')) {
        const pts = toPolygonPoints(geom);
        if (pts.length >= 3) {
          const ctr = centroid(pts);
          const areaVal = areaOfPolygon(pts);
          
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#070d1a';
          
          // Calculate proportional font size in world space based on shape bounds
          const bounds = boundsOfPoints(pts);
          const worldFontSize = Math.min(1.8, bounds.width / 6.5, bounds.height / 5.0);
          ctx.font = `bold ${worldFontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const yOffset = worldFontSize * 0.7;
          ctx.lineWidth = worldFontSize * 0.15;

          const mockSettings = {
            units: settingsRef.current.units,
            bighaSqM: settingsRef.current.bighaSqM || 2529.0,
            biswaSqM: (settingsRef.current.bighaSqM || 2529.0) / 20,
            marlaSqM: settingsRef.current.marlaSqM || 25.2929,
            kanalSqM: settingsRef.current.kanalSqM || 505.857
          };
          const areaLabelText = formatArea(areaVal, mockSettings as any);
          
          const text1 = f.name;
          const text2 = areaLabelText;
          
          ctx.strokeText(text1, ctr.x, ctr.y - yOffset);
          ctx.fillText(text1, ctr.x, ctr.y - yOffset);
          ctx.strokeText(text2, ctr.x, ctr.y + yOffset);
          ctx.fillText(text2, ctr.x, ctr.y + yOffset);
          ctx.restore();
        }
      }

      ctx.restore();

      // 6. Dimensions
      if (settingsRef.current.showDimensions && selectedFeatureIdsRef.current.includes(f.id) && vp.scale >= 0.4) {
        ctx.save();
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${12 / vp.scale}px Inter`;
        ctx.textAlign = 'center';
        
        let pts: Point[] = [];
        if (geom.type === 'line') pts = geom.points;
        else if (geom.type === 'polyline') pts = geom.points;
        else if (geom.type === 'polygon') pts = [...geom.points, geom.points[0]];
        else if (geom.type === 'rectangle') pts = toPolygonPoints(geom);

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i+1];
          const dist = distance(p1, p2);
          const mid = { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 };
          const angle = Math.atan2(p2.y-p1.y, p2.x-p1.x);
          
          ctx.save();
          ctx.translate(mid.x, mid.y);
          if (angle > Math.PI/2 || angle < -Math.PI/2) ctx.rotate(angle + Math.PI);
          else ctx.rotate(angle);
          ctx.fillText(roundTo(dist, 2).toString(), 0, -5 / vp.scale);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // 7. Selection (Multiple)
    if (selectedFeatureIdsRef.current.length > 0) {
      selectedFeatureIdsRef.current.forEach(id => {
        const selF = featuresRef.current.find(f => f.id === id);
        if (!selF) return;
        ctx.save();
        ctx.strokeStyle = '#fb923c'; // amber selection color
        ctx.lineWidth = 2 / vp.scale;
        ctx.setLineDash([6 / vp.scale, 6 / vp.scale]);
        
        const geom = selF.geometry;
        ctx.beginPath();
        if (geom.type === 'line') {
          ctx.moveTo(geom.points[0].x, geom.points[0].y); ctx.lineTo(geom.points[1].x, geom.points[1].y);
        } else if (geom.type === 'rectangle') {
          ctx.rect(geom.origin.x, geom.origin.y, geom.width, geom.height);
        } else if (geom.type === 'circle') {
          ctx.arc(geom.center.x, geom.center.y, geom.radius, 0, Math.PI * 2);
        } else if (geom.type === 'polyline' || geom.type === 'polygon') {
          ctx.moveTo(geom.points[0].x, geom.points[0].y);
          for (let i = 1; i < geom.points.length; i++) ctx.lineTo(geom.points[i].x, geom.points[i].y);
          if (geom.type === 'polygon') ctx.closePath();
        } else if (geom.type === 'symbol' || geom.type === 'point' || geom.type === 'label') {
          ctx.arc(geom.point.x, geom.point.y, 8 / vp.scale, 0, Math.PI * 2);
        }
        ctx.stroke();
        
        // Handles
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1 / vp.scale;
        ctx.setLineDash([]);
        const hs = 6 / vp.scale;
        const drawHandle = (p: Point) => {
          ctx.fillRect(p.x - hs/2, p.y - hs/2, hs, hs);
          ctx.strokeRect(p.x - hs/2, p.y - hs/2, hs, hs);
        };
        
        if (geom.type === 'line') { drawHandle(geom.points[0]); drawHandle(geom.points[1]); }
        else if (geom.type === 'rectangle') {
          toPolygonPoints(geom).forEach(drawHandle);
        }
        else if (geom.type === 'polyline' || geom.type === 'polygon') {
          geom.points.forEach(drawHandle);
        }
        else if (geom.type === 'symbol' || geom.type === 'point' || geom.type === 'label') {
          drawHandle(geom.point);
        }
        
        // 8-direction resize handles for ANY selected feature
        const bb = geometryBounds(geom);
        if (bb.minX !== Infinity && bb.maxX !== -Infinity) {
          const ox = bb.minX, oy = bb.minY, w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
          if (w > 0.1 || h > 0.1) {
            const rhs = 8 / vp.scale;
            ctx.fillStyle = '#0ea5e9';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5 / vp.scale;
            const resizeHandles = [
              { x: ox, y: oy },           // TL
              { x: ox + w/2, y: oy },     // TC
              { x: ox + w, y: oy },       // TR
              { x: ox + w, y: oy + h/2 }, // MR
              { x: ox + w, y: oy + h },   // BR
              { x: ox + w/2, y: oy + h }, // BC
              { x: ox, y: oy + h },       // BL
              { x: ox, y: oy + h/2 },     // ML
            ];
            resizeHandles.forEach(rp => {
              ctx.fillRect(rp.x - rhs/2, rp.y - rhs/2, rhs, rhs);
              ctx.strokeRect(rp.x - rhs/2, rp.y - rhs/2, rhs, rhs);
            });
          }
        }

        ctx.restore();
      });
    }

    // 7.5. Reshaping/Node Editing Handles
    if (reshapeFeatureId) {
      const rf = featuresRef.current.find(f => f.id === reshapeFeatureId);
      if (rf) {
        ctx.save();
        ctx.strokeStyle = '#0ea5e9'; // Theme color for reshape
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 2 / vp.scale;
        const hs = 10 / vp.scale;
        
        let pts: Point[] = [];
        const geom = rf.geometry;
        if (geom.type === 'line' || geom.type === 'polyline' || geom.type === 'polygon') {
          pts = geom.points;
        } else if (geom.type === 'rectangle' || geom.type === 'image') {
          pts = toPolygonPoints(geom);
        } else if (geom.type === 'circle') {
          pts = [geom.center, { x: geom.center.x + geom.radius, y: geom.center.y }];
        } else if (geom.type === 'arrow') {
          pts = [geom.start, geom.end];
        }
        
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, hs / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    // 8. Draft Preview
    const d = draftRef.current;
    if (d) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 / vp.scale;
      ctx.setLineDash([5 / vp.scale, 5 / vp.scale]);
      
      ctx.beginPath();
      if ('start' in d && 'current' in d) {
        if (d.tool === 'line') {
          ctx.moveTo(d.start.x, d.start.y); ctx.lineTo(d.current.x, d.current.y);
        } else if (d.tool === 'divider') {
          // Bright red line for divider
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2 / vp.scale;
          ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
          ctx.beginPath();
          ctx.moveTo(d.start.x, d.start.y); ctx.lineTo(d.current.x, d.current.y);
          ctx.stroke();
          ctx.restore();
        } else if (d.tool === 'arrow') {
          // Draw arrow preview with head
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.fillStyle = '#f59e0b';
          ctx.lineWidth = 2 / vp.scale;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(d.start.x, d.start.y); ctx.lineTo(d.current.x, d.current.y);
          ctx.stroke();
          // Arrow head
          const ang = Math.atan2(d.current.y - d.start.y, d.current.x - d.start.x);
          const hs = 12 / vp.scale;
          ctx.beginPath();
          ctx.moveTo(d.current.x, d.current.y);
          ctx.lineTo(d.current.x - hs * Math.cos(ang - 0.4), d.current.y - hs * Math.sin(ang - 0.4));
          ctx.lineTo(d.current.x - hs * Math.cos(ang + 0.4), d.current.y - hs * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (d.tool === 'rectangle') {
          const rect = normalizeRectangle(d.start, d.current);
          ctx.rect(rect.origin.x, rect.origin.y, rect.width, rect.height);
        } else if (d.tool === 'exportCrop') {
          const rect = normalizeRectangle(d.start, d.current);
          ctx.save();
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.5 / vp.scale;
          ctx.setLineDash([8 / vp.scale, 4 / vp.scale]);
          ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
          ctx.beginPath();
          ctx.rect(rect.origin.x, rect.origin.y, rect.width, rect.height);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#22d3ee';
          ctx.font = `bold ${12 / vp.scale}px Inter, sans-serif`;
          ctx.fillText("EXPORT CROP AREA", rect.origin.x + 6 / vp.scale, rect.origin.y - 6 / vp.scale);
          ctx.restore();
          // Reset path so following strokes don't draw
          ctx.beginPath();
        } else if (d.tool === 'circle') {
          ctx.arc(d.start.x, d.start.y, distance(d.start, d.current), 0, Math.PI * 2);
        }
      } else if ('points' in d) {
        if (d.tool === 'road') {
          ctx.beginPath();
          ctx.moveTo(d.points[0].x, d.points[0].y);
          for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x, d.points[i].y);
          if (d.current) ctx.lineTo(d.current.x, d.current.y);

          ctx.save();
          // Only yellow dashed line — no background
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = Math.max(1, 2 / vp.scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.setLineDash([8 / vp.scale, 8 / vp.scale]);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.moveTo(d.points[0].x, d.points[0].y);
          for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x, d.points[i].y);
          if (d.current) ctx.lineTo(d.current.x, d.current.y);
        }
      }
      ctx.stroke();

      // Draw active measurement values next to the cursor/point
      if (d.tool === 'measure' && 'points' in d && d.points.length > 0) {
        let totalDistance = 0;
        for (let i = 0; i < d.points.length - 1; i++) {
          totalDistance += distance(d.points[i], d.points[i + 1]);
        }
        if (d.current) {
          totalDistance += distance(d.points[d.points.length - 1], d.current);
        }

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1 / vp.scale;
        ctx.font = `bold ${12 / vp.scale}px Inter, Arial`;
        const labelText = `Dist: ${roundTo(totalDistance, 2)} units`;
        const drawPt = d.current || d.points[d.points.length - 1];
        
        const pad = 6 / vp.scale;
        const textWidth = ctx.measureText(labelText).width;
        const rectX = drawPt.x + 12 / vp.scale;
        const rectY = drawPt.y - 20 / vp.scale;
        const rectW = textWidth + pad * 2;
        const rectH = 20 / vp.scale;
        
        ctx.beginPath();
        ctx.rect(rectX, rectY, rectW, rectH);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#f59e0b';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, rectX + pad, rectY + rectH / 2);
      }

      ctx.restore();
    }

    // 9. Snap Indicators
    if (currentCursorRef.current) {
      const snap = snapPoint(currentCursorRef.current);
      if (snap.x !== currentCursorRef.current.x || snap.y !== currentCursorRef.current.y) {
        ctx.save();
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2 / vp.scale;
        const ds = 8 / vp.scale;
        ctx.translate(snap.x, snap.y);
        ctx.beginPath();
        ctx.moveTo(0, -ds/2); ctx.lineTo(ds/2, 0); ctx.lineTo(0, ds/2); ctx.lineTo(-ds/2, 0); ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render crosshairs
    if (tool !== 'select' && tool !== 'pan' && currentCursorRef.current) {
      const snap = snapPoint(currentCursorRef.current);
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1 / vp.scale;
      ctx.setLineDash([4 / vp.scale, 4 / vp.scale]);
      ctx.beginPath();
      ctx.moveTo(vp.x - w / 2 / vp.scale, snap.y);
      ctx.lineTo(vp.x + w / 2 / vp.scale, snap.y);
      ctx.moveTo(snap.x, vp.y - h / 2 / vp.scale);
      ctx.lineTo(snap.x, vp.y + h / 2 / vp.scale);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();

    // 10. Rulers (Screen space)
    ctx.save();
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, 20);
    ctx.fillRect(0, 0, 20, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 20); ctx.lineTo(w, 20);
    ctx.moveTo(20, 0); ctx.lineTo(20, h);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 20; x < w; x += 50) {
      const worldPt = screenToWorld(x, 20);
      ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 20); ctx.stroke();
      ctx.fillText(worldPt.x.toFixed(0), x, 7);
    }

    ctx.textAlign = 'left';
    for (let y = 20; y < h; y += 50) {
      const worldPt = screenToWorld(20, y);
      ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(20, y); ctx.stroke();
      ctx.fillText(worldPt.y.toFixed(0), 2, y);
    }

    // Corner block
    ctx.fillStyle = '#070d1a';
    ctx.fillRect(0, 0, 20, 20);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.strokeRect(0, 0, 20, 20);
    ctx.restore();

    // 11. Scale Bar (Screen space)
    ctx.fillStyle = '#fff';
    ctx.font = '12px Inter';
    const scaleBarWidth = 100;
    const distanceVal = scaleBarWidth / vp.scale;
    ctx.fillText(`${roundTo(distanceVal, 1)} units`, w - 120, h - 30);
    ctx.fillRect(w - 120, h - 20, scaleBarWidth, 4);

    rafRef.current = requestAnimationFrame(render);
  }, [snapPoint]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            render();
          }
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [render]);

  useEffect(() => {
    if (canvasRef.current && onCanvasReady) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // Event handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    // Find feature under cursor to select on right click
    const pt = screenToWorld(offsetX, offsetY);
    let hitId = null;
    for (let i = features.length - 1; i >= 0; i--) {
      if (hitTestGeometry(features[i].geometry, pt, 12 / viewport.scale)) {
        hitId = features[i].id;
        break;
      }
    }
    if (hitId && !selectedFeatureIdsRef.current.includes(hitId)) {
      onSelectFeature(hitId);
    } else if (!hitId) {
      onSelectFeature(null);
    }
    
    setContextMenu({
      x: offsetX,
      y: offsetY,
      show: true
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.89 : 1.12;
      const newScale = Math.min(Math.max(viewportRef.current.scale * factor, 0.05), 50);
      
      const rect = canvas.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const cursor = screenToWorld(offsetX, offsetY);
      
      onViewportChange({
        x: cursor.x - (offsetX - canvas.width / 2) / newScale,
        y: cursor.y - (offsetY - canvas.height / 2) / newScale,
        scale: newScale
      });
    };

    canvas.addEventListener('wheel', handleWheelRaw, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelRaw);
    };
  }, [onViewportChange, screenToWorld]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const pt = screenToWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    const snapped = snapPoint(pt);
    lastMousePos.current = pt;

    if (reshapeFeatureId) {
      const f = featuresRef.current.find(feat => feat.id === reshapeFeatureId);
      if (f) {
        const geom = f.geometry;
        let pts: Point[] = [];
        if (geom.type === 'line' || geom.type === 'polyline' || geom.type === 'polygon') {
          pts = geom.points;
        } else if (geom.type === 'rectangle' || geom.type === 'image') {
          pts = toPolygonPoints(geom);
        } else if (geom.type === 'circle') {
          pts = [geom.center, { x: geom.center.x + geom.radius, y: geom.center.y }];
        } else if (geom.type === 'arrow') {
          pts = [geom.start, geom.end];
        }
        
        const hs = 12 / viewportRef.current.scale;
        const clickedIndex = pts.findIndex(p => distance(pt, p) <= hs);
        if (clickedIndex !== -1) {
          activeVertexIndexRef.current = clickedIndex;
          e.stopPropagation();
          return;
        }
      }
    }

    // Check resize handles on ANY selected feature
    if (selectedFeatureIdsRef.current.length === 1) {
      const selF = featuresRef.current.find(f => f.id === selectedFeatureIdsRef.current[0]);
      if (selF) {
        const bb = geometryBounds(selF.geometry);
        if (bb.minX !== Infinity && bb.maxX !== -Infinity) {
          const ox = bb.minX, oy = bb.minY, w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
          if (w > 0.1 || h > 0.1) {
            const rhs = 12 / viewportRef.current.scale;
            const handleNames = ['tl','tc','tr','mr','br','bc','bl','ml'];
            const handlePts = [
              { x: ox, y: oy },
              { x: ox + w/2, y: oy },
              { x: ox + w, y: oy },
              { x: ox + w, y: oy + h/2 },
              { x: ox + w, y: oy + h },
              { x: ox + w/2, y: oy + h },
              { x: ox, y: oy + h },
              { x: ox, y: oy + h/2 },
            ];
            for (let i = 0; i < handlePts.length; i++) {
              if (distance(pt, handlePts[i]) <= rhs) {
                resizeRef.current = {
                  featureId: selF.id,
                  handle: handleNames[i],
                  startPt: pt,
                  origGeom: JSON.parse(JSON.stringify({
                    geometry: selF.geometry,
                    bounds: { ox, oy, w, h }
                  }))
                };
                e.stopPropagation();
                return;
              }
            }
          }
        }
      }
    }

    if (e.button === 1 || tool === 'pan') {
      setIsPanning(true);
      return;
    }

    if (tool === 'select') {
      let hitId = null;
      for (let i = features.length - 1; i >= 0; i--) {
        if (hitTestGeometry(features[i].geometry, pt, 12 / viewport.scale)) {
          hitId = features[i].id;
          break;
        }
      }
      if (hitId) {
        onSelectFeature(hitId);
        setIsMoving(true);
      } else {
        onSelectFeature(null);
        onDraftChange({ tool: 'select', start: pt, current: pt });
      }
      return;
    }

    if (tool === 'emoji') {
      onCommitFeature({
        id: createId('feature'),
        layerId: activeLayerId,
        name: `Emoji: ${activeEmoji}`,
        zIndex: 0,
        geometry: { type: 'symbol', point: snapped, symbolType: activeEmoji, size: 28 },
        style: {},
        properties: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return;
    }

    if (tool === 'placeBoundary' && boundaryPlacement) {
      const { width, height, unit, type } = boundaryPlacement;
      const wMeters = convertToMeters(width, unit);
      const hMeters = convertToMeters(height, unit);
      const layerName = type === 'plot' ? 'plot' : 'boundary';
      const targetLayer = layers.find(l => l.name.toLowerCase().includes(layerName)) || layers[0];

      onCommitFeature({
        id: createId('feature'),
        layerId: targetLayer.id,
        name: type === 'plot' ? `Plot ${width}x${height} ${unit}` : `Colony ${width}x${height} ${unit}`,
        geometry: {
          type: 'rectangle',
          origin: { x: snapped.x - wMeters / 2, y: snapped.y - hMeters / 2 },
          width: wMeters,
          height: hMeters
        },
        style: type === 'plot'
          ? { fillColor: 'rgba(245, 158, 11, 0.05)', borderColor: '#fb923c', lineWidth: 1.5 }
          : { fillColor: 'rgba(255, 255, 255, 0.01)', borderColor: '#eab308', lineWidth: 3 },
        properties: {
          area: wMeters * hMeters,
          width,
          height,
          unit,
          type
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        zIndex: type === 'plot' ? 2 : 1
      });
      return;
    }

    const t = tool as any;
    if (['gate', 'tree', 'pole', 'waterTank', 'park', 'school', 'temple', 'mosque'].includes(t)) {
      onCommitFeature({
        id: createId('feature'), layerId: activeLayerId, name: `${t} 1`, zIndex: 0,
        geometry: { type: 'symbol', point: snapped, symbolType: t as SymbolType, size: 20 },
        style: {}, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      return;
    }

    if (t === 'point') {
      onCommitFeature({
        id: createId('feature'), layerId: activeLayerId, name: `Point 1`, zIndex: 0,
        geometry: { type: 'point', point: snapped },
        style: {}, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      return;
    }

    if (t === 'label') {
      const text = window.prompt("Enter text label:", "New Label");
      if (!text) return;
      onCommitFeature({
        id: createId('feature'), layerId: activeLayerId, name: `Label: ${text}`, zIndex: 0,
        geometry: { type: 'label', point: snapped, text },
        style: {}, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      return;
    }

    if (['line', 'rectangle', 'circle', 'divider', 'exportCrop', 'arrow'].includes(t)) {
      onDraftChange({ tool: t, start: snapped, current: snapped });
      return;
    }

    if (['polyline', 'polygon', 'freehand', 'plotBoundary', 'road', 'measure'].includes(t)) {
      if (!draft) {
        onDraftChange({ tool: t, points: [snapped] });
      } else if ('points' in draft) {
        onDraftChange({ ...draft, points: [...draft.points, snapped] });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const pt = screenToWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    const snapped = snapPoint(pt);
    currentCursorRef.current = snapped;
    onCursorMove(snapped);

    if (reshapeFeatureId && activeVertexIndexRef.current !== null) {
      const index = activeVertexIndexRef.current;
      onUpdateFeature(reshapeFeatureId, f => {
        const geom = { ...f.geometry };
        if (geom.type === 'line') {
          const newPoints = [...geom.points] as [Point, Point];
          newPoints[index] = snapped;
          return { ...f, geometry: { ...geom, points: newPoints }, updatedAt: new Date().toISOString() };
        } else if (geom.type === 'polyline' || geom.type === 'polygon') {
          const newPoints = [...geom.points];
          newPoints[index] = snapped;
          return { ...f, geometry: { ...geom, points: newPoints }, updatedAt: new Date().toISOString() };
        } else if (geom.type === 'arrow') {
          if (index === 0) return { ...f, geometry: { ...geom, start: snapped }, updatedAt: new Date().toISOString() };
          else return { ...f, geometry: { ...geom, end: snapped }, updatedAt: new Date().toISOString() };
        } else if (geom.type === 'rectangle' || geom.type === 'image') {
          const pts = toPolygonPoints(geom);
          pts[index] = snapped;
          const x = Math.min(pts[0].x, pts[2].x);
          const y = Math.min(pts[0].y, pts[2].y);
          const width = Math.max(2, Math.abs(pts[2].x - pts[0].x));
          const height = Math.max(2, Math.abs(pts[2].y - pts[0].y));
          return { ...f, geometry: { ...geom, origin: { x, y }, width, height }, updatedAt: new Date().toISOString() };
        } else if (geom.type === 'circle') {
          if (index === 0) {
            return { ...f, geometry: { ...geom, center: snapped }, updatedAt: new Date().toISOString() };
          } else {
            const rad = distance(geom.center, snapped);
            return { ...f, geometry: { ...geom, radius: rad }, updatedAt: new Date().toISOString() };
          }
        }
        return f;
      });
      return;
    }

    // Resize handle dragging (universal for all geometry types)
    if (resizeRef.current) {
      const r = resizeRef.current;
      const og = r.origGeom;
      const origBounds = og.bounds;
      const origGeom = og.geometry;
      const dx = snapped.x - r.startPt.x;
      const dy = snapped.y - r.startPt.y;
      const hn = r.handle;
      
      // Calculate new bounding box
      let newOx = origBounds.ox, newOy = origBounds.oy;
      let newW = origBounds.w, newH = origBounds.h;
      
      if (hn === 'tl') { newOx += dx; newOy += dy; newW -= dx; newH -= dy; }
      else if (hn === 'tc') { newOy += dy; newH -= dy; }
      else if (hn === 'tr') { newOy += dy; newW += dx; newH -= dy; }
      else if (hn === 'mr') { newW += dx; }
      else if (hn === 'br') { newW += dx; newH += dy; }
      else if (hn === 'bc') { newH += dy; }
      else if (hn === 'bl') { newOx += dx; newW -= dx; newH += dy; }
      else if (hn === 'ml') { newOx += dx; newW -= dx; }
      
      // Enforce minimums
      if (newW < 5) { newW = 5; if (hn.includes('l')) newOx = origBounds.ox + origBounds.w - 5; }
      if (newH < 5) { newH = 5; if (hn.includes('t')) newOy = origBounds.oy + origBounds.h - 5; }
      
      // Scale factors
      const scaleX = origBounds.w > 0.1 ? newW / origBounds.w : 1;
      const scaleY = origBounds.h > 0.1 ? newH / origBounds.h : 1;
      
      onUpdateFeature(r.featureId, f => {
        const gt = origGeom.type;
        
        if (gt === 'rectangle' || gt === 'image') {
          return { ...f, geometry: { ...f.geometry, origin: { x: newOx, y: newOy }, width: newW, height: newH } as any, updatedAt: new Date().toISOString() };
        } else if (gt === 'circle') {
          const newR = Math.max(2, Math.min(newW, newH) / 2);
          return { ...f, geometry: { ...f.geometry, center: { x: newOx + newW / 2, y: newOy + newH / 2 }, radius: newR } as any, updatedAt: new Date().toISOString() };
        } else if (gt === 'line') {
          const newPts = (origGeom as any).points.map((p: Point) => ({
            x: newOx + (p.x - origBounds.ox) * scaleX,
            y: newOy + (p.y - origBounds.oy) * scaleY
          }));
          return { ...f, geometry: { ...f.geometry, points: newPts } as any, updatedAt: new Date().toISOString() };
        } else if (gt === 'polyline' || gt === 'polygon') {
          const newPts = (origGeom as any).points.map((p: Point) => ({
            x: newOx + (p.x - origBounds.ox) * scaleX,
            y: newOy + (p.y - origBounds.oy) * scaleY
          }));
          return { ...f, geometry: { ...f.geometry, points: newPts } as any, updatedAt: new Date().toISOString() };
        } else if (gt === 'arrow') {
          const newStart = { x: newOx + ((origGeom as any).start.x - origBounds.ox) * scaleX, y: newOy + ((origGeom as any).start.y - origBounds.oy) * scaleY };
          const newEnd = { x: newOx + ((origGeom as any).end.x - origBounds.ox) * scaleX, y: newOy + ((origGeom as any).end.y - origBounds.oy) * scaleY };
          return { ...f, geometry: { ...f.geometry, start: newStart, end: newEnd } as any, updatedAt: new Date().toISOString() };
        } else if (gt === 'point' || gt === 'symbol' || gt === 'label') {
          const newPt = { x: newOx + newW / 2, y: newOy + newH / 2 };
          const sc = Math.max(scaleX, scaleY);
          return { ...f, geometry: { ...f.geometry, point: newPt } as any, scale: (f.scale || 1) * sc, updatedAt: new Date().toISOString() };
        }
        return f;
      });
      return;
    }

    if (isPanning && lastMousePos.current) {
      const dx = (pt.x - lastMousePos.current.x);
      const dy = (pt.y - lastMousePos.current.y);
      onViewportChange({ ...viewport, x: viewport.x - dx, y: viewport.y - dy });
      // Don't update lastMousePos because viewport shifts underneath
      return;
    }

    if (isMoving && selectedFeatureId && lastMousePos.current) {
      const dx = pt.x - lastMousePos.current.x;
      const dy = pt.y - lastMousePos.current.y;
      onUpdateFeature(selectedFeatureId, f => ({
        ...f, geometry: translateGeometry(f.geometry, dx, dy)
      }));
      lastMousePos.current = pt;
      return;
    }

    if (draft) {
      if ('start' in draft) {
        onDraftChange({ ...draft, current: snapped });
      } else if ('points' in draft) {
        if (draft.tool === 'freehand' && draft.points.length > 0) {
          if (distance(draft.points[draft.points.length - 1], pt) > 5 / viewport.scale) {
             onDraftChange({ ...draft, points: [...draft.points, pt] });
          }
        } else {
          onDraftChange({ ...draft, current: snapped });
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (activeVertexIndexRef.current !== null) {
      activeVertexIndexRef.current = null;
      return;
    }
    if (resizeRef.current) {
      resizeRef.current = null;
      return;
    }
    setIsPanning(false);
    setIsMoving(false);

    if (draft && 'start' in draft) {
      const { tool, start, current } = draft;
      if (tool === 'select') {
        const x1 = Math.min(start.x, current.x);
        const y1 = Math.min(start.y, current.y);
        const x2 = Math.max(start.x, current.x);
        const y2 = Math.max(start.y, current.y);
        
        // Find features inside bounding box
        const hits: string[] = [];
        features.forEach(f => {
          const pts = toPolygonPoints(f.geometry);
          if (pts.length > 0) {
            const anyInside = pts.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
            if (anyInside) {
              hits.push(f.id);
            }
          }
        });
        
        if (hits.length > 0) {
          // If parent supports multi-select, pass array, otherwise first element
          onSelectFeature(hits as any);
        } else {
          onSelectFeature(null);
        }
      } else if (tool === 'exportCrop') {
        const x1 = Math.min(start.x, current.x);
        const y1 = Math.min(start.y, current.y);
        const x2 = Math.max(start.x, current.x);
        const y2 = Math.max(start.y, current.y);
        if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) {
          if (onExportCropArea) {
            onExportCropArea({ minX: x1, maxX: x2, minY: y1, maxY: y2 });
          }
        }
        onFinishDraft();
      } else if (tool === 'divider') {
        // Bright red divider line — split intersecting polygons
        features.forEach(f => {
          if (f.geometry.type === 'polygon' || f.geometry.type === 'rectangle') {
            const polyPoints = toPolygonPoints(f.geometry);
            const splitResult = splitPolygonByLine(polyPoints, start, current);
            if (splitResult) {
              const [p1, p2] = splitResult;
              onUpdateFeature(f.id, old => ({
                ...old,
                geometry: { type: 'polygon', points: p1 },
                updatedAt: new Date().toISOString()
              }));
              onCommitFeature({
                id: createId('feature'),
                layerId: f.layerId,
                name: `${f.name} (Split)`,
                zIndex: f.zIndex,
                geometry: { type: 'polygon', points: p2 },
                style: { ...f.style },
                properties: { ...f.properties },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }
        });
        onFinishDraft();
      } else if (distance(start, current) > 0.5 / viewport.scale) {
        let geom: Geometry | null = null;
        if (tool === 'line') geom = { type: 'line', points: [start, current] };
        else if (tool === 'rectangle') geom = { type: 'rectangle', ...normalizeRectangle(start, current) };
        else if (tool === 'circle') geom = { type: 'circle', center: start, radius: distance(start, current) };
        else if (tool === 'arrow') geom = { type: 'arrow', start, end: current, headSize: 10 };
        
        if (geom) {
          onCommitFeature({
            id: createId('feature'), layerId: activeLayerId, name: `${tool} 1`, zIndex: 0,
            geometry: geom, style: {}, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        }
      }
      onFinishDraft();
    } else if (draft && draft.tool === 'freehand') {
       onCommitFeature({
          id: createId('feature'), layerId: activeLayerId, name: `freehand 1`, zIndex: 0,
          geometry: { type: 'polyline', points: draft.points }, style: {}, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
       });
       onFinishDraft();
    }
  };

  const handleDoubleClick = useCallback(() => {
    if (draft && 'points' in draft && draft.points.length > 1) {
      let geom: Geometry | null = null;
      let props: any = {};
      let name = `${draft.tool} 1`;
      let totalDistance = 0;
      let areaLabelText = '';
      let areaVal = 0;

      if (draft.tool === 'measure') {
        for (let i = 0; i < draft.points.length - 1; i++) {
          totalDistance += distance(draft.points[i], draft.points[i + 1]);
        }
        if (draft.current) {
          totalDistance += distance(draft.points[draft.points.length - 1], draft.current);
        }

        if (draft.points.length >= 3) {
          const polyPts = draft.current ? [...draft.points, draft.current] : draft.points;
          areaVal = areaOfPolygon(polyPts);
          const mockSettings = {
            units: settingsRef.current.units,
            bighaSqM: settingsRef.current.bighaSqM || 2529.0,
            biswaSqM: (settingsRef.current.bighaSqM || 2529.0) / 20,
            marlaSqM: settingsRef.current.marlaSqM || 25.2929,
            kanalSqM: settingsRef.current.kanalSqM || 505.857
          };
          areaLabelText = formatArea(areaVal, mockSettings as any);
        }

        const finalPoints = draft.current ? [...draft.points, draft.current] : draft.points;
        geom = { type: 'polyline', points: finalPoints };
        name = `Measure: ${roundTo(totalDistance, 2)} units`;
        props.notes = `Total Distance: ${formatLength(totalDistance)}` + (areaLabelText ? `, Area: ${areaLabelText}` : '');
      } else if (draft.tool === 'polygon' || draft.tool === 'plotBoundary') {
        geom = { type: 'polygon', points: draft.points };
        if (draft.tool === 'plotBoundary') name = 'Plot 1';
      } else if (draft.tool === 'polyline' || draft.tool === 'road') {
        geom = { type: 'polyline', points: draft.points };
        if (draft.tool === 'road') {
          name = 'Road 1';
          props.roadWidth = toolSizeRef.current;
        }
      }

      if (draft.tool === 'measure') {
        alert(
          `📐 Measurement Result:\n\n` +
          `• Total Distance: ${roundTo(totalDistance, 2)} units (${formatLength(totalDistance)})\n` +
          (draft.points.length >= 3 ? `• Closed Area: ${areaLabelText} (${roundTo(areaVal, 2)} sq units)` : '')
        );
      }

      if (geom) {
        const measureLayer = layersRef.current.find(l => l.name.toLowerCase().includes('measure'));
        const targetLayerId = (draft.tool === 'measure' && measureLayer) ? measureLayer.id : activeLayerId;

        onCommitFeature({
          id: createId('feature'), 
          layerId: targetLayerId, 
          name, 
          zIndex: 0,
          geometry: geom, 
          style: draft.tool === 'measure' ? { borderColor: '#e11d48', lineWidth: 2, lineStyle: 'dashed' } : {}, 
          properties: props, 
          createdAt: new Date().toISOString(), 
          updatedAt: new Date().toISOString()
        });
      }
      onFinishDraft();
    }
  }, [draft, activeLayerId, onCommitFeature, onFinishDraft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      const vp = viewportRef.current;
      const hasSelection = selectedFeatureIdsRef.current.length > 0;

      const d = draftRef.current;
      if (d && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const nudge = 5 / vp.scale;
        let curPt = { x: 0, y: 0 };
        if ('points' in d) {
          const last = d.points[d.points.length - 1];
          curPt = {
            x: d.current?.x ?? last.x,
            y: d.current?.y ?? last.y
          };
        } else if ('start' in d) {
          curPt = {
            x: d.current?.x ?? d.start.x,
            y: d.current?.y ?? d.start.y
          };
        }

        if (e.key === 'ArrowUp') curPt.y -= nudge;
        else if (e.key === 'ArrowDown') curPt.y += nudge;
        else if (e.key === 'ArrowLeft') curPt.x -= nudge;
        else if (e.key === 'ArrowRight') curPt.x += nudge;

        onDraftChange({ ...d, current: curPt } as any);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasSelection) {
          const nudge = 5 / vp.scale;
          selectedFeatureIdsRef.current.forEach(id => {
            onUpdateFeature(id, f => ({ ...f, geometry: translateGeometry(f.geometry, 0, -nudge), updatedAt: new Date().toISOString() }));
          });
        } else {
          const step = 40 / vp.scale;
          onViewportChange({ ...vp, y: vp.y - step });
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasSelection) {
          const nudge = 5 / vp.scale;
          selectedFeatureIdsRef.current.forEach(id => {
            onUpdateFeature(id, f => ({ ...f, geometry: translateGeometry(f.geometry, 0, nudge), updatedAt: new Date().toISOString() }));
          });
        } else {
          const step = 40 / vp.scale;
          onViewportChange({ ...vp, y: vp.y + step });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (hasSelection) {
          const nudge = 5 / vp.scale;
          selectedFeatureIdsRef.current.forEach(id => {
            onUpdateFeature(id, f => ({ ...f, geometry: translateGeometry(f.geometry, -nudge, 0), updatedAt: new Date().toISOString() }));
          });
        } else {
          const step = 40 / vp.scale;
          onViewportChange({ ...vp, x: vp.x - step });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (hasSelection) {
          const nudge = 5 / vp.scale;
          selectedFeatureIdsRef.current.forEach(id => {
            onUpdateFeature(id, f => ({ ...f, geometry: translateGeometry(f.geometry, nudge, 0), updatedAt: new Date().toISOString() }));
          });
        } else {
          const step = 40 / vp.scale;
          onViewportChange({ ...vp, x: vp.x + step });
        }
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const newScale = Math.min(Math.max(vp.scale * 1.15, 0.05), 50);
        onViewportChange({ ...vp, scale: newScale });
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const newScale = Math.min(Math.max(vp.scale * 0.85, 0.05), 50);
        onViewportChange({ ...vp, scale: newScale });
      } else if ((e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // C = bada (scale up), V = chota (scale down) — shape ko scale karo, map zoom nahi
        const ids = selectedFeatureIdsRef.current;
        if (ids.length > 0) {
          e.preventDefault();
          const factor = e.key.toLowerCase() === 'c' ? 1.1 : 0.9;
          onUpdateFeature(ids, f => {
            const geom = f.geometry;
            // Find center of geometry
            const b = geometryBounds(geom);
            if (!b) return f;
            const cx = (b.minX + b.maxX) / 2;
            const cy = (b.minY + b.maxY) / 2;
            // Scale all points from center
            const scalePoint = (p: Point): Point => ({
              x: cx + (p.x - cx) * factor,
              y: cy + (p.y - cy) * factor,
            });
            let newGeom = geom;
            if (geom.type === 'polyline' || geom.type === 'polygon' || geom.type === 'line') {
              newGeom = { ...geom, points: geom.points.map(scalePoint) } as any;
            } else if (geom.type === 'rectangle' || geom.type === 'image') {
              const newW = Math.max(1, geom.width * factor);
              const newH = Math.max(1, geom.height * factor);
              newGeom = { ...geom, origin: { x: cx - newW / 2, y: cy - newH / 2 }, width: newW, height: newH } as any;
            } else if (geom.type === 'circle') {
              newGeom = { ...geom, radius: Math.max(0.5, geom.radius * factor) } as any;
            } else if (geom.type === 'arrow') {
              newGeom = { ...geom, start: scalePoint(geom.start), end: scalePoint(geom.end) } as any;
            } else if (geom.type === 'symbol') {
              newGeom = { ...geom, size: Math.max(1, (geom.size || 20) * factor) } as any;
            } else if (geom.type === 'point' || geom.type === 'label') {
              // point/label don't have size to change — skip
              return f;
            }
            return { ...f, geometry: newGeom, updatedAt: new Date().toISOString() };
          });
        }
      } else if (e.key === 'Escape') {
        if (reshapeFeatureId) {
          setReshapeFeatureId(null);
        } else {
          onCancelDraft();
        }
      } else if (e.key === 'Enter') {
        handleDoubleClick();
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        if (featuresRef.current.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          featuresRef.current.forEach(f => {
            const pts = toPolygonPoints(f.geometry);
            if (pts.length > 0) {
              const b = boundsOfPoints(pts);
              if (b.minX < minX) minX = b.minX;
              if (b.minY < minY) minY = b.minY;
              if (b.maxX > maxX) maxX = b.maxX;
              if (b.maxY > maxY) maxY = b.maxY;
            }
          });
          if (minX !== Infinity) {
            onViewportChange({
              x: (minX + maxX) / 2,
              y: (minY + maxY) / 2,
              scale: 0.65
            });
          }
        } else {
          onViewportChange({ x: 100, y: 100, scale: 0.8 });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft, activeLayerId, onUpdateFeature, onViewportChange, onCancelDraft, onDraftChange, handleDoubleClick]);

  const dispatchKeyEvent = (keyName: string, ctrl: boolean = false) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: keyName,
      ctrlKey: ctrl,
      bubbles: true,
      cancelable: true
    }));
  };

  return (
    <div className="canvas-container" ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ display: 'block', width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'crosshair' }}
      />

      {contextMenu && contextMenu.show && (
        <div 
          className="context-menu" 
          style={{ 
            position: 'absolute', 
            left: contextMenu.x, 
            top: contextMenu.y,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
        >
          {selectedFeatureIdsRef.current.length > 0 ? (
            <>
              {selectedFeatureIdsRef.current.length === 1 && (
                <div 
                  className="context-item" 
                  style={{ color: '#0ea5e9', fontWeight: 'bold' }} 
                  onClick={() => { 
                    setReshapeFeatureId(selectedFeatureIdsRef.current[0]); 
                    setContextMenu(null); 
                  }}
                >
                  ✏️ Edit Line / Reshape
                </div>
              )}
              <div className="context-item" onClick={() => { dispatchKeyEvent('c', true); setContextMenu(null); }}>📋 Copy</div>
              <div className="context-item" onClick={() => { dispatchKeyEvent('d', true); setContextMenu(null); }}>📋 Duplicate</div>
              <div className="context-item" style={{ color: '#ef4444' }} onClick={() => { dispatchKeyEvent('Delete'); setContextMenu(null); }}>🗑️ Delete</div>
              <div className="context-separator" />
              <div className="context-item" onClick={() => {
                selectedFeatureIdsRef.current.forEach(id => {
                  onUpdateFeature(id, f => ({ ...f, zIndex: f.zIndex + 1 }));
                });
                setContextMenu(null);
              }}>⬆️ Bring Forward</div>
              <div className="context-item" onClick={() => {
                selectedFeatureIdsRef.current.forEach(id => {
                  onUpdateFeature(id, f => ({ ...f, zIndex: f.zIndex - 1 }));
                });
                setContextMenu(null);
              }}>⬇️ Send Backward</div>
              {selectedFeatureIdsRef.current.length >= 2 && onMerge && (
                <div className="context-item" onClick={() => { onMerge(); setContextMenu(null); }}>🔗 Merge Plots</div>
              )}
              <div className="context-separator" />
            </>
          ) : null}
          <div className="context-item" onClick={() => { dispatchKeyEvent('v', true); setContextMenu(null); }}>📥 Paste</div>
          <div className="context-item" onClick={() => {
            const pt = screenToWorld(contextMenu.x, contextMenu.y);
            const text = window.prompt("Enter text label:", "New Label");
            if (text) {
              onCommitFeature({
                id: createId('feature'),
                layerId: activeLayerId,
                name: `Label: ${text}`,
                geometry: { type: 'label', point: pt, text },
                style: {},
                properties: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                zIndex: 5
              });
            }
            setContextMenu(null);
          }}>🔤 Add Text Label</div>
          <div className="context-item" onClick={() => { onSelectFeature(null); setContextMenu(null); }}>🚫 Clear Selection</div>
          <div className="context-separator" />
          <div className="context-item" onClick={() => { dispatchKeyEvent('z', true); setContextMenu(null); }}>↩️ Undo</div>
          <div className="context-item" onClick={() => { dispatchKeyEvent('y', true); setContextMenu(null); }}>↪️ Redo</div>
        </div>
      )}
      {reshapeFeatureId && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #0ea5e9',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          zIndex: 100,
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px'
        }}>
          <span>✏️ <strong>Reshape Mode:</strong> Drag circle nodes to edit.</span>
          <button 
            style={{
              background: '#0ea5e9',
              color: '#000',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '11px'
            }}
            onClick={() => setReshapeFeatureId(null)}
          >
            Finish
          </button>
        </div>
      )}

      {/* Keyboard Shortcut Indicator */}
      <div style={{
        position: 'absolute',
        bottom: '14px',
        right: '14px',
        background: 'rgba(15, 23, 42, 0.88)',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '5px 12px',
        color: '#94a3b8',
        fontSize: '11px',
        fontFamily: 'Inter, monospace',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 50,
        pointerEvents: 'none',
      }}>
        <span><kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '3px', padding: '1px 6px', color: '#4ade80' }}>Z</kbd> Zoom In</span>
        <span style={{ color: '#334155' }}>|</span>
        <span><kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '3px', padding: '1px 6px', color: '#f87171' }}>O</kbd> Zoom Out</span>
        <span style={{ color: '#334155' }}>|</span>
        <span><kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '3px', padding: '1px 6px', color: '#a78bfa' }}>C</kbd> Shape ↑</span>
        <span style={{ color: '#334155' }}>|</span>
        <span><kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '3px', padding: '1px 6px', color: '#fb923c' }}>V</kbd> Shape ↓</span>
      </div>
    </div>
  );
};
