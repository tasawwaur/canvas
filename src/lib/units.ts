import type { ProjectSettings, AreaUnit } from "../types";
import { roundTo } from "./geometry";

const SQM_TO_SQFT = 10.7639104167;
const SQM_TO_SQYD = 1.19599;
const SQM_TO_ACRE = 0.000247105381;
const SQM_TO_HECTARE = 0.0001;

export const areaInProjectUnits = (sqm: number, settings: ProjectSettings) => {
  switch (settings.units) {
    case "sqm":
      return { value: sqm, unit: "sq m", label: "Square Meter" };
    case "sqft":
      return { value: sqm * SQM_TO_SQFT, unit: "sq ft", label: "Square Feet" };
    case "sqyd":
      return { value: sqm * SQM_TO_SQYD, unit: "sq yd", label: "Square Yard" };
    case "acre":
      return { value: sqm * SQM_TO_ACRE, unit: "acre", label: "Acre" };
    case "hectare":
      return { value: sqm * SQM_TO_HECTARE, unit: "hectare", label: "Hectare" };
    case "bigha":
      return { value: sqm / settings.bighaSqM, unit: "bigha", label: "Bigha" };
    case "biswa":
      return { value: sqm / settings.biswaSqM, unit: "biswa", label: "Biswa" };
    case "marla":
      return { value: sqm / settings.marlaSqM, unit: "marla", label: "Marla" };
    case "kanal":
      return { value: sqm / settings.kanalSqM, unit: "kanal", label: "Kanal" };
  }
};

export const formatArea = (sqm: number, settings: ProjectSettings) => {
  const { value, unit } = areaInProjectUnits(sqm, settings);
  return `${roundTo(value, 3)} ${unit}`;
};

export const formatLength = (meters: number) => `${roundTo(meters, 2)} m`;

export const formatAngle = (degrees: number) => `${roundTo(degrees, 2)}°`;

export const formatScaleLabel = (scale: number) => {
  const pct = Math.max(1, Math.round(scale * 100));
  return `${pct}%`;
};

export const getAllUnitLabels = (): Array<{id: AreaUnit, label: string}> => {
  return [
    { id: "sqm", label: "Square Meter" },
    { id: "sqft", label: "Square Feet" },
    { id: "sqyd", label: "Square Yard" },
    { id: "acre", label: "Acre" },
    { id: "hectare", label: "Hectare" },
    { id: "bigha", label: "Bigha" },
    { id: "biswa", label: "Biswa" },
    { id: "marla", label: "Marla" },
    { id: "kanal", label: "Kanal" },
  ];
};
