import type { Project } from "../types";
import { createId, nowIso } from "../lib/geometry";

const layer = (
  name: string,
  color: string,
  order: number,
  kind: "vector" | "raster" = "vector"
) => ({
  id: createId(name.toLowerCase().replaceAll(" ", "_")),
  name,
  visible: true,
  locked: false,
  opacity: 1,
  color,
  lineWidth: 2,
  lineStyle: "solid" as const,
  order,
  kind,
});

export const createDefaultProject = (): Project => {
  const layers = [
    layer("Plot Boundary", "#0ea5e9", 1),
    layer("Roads", "#f59e0b", 2),
    layer("Buildings", "#8b5cf6", 3),
    layer("Parks & Open", "#22c55e", 4),
    layer("Water Lines", "#06b6d4", 5),
    layer("Electric Lines", "#a855f7", 6),
    layer("Sewer Lines", "#ef4444", 7),
    layer("Survey Points", "#e2e8f0", 8),
    layer("Labels", "#94a3b8", 9),
    layer("Measurements", "#fb923c", 10),
    layer("Symbols", "#14b8a6", 11),
    layer("Satellite", "#334155", 0, "raster"),
  ].sort((a, b) => a.order - b.order);

  return {
    id: createId("project"),
    name: "Untitled Project",
    description: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    settings: {
      units: "sqft",
      bighaSqM: 2529.0,
      biswaSqM: 126.45,
      marlaSqM: 25.2929,
      kanalSqM: 505.857,
      gridSize: 10,
      snapTolerance: 10,
      labelFontSize: 14,
      snapModes: ["endpoint", "grid", "vertex"],
      showGrid: true,
      showDimensions: true,
      autoSave: true,
      autoSaveInterval: 120000,
      backgroundColor: '#0a0f1e',
    },
    layers,
    features: [],
  };
};
