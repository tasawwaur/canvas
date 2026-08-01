// ============================================================
// LAND MAPPING PRO — Complete Type System
// ============================================================

/** 2D coordinate */
export type Point = {
  x: number;
  y: number;
};

/** Camera state for infinite canvas */
export type Viewport = {
  x: number;
  y: number;
  scale: number;
};

/** All available drawing / interaction tools */
export type Tool =
  | "select"
  | "pan"
  | "line"
  | "polyline"
  | "rectangle"
  | "circle"
  | "polygon"
  | "freehand"
  | "point"
  | "label"
  | "plotBoundary"
  | "road"
  | "divider"
  | "arrow"
  | "measure"
  | "gate"
  | "tree"
  | "pole"
  | "waterTank"
  | "park"
  | "school"
  | "temple"
  | "mosque"
  | "exportCrop"
  | "emoji"
  | "placeBoundary";

/** Plot availability status */
export type PlotStatus = "available" | "sold" | "booked";

/** Plot land-use category */
export type PlotCategory =
  | "residential"
  | "commercial"
  | "park"
  | "institutional"
  | "utility";

/** Snapping behaviour modes */
export type SnapMode =
  | "endpoint"
  | "midpoint"
  | "intersection"
  | "grid"
  | "vertex";

/** All supported area measurement units */
export type AreaUnit =
  | "sqft"
  | "sqm"
  | "sqyd"
  | "acre"
  | "hectare"
  | "bigha"
  | "biswa"
  | "marla"
  | "kanal";

/** Print paper sizes */
export type PaperSize = "A0" | "A1" | "A2" | "A3" | "A4";

/** Print orientation */
export type Orientation = "landscape" | "portrait";

/** Map symbol identifiers (placed as point features) */
export type SymbolType = string;

// ============================================================
// Geometry
// ============================================================

export type Geometry =
  | { type: "point"; point: Point }
  | { type: "line"; points: [Point, Point] }
  | { type: "polyline"; points: Point[] }
  | { type: "polygon"; points: Point[] }
  | { type: "rectangle"; origin: Point; width: number; height: number }
  | { type: "circle"; center: Point; radius: number }
  | { type: "label"; point: Point; text: string }
  | { type: "arrow"; start: Point; end: Point; headSize: number }
  | { type: "symbol"; point: Point; symbolType: SymbolType; size: number }
  | { type: "image"; origin: Point; width: number; height: number; src: string };

// ============================================================
// Feature styling (per-feature visual overrides)
// ============================================================

export type FeatureStyle = {
  fillColor?: string;
  borderColor?: string;
  fillOpacity?: number;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
};

// ============================================================
// Feature properties (plot metadata)
// ============================================================

export type FeatureProperties = {
  ownerName?: string;
  plotNumber?: string;
  mobileNumber?: string;
  khasraNumber?: string;
  village?: string;
  tehsil?: string;
  district?: string;
  landType?: string;
  registryDetails?: string;
  notes?: string;
  remarks?: string;
  rate?: number;
  totalValue?: number;
  status?: PlotStatus;
  category?: PlotCategory;
  roadWidth?: number;
  photos?: string[];
  documents?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
};

// ============================================================
// Feature (a single drawable entity)
// ============================================================

export type Feature = {
  id: string;
  layerId: string;
  name: string;
  geometry: Geometry;
  style: FeatureStyle;
  properties: FeatureProperties;
  createdAt: string;
  updatedAt: string;
  zIndex: number;
  rotation?: number;
  scale?: number;
};

// ============================================================
// Layer
// ============================================================

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  order: number;
  kind: "vector" | "raster";
  imageHref?: string;
};

// ============================================================
// Project settings
// ============================================================

export type ProjectSettings = {
  units: AreaUnit;
  bighaSqM: number;
  biswaSqM: number;
  marlaSqM: number;
  kanalSqM: number;
  gridSize: number;
  snapTolerance: number;
  labelFontSize: number;
  snapModes: SnapMode[];
  showGrid: boolean;
  showDimensions: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  backgroundColor: string;
};

// ============================================================
// Project (root document)
// ============================================================

export type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  layers: Layer[];
  features: Feature[];
};

// ============================================================
// Print settings
// ============================================================

export type PrintSettings = {
  paperSize: PaperSize;
  orientation: Orientation;
  scale: number;
  fitToPage: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  title: string;
};

// ============================================================
// Recent files (for localStorage persistence)
// ============================================================

export type RecentFile = {
  name: string;
  path: string;
  lastOpened: string;
};

// ============================================================
// Saved Project Info (for Browser History database)
// ============================================================

export type SavedProjectInfo = {
  id: string;
  name: string;
  updatedAt: string;
  featureCount: number;
};

// ============================================================
// Draft state (in-progress drawing)
// ============================================================

export type DraftState =
  | {
      tool: "line" | "rectangle" | "circle" | "point" | "label" | "arrow" | "exportCrop";
      start: Point;
      current: Point;
      text?: string;
    }
  | {
      tool: "polyline" | "polygon" | "freehand" | "plotBoundary" | "road";
      points: Point[];
      current?: Point;
    }
  | {
      tool: "divider";
      start: Point;
      current: Point;
      targetFeatureId?: string;
    }
  | {
      tool: "measure";
      points: Point[];
      current?: Point;
    }
  | {
      tool: "select";
      start: Point;
      current: Point;
    }
  | null;
