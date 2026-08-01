# Land Mapping CAD Platform

React + TypeScript based land-survey and cadastral mapping workspace.

## What Works

- Infinite SVG canvas with pan and smooth zoom
- Drawing tools for line, polyline, rectangle, circle, polygon, freehand, point, and label
- Layer system with visibility, lock, opacity, color, and order controls
- Plot/property inspector with owner, plot, khasra, village, tehsil, district, land type, and notes
- Measurement helpers for distance, perimeter, and area
- Snap-to-grid and snap-to-vertex support
- Mini map and scale bar
- Undo/redo history
- Import and export for JSON, GeoJSON, CSV, SVG, and DXF

## Run

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Notes

- Bigha and beegha conversions use the project setting `bighaSqM`.
- DWG export is not included because it requires a proprietary SDK.
- Satellite and raster overlays are supported as raster layers, ready for future georeferenced image workflows.

## Next Steps

If you want, I can extend this into:

1. Satellite/georeferenced image import
2. GeoJSON and CSV importers with validation
3. PostGIS-backed online sync
4. Print layout and PDF export
