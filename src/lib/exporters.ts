import { jsPDF } from "jspdf";
import type { Feature, Project, PrintSettings } from "../types";
import { geometryBounds, toPolygonPoints } from "./geometry";

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

export const exportToPNG = (canvas: HTMLCanvasElement, filename: string): void => {
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

export const exportToJPEG = (canvas: HTMLCanvasElement, filename: string, quality = 0.9): void => {
  const link = document.createElement("a");
  link.download = filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? filename : `${filename}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", quality);
  link.click();
};

export const exportToPDF = (project: Project, canvas: HTMLCanvasElement, settings: PrintSettings): void => {
  const imgData = canvas.toDataURL("image/jpeg", 1.0);
  const pdf = new jsPDF({
    orientation: settings.orientation,
    unit: "mm",
    format: settings.paperSize.toLowerCase(),
  });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasRatio = canvas.width / canvas.height;
  const pdfRatio = pdfWidth / pdfHeight;
  let printWidth = pdfWidth;
  let printHeight = pdfHeight;
  if (settings.fitToPage) {
    if (canvasRatio > pdfRatio) {
      printHeight = pdfWidth / canvasRatio;
    } else {
      printWidth = pdfHeight * canvasRatio;
    }
  }
  pdf.addImage(imgData, "JPEG", (pdfWidth - printWidth) / 2, (pdfHeight - printHeight) / 2, printWidth, printHeight);
  pdf.save(`${settings.title || project.name}.pdf`);
};
