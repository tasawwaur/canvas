import { jsPDF } from "jspdf";
import type { Feature, Project, PrintSettings, Point } from "../types";
import { geometryBounds, toPolygonPoints, distance, centroid, areaOfPolygon, boundsOfPoints, roundTo } from "./geometry";
import { formatArea } from "./units";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const geometryToSvg = (feature: Feature, stroke = "#0f172a", fill = "none", strokeWidth = 2) => {
  const geometry = feature.geometry;
  switch (geometry.type) {
    case "point":
      return `<circle cx="${geometry.point.x}" cy="${geometry.point.y}" r="${Math.max(2, strokeWidth * 1.5)}" fill="${stroke}" />`;
    case "label":
      return `<text x="${geometry.point.x}" y="${geometry.point.y}" font-size="14" fill="${stroke}">${escapeXml(geometry.text)}</text>`;
    case "line":
      return `<line x1="${geometry.points[0].x}" y1="${geometry.points[0].y}" x2="${geometry.points[1].x}" y2="${geometry.points[1].y}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    case "polyline":
      return `<polyline points="${geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    case "polygon":
      return `<polygon points="${geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    case "rectangle":
      return `<rect x="${geometry.origin.x}" y="${geometry.origin.y}" width="${geometry.width}" height="${geometry.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    case "circle":
      return `<circle cx="${geometry.center.x}" cy="${geometry.center.y}" r="${geometry.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    case "arrow": {
      const angle = Math.atan2(geometry.end.y - geometry.start.y, geometry.end.x - geometry.start.x);
      const headLen = geometry.headSize;
      const x1 = geometry.end.x - headLen * Math.cos(angle - Math.PI / 6);
      const y1 = geometry.end.y - headLen * Math.sin(angle - Math.PI / 6);
      const x2 = geometry.end.x - headLen * Math.cos(angle + Math.PI / 6);
      const y2 = geometry.end.y - headLen * Math.sin(angle + Math.PI / 6);
      return `<line x1="${geometry.start.x}" y1="${geometry.start.y}" x2="${geometry.end.x}" y2="${geometry.end.y}" stroke="${stroke}" stroke-width="${strokeWidth}" /><polygon points="${geometry.end.x},${geometry.end.y} ${x1},${y1} ${x2},${y2}" fill="${stroke}" />`;
    }
    case "symbol":
      return `<circle cx="${geometry.point.x}" cy="${geometry.point.y}" r="${geometry.size / 2}" fill="${stroke}" />`;
    case "image": {
      const transform = feature.rotation ? ` transform="rotate(${feature.rotation} ${geometry.origin.x + geometry.width / 2} ${geometry.origin.y + geometry.height / 2})"` : "";
      return `<image href="${escapeXml(geometry.src)}" x="${geometry.origin.x}" y="${geometry.origin.y}" width="${geometry.width}" height="${geometry.height}"${transform} />`;
    }
  }
};

export const projectToJson = (project: Project) => JSON.stringify(project, null, 2);

export const projectToGeoJson = (project: Project) => {
  const features = project.features.map((feature) => {
    const geometry = feature.geometry;
    let geojsonGeometry: any;
    switch (geometry.type) {
      case "point":
      case "label":
      case "symbol":
        geojsonGeometry = { type: "Point", coordinates: [geometry.point.x, geometry.point.y] };
        break;
      case "line":
        geojsonGeometry = {
          type: "LineString",
          coordinates: geometry.points.map((p) => [p.x, p.y]),
        };
        break;
      case "polyline":
        geojsonGeometry = {
          type: "LineString",
          coordinates: geometry.points.map((p) => [p.x, p.y]),
        };
        break;
      case "polygon":
        geojsonGeometry = {
          type: "Polygon",
          coordinates: [[...geometry.points, geometry.points[0]].map((p) => [p.x, p.y])],
        };
        break;
      case "rectangle":
        geojsonGeometry = {
          type: "Polygon",
          coordinates: [[...toPolygonPoints(geometry), toPolygonPoints(geometry)[0]].map((p) => [p.x, p.y])],
        };
        break;
      case "circle":
        geojsonGeometry = { type: "Point", coordinates: [geometry.center.x, geometry.center.y] };
        break;
      case "arrow":
        geojsonGeometry = {
          type: "LineString",
          coordinates: [[geometry.start.x, geometry.start.y], [geometry.end.x, geometry.end.y]],
        };
        break;
      case "image":
        geojsonGeometry = {
          type: "Polygon",
          coordinates: [[...toPolygonPoints(geometry), toPolygonPoints(geometry)[0]].map((p) => [p.x, p.y])],
        };
        break;
    }
    return {
      type: "Feature",
      geometry: geojsonGeometry,
      properties: {
        id: feature.id,
        layerId: feature.layerId,
        name: feature.name,
        geometryType: geometry.type,
        ...feature.properties,
      },
    };
  });
  return JSON.stringify({ type: "FeatureCollection", name: project.name, features }, null, 2);
};

export const projectToSvg = (project: Project) => {
  if (project.features.length === 0) return `<svg></svg>`;
  const allBounds = project.features
    .map((f) => geometryBounds(f.geometry))
    .reduce(
      (acc, b) => ({
        minX: Math.min(acc.minX, b.minX),
        minY: Math.min(acc.minY, b.minY),
        maxX: Math.max(acc.maxX, b.maxX),
        maxY: Math.max(acc.maxY, b.maxY),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
  const width = Math.max(800, allBounds.maxX - allBounds.minX + 100);
  const height = Math.max(600, allBounds.maxY - allBounds.minY + 100);
  const offsetX = allBounds.minX - 50;
  const offsetY = allBounds.minY - 50;
  const svgFeatures = project.features
    .map((feature) => {
      const layer = project.layers.find((l) => l.id === feature.layerId);
      if (layer && !layer.visible) return "";
      const stroke = feature.style.borderColor || layer?.color || "#0f172a";
      const fill = feature.style.fillColor || (feature.geometry.type === "polygon" || feature.geometry.type === "rectangle" ? stroke + "18" : "none");
      const strokeWidth = feature.style.lineWidth || layer?.lineWidth || 2;
      return geometryToSvg(feature, stroke, fill, strokeWidth);
    })
    .filter(Boolean)
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${offsetX} ${offsetY} ${width} ${height}" width="${width}" height="${height}">
  <rect x="${offsetX}" y="${offsetY}" width="${width}" height="${height}" fill="#f8fafc"/>
  ${svgFeatures}
</svg>`;
};

const geometryToDxf = (feature: Feature): string[] => {
  const geometry = feature.geometry;
  switch (geometry.type) {
    case "point":
    case "symbol":
      return ["0", "POINT", "8", feature.layerId, "10", `${geometry.point.x}`, "20", `${geometry.point.y}`, "30", "0"];
    case "line":
      return [
        "0", "LINE", "8", feature.layerId,
        "10", `${geometry.points[0].x}`, "20", `${geometry.points[0].y}`,
        "11", `${geometry.points[1].x}`, "21", `${geometry.points[1].y}`,
      ];
    case "arrow":
      return [
        "0", "LINE", "8", feature.layerId,
        "10", `${geometry.start.x}`, "20", `${geometry.start.y}`,
        "11", `${geometry.end.x}`, "21", `${geometry.end.y}`,
      ];
    case "polyline":
    case "polygon": {
      const points = geometry.points;
      return [
        "0", "LWPOLYLINE", "8", feature.layerId, "90", `${points.length}`, "70", geometry.type === "polygon" ? "1" : "0",
        ...points.flatMap((p) => ["10", `${p.x}`, "20", `${p.y}`]),
      ];
    }
    case "rectangle":
      return geometryToDxf({ ...feature, geometry: { type: "polygon", points: toPolygonPoints(geometry) } } as Feature);
    case "circle":
      return ["0", "CIRCLE", "8", feature.layerId, "10", `${geometry.center.x}`, "20", `${geometry.center.y}`, "40", `${geometry.radius}`];
    case "label":
      return ["0", "TEXT", "8", feature.layerId, "10", `${geometry.point.x}`, "20", `${geometry.point.y}`, "40", "2.5", "1", geometry.text];
    case "image":
      return geometryToDxf({ ...feature, geometry: { type: "polygon", points: toPolygonPoints(geometry) } } as Feature);
  }
};

export const projectToDxf = (project: Project) => {
  const entities = project.features.flatMap((f) => geometryToDxf(f));
  return [
    "0", "SECTION", "2", "HEADER", "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", ...entities, "0", "ENDSEC",
    "0", "EOF",
  ].join("\n");
};

const csvEscape = (value: string | number | undefined) => {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
};

export const projectToCsv = (project: Project) => {
  const rows = [
    ["id", "layer", "name", "geometryType", "ownerName", "plotNumber", "khasraNumber", "village", "tehsil", "district", "notes"],
    ...project.features.map((f) => [
      f.id,
      project.layers.find((l) => l.id === f.layerId)?.name ?? f.layerId,
      f.name,
      f.geometry.type,
      f.properties.ownerName ?? "",
      f.properties.plotNumber ?? "",
      f.properties.khasraNumber ?? "",
      f.properties.village ?? "",
      f.properties.tehsil ?? "",
      f.properties.district ?? "",
      f.properties.notes ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
};

const drawSymbolToCanvas = (ctx: CanvasRenderingContext2D, type: string, x: number, y: number, size: number, color: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  
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
      case "mosque":
      ctx.arc(0, 0, size/2, Math.PI, 0);
      ctx.stroke();
      break;
  }
  ctx.restore();
};

export const renderProjectToOffscreenCanvas = (
  project: Project,
  canvasWidth: number,
  canvasHeight: number,
  showGrid: boolean,
  showDimensions: boolean,
  selectedFeatureIds?: string[],
  onlyDrawSelected = false,
  viewportBounds?: { minX: number; maxX: number; minY: number; maxY: number }
): Promise<HTMLCanvasElement> => {
  return new Promise((resolve) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    if (viewportBounds) {
      minX = viewportBounds.minX;
      maxX = viewportBounds.maxX;
      minY = viewportBounds.minY;
      maxY = viewportBounds.maxY;
    } else {
      // Crop boundaries to selected features if we are drawing only selected
      const hasSelection = selectedFeatureIds && selectedFeatureIds.length > 0;
      const targetFeatures = onlyDrawSelected && hasSelection 
        ? project.features.filter(f => selectedFeatureIds.includes(f.id))
        : project.features;

      targetFeatures.forEach(f => {
        const layer = project.layers.find(l => l.id === f.layerId);
        if (layer && !layer.visible) return;
        const b = geometryBounds(f.geometry);
        if (b.minX < minX) minX = b.minX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.maxY > maxY) maxY = b.maxY;
      });
    }

    if (minX === Infinity) {
      minX = -100; minY = -100; maxX = 100; maxY = 100;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const offscreen = document.createElement("canvas");
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      resolve(offscreen);
      return;
    }

    const imageUrls = project.features
      .filter(f => f.geometry.type === 'image')
      .map(f => (f.geometry as any).src);

    const preloadImages = (urls: string[]): Promise<Record<string, HTMLImageElement>> => {
      return new Promise((resolveImages) => {
        const cache: Record<string, HTMLImageElement> = {};
        let loaded = 0;
        if (urls.length === 0) {
          resolveImages(cache);
          return;
        }
        urls.forEach(url => {
          const img = new Image();
          img.src = url;
          img.onload = img.onerror = () => {
            cache[url] = img;
            loaded++;
            if (loaded === urls.length) {
              resolveImages(cache);
            }
          };
        });
      });
    };

    preloadImages(imageUrls).then(loadedImages => {
      const bgColor = project.settings.backgroundColor || '#0a0f1e';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      const pad = onlyDrawSelected ? 15 : 40; // tighter padding for selected crops
      const wUnits = (maxX - minX) + pad * 2;
      const hUnits = (maxY - minY) + pad * 2;

      const scaleX = canvasWidth / wUnits;
      const scaleY = canvasHeight / hUnits;
      const renderScale = Math.min(scaleX, scaleY);

      ctx.scale(renderScale, renderScale);
      ctx.translate(-cx, -cy);

      if (showGrid && !onlyDrawSelected) { // skip grid for cropped plots for cleaner design
        const gridSize = project.settings.gridSize || 10;
        const left = minX - pad;
        const right = maxX + pad;
        const top = minY - pad;
        const bottom = maxY + pad;

        ctx.lineWidth = 0.5;
        for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
          ctx.strokeStyle = Math.abs(x % (gridSize * 5)) < 0.001 ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.06)';
          ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        }
        for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
          ctx.strokeStyle = Math.abs(y % (gridSize * 5)) < 0.001 ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.06)';
          ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        }
      }

      const sortedFeatures = [...project.features].sort((a, b) => {
        const lA = project.layers.find(l => l.id === a.layerId);
        const lB = project.layers.find(l => l.id === b.layerId);
        if (lA && lB && lA.order !== lB.order) return lA.order - lB.order;
        return a.zIndex - b.zIndex;
      });

      for (const f of sortedFeatures) {
        // Skip drawing features that are not selected if onlyDrawSelected is enabled
        if (onlyDrawSelected && selectedFeatureIds && !selectedFeatureIds.includes(f.id)) {
          continue;
        }

        const layer = project.layers.find(l => l.id === f.layerId);
        if (!layer || !layer.visible) continue;

        ctx.save();
        ctx.globalAlpha = layer.opacity * (f.style.fillOpacity ?? 1);
        ctx.strokeStyle = f.style.borderColor || layer.color || "#0f172a";
        ctx.fillStyle = f.style.fillColor || layer.color || "#ffffff";
        
        const strokeWidth = f.style.lineWidth || layer.lineWidth || 2;
        ctx.lineWidth = strokeWidth;

        const lineStyle = f.style.lineStyle || layer.lineStyle;
        if (lineStyle === 'dashed') ctx.setLineDash([12, 8]);
        else if (lineStyle === 'dotted') ctx.setLineDash([3, 8]);
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
            ctx.lineWidth = 1.0;
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
            ctx.beginPath();
            ctx.moveTo(geom.points[0].x, geom.points[0].y);
            for (let i = 1; i < geom.points.length; i++) {
              ctx.lineTo(geom.points[i].x, geom.points[i].y);
            }
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([8, 8]);
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
            ctx.lineWidth = 1.0;
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
          drawSymbolToCanvas(ctx, geom.symbolType, geom.point.x, geom.point.y, geom.size, ctx.strokeStyle as string);
        } else if (geom.type === 'label') {
          const fontSize = (f.style as any).fontSize || project.settings.labelFontSize || 12;
          ctx.font = `${fontSize}px Inter, Arial`;
          ctx.fillStyle = f.style.fillColor || '#ffffff';
          ctx.fillText(geom.text, geom.point.x, geom.point.y);
        } else if (geom.type === 'image') {
          const img = loadedImages[geom.src];
          if (img) {
            ctx.save();
            ctx.translate(geom.origin.x + geom.width / 2, geom.origin.y + geom.height / 2);
            if (f.rotation) ctx.rotate(f.rotation * Math.PI / 180);
            const s = f.scale ?? 1;
            ctx.scale(s, s);
            ctx.drawImage(img, -geom.width / 2, -geom.height / 2, geom.width, geom.height);
            ctx.restore();
          }
        }

        // Auto Area Labels
        if (geom.type === 'polygon' || geom.type === 'rectangle') {
          const pts = toPolygonPoints(geom);
          if (pts.length >= 3) {
            const ctr = centroid(pts);
            const areaVal = areaOfPolygon(pts);

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#070d1a';

            const bounds = boundsOfPoints(pts);
            const worldFontSize = Math.min(1.8, bounds.width / 6.5, bounds.height / 5.0);
            ctx.font = `bold ${worldFontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const yOffset = worldFontSize * 0.7;
            ctx.lineWidth = worldFontSize * 0.15;

            const mockSettings = {
              units: project.settings.units,
              bighaSqM: project.settings.bighaSqM || 2529.0,
              biswaSqM: (project.settings.bighaSqM || 2529.0) / 20,
              marlaSqM: project.settings.marlaSqM || 25.2929,
              kanalSqM: project.settings.kanalSqM || 505.857
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

        // Dimensions
        if (showDimensions) {
          ctx.save();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '1.1px Inter, sans-serif';
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
            ctx.fillText(roundTo(dist, 2).toString(), 0, -0.4);
            ctx.restore();
          }
          ctx.restore();
        }
      }

      ctx.restore();
      resolve(offscreen);
    });
  });
};

export const exportToPNG = (
  project: Project,
  filename: string,
  selectedFeatureIds?: string[],
  viewportBounds?: { minX: number; maxX: number; minY: number; maxY: number }
): void => {
  const hasSelection = selectedFeatureIds && selectedFeatureIds.length > 0;
  let choice = "1";
  
  if (hasSelection && viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '2' for Selected Area Only (Sirf select kiye plots)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1, 2 or 3):", "1") || "1";
  } else if (viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1 or 3):", "1") || "1";
  }

  const onlyDrawSelected = choice === "2";
  const cropToView = choice === "3" ? viewportBounds : undefined;

  const width = 8192;
  const height = 6144;
  renderProjectToOffscreenCanvas(project, width, height, project.settings.showGrid, true, selectedFeatureIds, onlyDrawSelected, cropToView).then(offscreen => {
    const link = document.createElement("a");
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    link.href = offscreen.toDataURL("image/png");
    link.click();
  });
};

export const exportToJPEG = (
  project: Project,
  filename: string,
  selectedFeatureIds?: string[],
  viewportBounds?: { minX: number; maxX: number; minY: number; maxY: number },
  quality = 0.95
): void => {
  const hasSelection = selectedFeatureIds && selectedFeatureIds.length > 0;
  let choice = "1";
  
  if (hasSelection && viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '2' for Selected Area Only (Sirf select kiye plots)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1, 2 or 3):", "1") || "1";
  } else if (viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1 or 3):", "1") || "1";
  }

  const onlyDrawSelected = choice === "2";
  const cropToView = choice === "3" ? viewportBounds : undefined;

  const width = 8192;
  const height = 6144;
  renderProjectToOffscreenCanvas(project, width, height, project.settings.showGrid, true, selectedFeatureIds, onlyDrawSelected, cropToView).then(offscreen => {
    const link = document.createElement("a");
    link.download = filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? filename : `${filename}.jpg`;
    link.href = offscreen.toDataURL("image/jpeg", quality);
    link.click();
  });
};

export const exportToPDF = (
  project: Project,
  canvas: HTMLCanvasElement,
  settings: PrintSettings,
  selectedFeatureIds?: string[],
  viewportBounds?: { minX: number; maxX: number; minY: number; maxY: number }
): void => {
  const hasSelection = selectedFeatureIds && selectedFeatureIds.length > 0;
  let choice = "1";
  
  if (hasSelection && viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '2' for Selected Area Only (Sirf select kiye plots)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1, 2 or 3):", "1") || "1";
  } else if (viewportBounds) {
    choice = window.prompt("Choose Export Area (Download Area Select Karein):\n\nType '1' for Full Map (Poora Map download)\nType '3' for Current Screen View (Jitna screen par zoom kiya dikh raha hai)\n\nEnter choice (1 or 3):", "1") || "1";
  }

  const onlyDrawSelected = choice === "2";
  const cropToView = choice === "3" ? viewportBounds : undefined;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (cropToView) {
    minX = cropToView.minX;
    maxX = cropToView.maxX;
    minY = cropToView.minY;
    maxY = cropToView.maxY;
  } else {
    const targetFeatures = onlyDrawSelected && hasSelection 
      ? project.features.filter(f => selectedFeatureIds.includes(f.id))
      : project.features;

    targetFeatures.forEach(f => {
      const layer = project.layers.find(l => l.id === f.layerId);
      if (layer && !layer.visible) return;
      const b = geometryBounds(f.geometry);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    });
  }

  if (minX === Infinity) {
    minX = -100; minY = -100; maxX = 100; maxY = 100;
  }

  const pdf = new jsPDF({
    orientation: settings.orientation,
    unit: "mm",
    format: settings.paperSize.toLowerCase(),
  });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const pxPerMm = 12; // 300 DPI high resolution
  const canvasWidth = Math.round(pdfWidth * pxPerMm);
  const canvasHeight = Math.round(pdfHeight * pxPerMm);

  renderProjectToOffscreenCanvas(project, canvasWidth, canvasHeight, project.settings.showGrid, settings.showDimensions, selectedFeatureIds, onlyDrawSelected, cropToView).then(offscreen => {
    const imgData = offscreen.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${settings.title || project.name}.pdf`);
  });
};
