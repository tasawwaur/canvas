import type { Viewport, Feature, Layer, DraftState, Point, Tool, AreaUnit } from "../types";
import { SymbolRenderer } from "./SymbolRenderer";
import { hitTestGeometry, distance, midpoint, centroid, toPolygonPoints, areaOfPolygon } from "../lib/geometry";
import { formatArea } from "../lib/units";

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number = 0;
  private dirty: boolean = true;

  private viewport: Viewport = { x: 0, y: 0, scale: 1 };
  private features: Feature[] = [];
  private layers: Layer[] = [];
  private draft: DraftState = null;
  private selectedFeatureId: string | null = null;
  private selectedFeatureIds: string[] = [];
  private gridSize: number = 50;
  private showGrid: boolean = true;
  private showDimensions: boolean = true;
  private snapPoints: Point[] = [];
  private labelFontSize: number = 14;
  private cursorWorld: Point | null = null;
  private tool: Tool = "select";
  private units: AreaUnit = "sqft";
  private bighaSqM: number = 2529.0;

  // FPS tracking
  public fps: number = 60;
  private lastFrameTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.markDirty();
  }

  setFeatures(features: Feature[]): void {
    this.features = features;
    this.markDirty();
  }

  setLayers(layers: Layer[]): void {
    this.layers = layers;
    this.markDirty();
  }

  setDraft(draft: DraftState): void {
    this.draft = draft;
    this.markDirty();
  }

  setSelectedFeatureId(id: string | null): void {
    this.selectedFeatureId = id;
    this.selectedFeatureIds = id ? [id] : [];
    this.markDirty();
  }

  setSelectedFeatureIds(ids: string[]): void {
    this.selectedFeatureIds = ids;
    this.selectedFeatureId = ids[0] || null;
    this.markDirty();
  }

  setGridSize(size: number): void {
    this.gridSize = size;
    this.markDirty();
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.markDirty();
  }

  setShowDimensions(show: boolean): void {
    this.showDimensions = show;
    this.markDirty();
  }

  setSnapPoints(points: Point[]): void {
    this.snapPoints = points;
    this.markDirty();
  }

  setLabelFontSize(size: number): void {
    this.labelFontSize = size;
    this.markDirty();
  }

  setCursorWorld(pt: Point | null): void {
    this.cursorWorld = pt;
    this.markDirty();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.markDirty();
  }

  setUnits(units: AreaUnit): void {
    this.units = units;
    this.markDirty();
  }

  setBighaSqM(val: number): void {
    this.bighaSqM = val;
    this.markDirty();
  }

  screenToWorld(screenX: number, screenY: number): Point {
    const x = (screenX - this.canvas.width / 2) / this.viewport.scale + this.viewport.x;
    const y = (screenY - this.canvas.height / 2) / this.viewport.scale + this.viewport.y;
    return { x, y };
  }

  worldToScreen(worldX: number, worldY: number): Point {
    const x = (worldX - this.viewport.x) * this.viewport.scale + this.canvas.width / 2;
    const y = (worldY - this.viewport.y) * this.viewport.scale + this.canvas.height / 2;
    return { x, y };
  }

  hitTest(worldPoint: Point, tolerance: number = 8): Feature | null {
    for (let i = this.features.length - 1; i >= 0; i--) {
      const feature = this.features[i];
      const layer = this.layers.find(l => l.id === feature.layerId);
      if (layer && !layer.visible) continue;
      if (hitTestGeometry(feature.geometry, worldPoint, tolerance / this.viewport.scale)) {
        return feature;
      }
    }
    return null;
  }

  start(): void {
    const loop = () => {
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;
      if (delta > 0) {
        this.fps = Math.round(1000 / delta);
      }

      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  markDirty(): void {
    this.dirty = true;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      this.markDirty();
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  private render(): void {
    const viewLeft = this.viewport.x - (this.canvas.width / 2) / this.viewport.scale;
    const viewRight = this.viewport.x + (this.canvas.width / 2) / this.viewport.scale;
    const viewTop = this.viewport.y - (this.canvas.height / 2) / this.viewport.scale;
    const viewBottom = this.viewport.y + (this.canvas.height / 2) / this.viewport.scale;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Main transformed workspace drawing
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);
    this.ctx.translate(-this.viewport.x, -this.viewport.y);

    if (this.showGrid) {
      this.renderGrid();
    }
    this.renderFeatures();
    if (this.draft) {
      this.renderDraft();
    }
    this.renderSelection();
    this.renderSnapIndicators();

    // Render crosshair cursor lines if a drawing tool is active
    if (this.tool !== "select" && this.tool !== "pan" && this.cursorWorld) {
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      this.ctx.lineWidth = 1 / this.viewport.scale;
      this.ctx.setLineDash([4 / this.viewport.scale, 4 / this.viewport.scale]);
      this.ctx.beginPath();
      this.ctx.moveTo(viewLeft, this.cursorWorld.y);
      this.ctx.lineTo(viewRight, this.cursorWorld.y);
      this.ctx.moveTo(this.cursorWorld.x, viewTop);
      this.ctx.lineTo(this.cursorWorld.x, viewBottom);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.restore();

    // Rulers overlay (drawn in absolute screen-space coordinates)
    this.ctx.save();
    this.ctx.fillStyle = "#0b1220";
    this.ctx.fillRect(0, 0, this.canvas.width, 20);
    this.ctx.fillRect(0, 0, 20, this.canvas.height);

    this.ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 20);
    this.ctx.lineTo(this.canvas.width, 20);
    this.ctx.moveTo(20, 0);
    this.ctx.lineTo(20, this.canvas.height);
    this.ctx.stroke();

    this.ctx.fillStyle = "#94a3b8";
    this.ctx.font = "9px Inter, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    // Top Ruler Ticks
    for (let x = 20; x < this.canvas.width; x += 50) {
      const wPt = this.screenToWorld(x, 20);
      this.ctx.beginPath();
      this.ctx.moveTo(x, 12);
      this.ctx.lineTo(x, 20);
      this.ctx.stroke();
      this.ctx.fillText(wPt.x.toFixed(0), x, 7);
    }

    // Left Ruler Ticks
    this.ctx.textAlign = "left";
    for (let y = 20; y < this.canvas.height; y += 50) {
      const wPt = this.screenToWorld(20, y);
      this.ctx.beginPath();
      this.ctx.moveTo(12, y);
      this.ctx.lineTo(20, y);
      this.ctx.stroke();
      this.ctx.fillText(wPt.y.toFixed(0), 2, y);
    }

    // Corner Block
    this.ctx.fillStyle = "#070d1a";
    this.ctx.fillRect(0, 0, 20, 20);
    this.ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    this.ctx.strokeRect(0, 0, 20, 20);
    this.ctx.restore();
  }

  private renderGrid(): void {
    const viewLeft = this.viewport.x - (this.canvas.width / 2) / this.viewport.scale;
    const viewRight = this.viewport.x + (this.canvas.width / 2) / this.viewport.scale;
    const viewTop = this.viewport.y - (this.canvas.height / 2) / this.viewport.scale;
    const viewBottom = this.viewport.y + (this.canvas.height / 2) / this.viewport.scale;

    let adjustedGridSize = this.gridSize;
    if (this.viewport.scale < 0.2) adjustedGridSize = this.gridSize * 10;
    if (this.viewport.scale < 0.02) adjustedGridSize = this.gridSize * 100;

    const startX = Math.floor(viewLeft / adjustedGridSize) * adjustedGridSize;
    const startY = Math.floor(viewTop / adjustedGridSize) * adjustedGridSize;

    this.ctx.lineWidth = 1 / this.viewport.scale;
    this.ctx.strokeStyle = "#e2e8f0";

    this.ctx.beginPath();
    for (let x = startX; x <= viewRight; x += adjustedGridSize) {
      this.ctx.moveTo(x, viewTop);
      this.ctx.lineTo(x, viewBottom);
    }
    for (let y = startY; y <= viewBottom; y += adjustedGridSize) {
      this.ctx.moveTo(viewLeft, y);
      this.ctx.lineTo(viewRight, y);
    }
    this.ctx.stroke();

    this.ctx.strokeStyle = "#cbd5e1";
    this.ctx.beginPath();
    for (let x = startX; x <= viewRight; x += adjustedGridSize) {
      if (Math.abs(Math.round(x / adjustedGridSize)) % 5 === 0) {
        this.ctx.moveTo(x, viewTop);
        this.ctx.lineTo(x, viewBottom);
      }
    }
    for (let y = startY; y <= viewBottom; y += adjustedGridSize) {
      if (Math.abs(Math.round(y / adjustedGridSize)) % 5 === 0) {
        this.ctx.moveTo(viewLeft, y);
        this.ctx.lineTo(viewRight, y);
      }
    }
    this.ctx.stroke();
  }

  private renderFeatures(): void {
    const sortedLayers = [...this.layers].sort((a, b) => a.order - b.order);
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      const layerFeatures = this.features.filter(f => f.layerId === layer.id).sort((a, b) => a.zIndex - b.zIndex);
      for (const feature of layerFeatures) {
        this.renderFeature(feature, layer);
      }
    }
  }

  private renderFeature(feature: Feature, layer: Layer): void {
    this.ctx.save();
    let fill = feature.style.fillColor || "transparent";
    if (feature.properties.status === "available") fill = "#22c55e40";
    else if (feature.properties.status === "sold") fill = "#ef444440";
    else if (feature.properties.status === "booked") fill = "#f9731640";

    this.ctx.fillStyle = fill;
    this.ctx.strokeStyle = feature.style.borderColor || layer.color || "#000";
    this.ctx.lineWidth = (feature.style.lineWidth || layer.lineWidth || 2) / this.viewport.scale;
    this.ctx.globalAlpha = feature.style.fillOpacity ?? layer.opacity ?? 1;

    if (feature.style.lineStyle === "dashed" || layer.lineStyle === "dashed") {
      this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);
    } else if (feature.style.lineStyle === "dotted" || layer.lineStyle === "dotted") {
      this.ctx.setLineDash([2 / this.viewport.scale, 2 / this.viewport.scale]);
    }

    const geom = feature.geometry;
    
    this.ctx.beginPath();
    switch (geom.type) {
      case "point":
        this.ctx.arc(geom.point.x, geom.point.y, 3 / this.viewport.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        break;
      case "line":
        this.ctx.moveTo(geom.points[0].x, geom.points[0].y);
        this.ctx.lineTo(geom.points[1].x, geom.points[1].y);
        this.ctx.stroke();
        break;
      case "polyline":
        if (geom.points.length > 0) {
          this.ctx.moveTo(geom.points[0].x, geom.points[0].y);
          for (let i = 1; i < geom.points.length; i++) {
            this.ctx.lineTo(geom.points[i].x, geom.points[i].y);
          }
          this.ctx.stroke();
        }
        break;
      case "polygon":
        if (geom.points.length > 0) {
          this.ctx.moveTo(geom.points[0].x, geom.points[0].y);
          for (let i = 1; i < geom.points.length; i++) {
            this.ctx.lineTo(geom.points[i].x, geom.points[i].y);
          }
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();
        }
        break;
      case "rectangle":
        this.ctx.rect(geom.origin.x, geom.origin.y, geom.width, geom.height);
        this.ctx.fill();
        this.ctx.stroke();
        break;
      case "circle":
        this.ctx.arc(geom.center.x, geom.center.y, geom.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        break;
      case "label":
        this.ctx.font = `${this.labelFontSize / this.viewport.scale}px sans-serif`;
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fillText(geom.text, geom.point.x, geom.point.y);
        break;
      case "arrow": {
        this.ctx.moveTo(geom.start.x, geom.start.y);
        this.ctx.lineTo(geom.end.x, geom.end.y);
        this.ctx.stroke();
        const angle = Math.atan2(geom.end.y - geom.start.y, geom.end.x - geom.start.x);
        const headLen = geom.headSize;
        const x1 = geom.end.x - headLen * Math.cos(angle - Math.PI / 6);
        const y1 = geom.end.y - headLen * Math.sin(angle - Math.PI / 6);
        const x2 = geom.end.x - headLen * Math.cos(angle + Math.PI / 6);
        const y2 = geom.end.y - headLen * Math.sin(angle + Math.PI / 6);
        this.ctx.beginPath();
        this.ctx.moveTo(geom.end.x, geom.end.y);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.closePath();
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fill();
        break;
      }
      case "symbol":
        SymbolRenderer.drawSymbol(this.ctx, geom.symbolType, geom.point.x, geom.point.y, geom.size, this.ctx.strokeStyle as string);
        break;
    }

    this.ctx.restore();

    // Render auto area label at centroid for polygon and rectangle features
    if (geom.type === "polygon" || geom.type === "rectangle") {
      const pts = toPolygonPoints(geom);
      if (pts.length >= 3) {
        const ctr = centroid(pts);
        const areaVal = areaOfPolygon(pts);
        
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.strokeStyle = "#070d1a";
        this.ctx.lineWidth = 3 / this.viewport.scale;
        this.ctx.font = `bold ${Math.max(9, 11 / this.viewport.scale)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        const mockSettings = {
          units: this.units,
          bighaSqM: this.bighaSqM,
          biswaSqM: this.bighaSqM / 20,
          marlaSqM: 25.2929,
          kanalSqM: 505.857
        };
        const areaLabelText = formatArea(areaVal, mockSettings as any);
        const text1 = feature.name;
        const text2 = areaLabelText;
        
        const yOffset = 6 / this.viewport.scale;
        this.ctx.strokeText(text1, ctr.x, ctr.y - yOffset);
        this.ctx.fillText(text1, ctr.x, ctr.y - yOffset);
        
        this.ctx.strokeText(text2, ctr.x, ctr.y + yOffset);
        this.ctx.fillText(text2, ctr.x, ctr.y + yOffset);
        this.ctx.restore();
      }
    }

    if (this.showDimensions && this.selectedFeatureIds.includes(feature.id)) {
      this.renderDimensions(feature);
    }
  }

  private renderDraft(): void {
    if (!this.draft) return;
    this.ctx.save();
    this.ctx.strokeStyle = "#fb923c"; // Amber draft color
    this.ctx.fillStyle = "rgba(251, 146, 60, 0.15)";
    this.ctx.lineWidth = 2 / this.viewport.scale;

    this.ctx.beginPath();
    switch (this.draft.tool) {
      case "line":
      case "divider":
        if (this.draft.current) {
          this.ctx.moveTo(this.draft.start.x, this.draft.start.y);
          this.ctx.lineTo(this.draft.current.x, this.draft.current.y);
          this.ctx.stroke();
        }
        break;
      case "rectangle":
        if (this.draft.current) {
          const x = Math.min(this.draft.start.x, this.draft.current.x);
          const y = Math.min(this.draft.start.y, this.draft.current.y);
          const w = Math.abs(this.draft.current.x - this.draft.start.x);
          const h = Math.abs(this.draft.current.y - this.draft.start.y);
          this.ctx.rect(x, y, w, h);
          this.ctx.fill();
          this.ctx.stroke();
        }
        break;
      case "circle":
        if (this.draft.current) {
          const r = distance(this.draft.start, this.draft.current);
          this.ctx.arc(this.draft.start.x, this.draft.start.y, r, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
        }
        break;
      case "arrow":
        if (this.draft.current) {
          this.ctx.moveTo(this.draft.start.x, this.draft.start.y);
          this.ctx.lineTo(this.draft.current.x, this.draft.current.y);
          this.ctx.stroke();
        }
        break;
      case "select":
        if (this.draft.current) {
          const x = Math.min(this.draft.start.x, this.draft.current.x);
          const y = Math.min(this.draft.start.y, this.draft.current.y);
          const w = Math.abs(this.draft.current.x - this.draft.start.x);
          const h = Math.abs(this.draft.current.y - this.draft.start.y);
          this.ctx.save();
          this.ctx.strokeStyle = "#fb923c";
          this.ctx.fillStyle = "rgba(251, 146, 60, 0.08)";
          this.ctx.setLineDash([4 / this.viewport.scale, 4 / this.viewport.scale]);
          this.ctx.rect(x, y, w, h);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.restore();
        }
        break;
      case "measure":
      case "polyline":
      case "polygon":
      case "freehand":
      case "plotBoundary":
      case "road":
        if (this.draft.points.length > 0) {
          this.ctx.moveTo(this.draft.points[0].x, this.draft.points[0].y);
          for (let i = 1; i < this.draft.points.length; i++) {
            this.ctx.lineTo(this.draft.points[i].x, this.draft.points[i].y);
          }
          if (this.draft.current) {
            this.ctx.lineTo(this.draft.current.x, this.draft.current.y);
          }
          if (this.draft.tool === "polygon" || this.draft.tool === "plotBoundary") {
            this.ctx.closePath();
            this.ctx.fill();
          }
          this.ctx.stroke();
        }
        break;
    }
    this.ctx.restore();
  }

  private renderSelection(): void {
    if (this.selectedFeatureIds.length === 0) return;

    this.selectedFeatureIds.forEach(id => {
      const feature = this.features.find(f => f.id === id);
      if (!feature) return;

      this.ctx.save();
      this.ctx.strokeStyle = "#fb923c"; // Amber selection outline
      this.ctx.lineWidth = 2 / this.viewport.scale;
      this.ctx.setLineDash([5 / this.viewport.scale, 5 / this.viewport.scale]);

      let pts: Point[] = [];
      if (feature.geometry.type === "line") pts = feature.geometry.points;
      else if (feature.geometry.type === "polyline" || feature.geometry.type === "polygon") pts = feature.geometry.points;
      else if (feature.geometry.type === "rectangle") {
        pts = [
          feature.geometry.origin,
          { x: feature.geometry.origin.x + feature.geometry.width, y: feature.geometry.origin.y },
          { x: feature.geometry.origin.x + feature.geometry.width, y: feature.geometry.origin.y + feature.geometry.height },
          { x: feature.geometry.origin.x, y: feature.geometry.origin.y + feature.geometry.height }
        ];
      }
      else if (feature.geometry.type === "arrow") pts = [feature.geometry.start, feature.geometry.end];
      else if (feature.geometry.type === "symbol" || feature.geometry.type === "point" || feature.geometry.type === "label") pts = [feature.geometry.point];

      this.ctx.beginPath();
      if (pts.length === 1) {
        const handleSize = 8 / this.viewport.scale;
        this.ctx.arc(pts[0].x, pts[0].y, handleSize, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (pts.length > 1) {
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          this.ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (feature.geometry.type === "polygon" || feature.geometry.type === "rectangle") {
          this.ctx.closePath();
        }
        this.ctx.stroke();
      }

      this.ctx.fillStyle = "#ffffff";
      this.ctx.strokeStyle = "#fb923c";
      this.ctx.setLineDash([]);
      this.ctx.lineWidth = 1 / this.viewport.scale;
      const handleSize = 6 / this.viewport.scale;

      for (const pt of pts) {
        this.ctx.fillRect(pt.x - handleSize/2, pt.y - handleSize/2, handleSize, handleSize);
        this.ctx.strokeRect(pt.x - handleSize/2, pt.y - handleSize/2, handleSize, handleSize);
      }
      this.ctx.restore();
    });
  }

  private renderSnapIndicators(): void {
    this.ctx.save();
    this.ctx.fillStyle = "#ef4444";
    const handleSize = 6 / this.viewport.scale;
    for (const pt of this.snapPoints) {
      this.ctx.beginPath();
      this.ctx.moveTo(pt.x, pt.y - handleSize);
      this.ctx.lineTo(pt.x + handleSize, pt.y);
      this.ctx.lineTo(pt.x, pt.y + handleSize);
      this.ctx.lineTo(pt.x - handleSize, pt.y);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private renderDimensions(feature: Feature): void {
    let pts: Point[] = [];
    if (feature.geometry.type === "line") pts = feature.geometry.points;
    else if (feature.geometry.type === "polyline" || feature.geometry.type === "polygon") pts = feature.geometry.points;
    else if (feature.geometry.type === "rectangle") {
      pts = [
        feature.geometry.origin,
        { x: feature.geometry.origin.x + feature.geometry.width, y: feature.geometry.origin.y },
        { x: feature.geometry.origin.x + feature.geometry.width, y: feature.geometry.origin.y + feature.geometry.height },
        { x: feature.geometry.origin.x, y: feature.geometry.origin.y + feature.geometry.height }
      ];
    }
    else return;

    this.ctx.save();
    this.ctx.font = `${12 / this.viewport.scale}px sans-serif`;
    this.ctx.fillStyle = "#1e293b";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const drawDim = (p1: Point, p2: Point) => {
      const dist = distance(p1, p2);
      if (dist < 1) return;
      const mid = midpoint(p1, p2);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      
      this.ctx.save();
      this.ctx.translate(mid.x, mid.y);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        this.ctx.rotate(angle + Math.PI);
      } else {
        this.ctx.rotate(angle);
      }
      this.ctx.translate(0, -10 / this.viewport.scale);
      
      const text = dist.toFixed(2) + "m";
      const metrics = this.ctx.measureText(text);
      this.ctx.fillStyle = "#ffffffCC";
      this.ctx.fillRect(-metrics.width/2 - 2, -6 / this.viewport.scale, metrics.width + 4, 12 / this.viewport.scale);
      
      this.ctx.fillStyle = "#1e293b";
      this.ctx.fillText(text, 0, 0);
      this.ctx.restore();
    };

    for (let i = 0; i < pts.length - 1; i++) {
      drawDim(pts[i], pts[i+1]);
    }
    if (feature.geometry.type === "polygon" || feature.geometry.type === "rectangle") {
      if (pts.length > 1) {
        drawDim(pts[pts.length - 1], pts[0]);
      }
    }

    this.ctx.restore();
  }
}
