import { Point, Feature, Geometry } from '../types';
import { createId, nowIso } from './geometry';

// Simple RDP path simplification to reduce point counts for easy editing
function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((p.x - p1.x) ** 2 + (p.y - p1.y) ** 2);
  }
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(dx * dx + dy * dy);
}

export function simplifyPath(points: Point[], tolerance: number = 2.5): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const results1 = simplifyPath(points.slice(0, index + 1), tolerance);
    const results2 = simplifyPath(points.slice(index), tolerance);
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [points[0], points[end]];
  }
}

// Moore-Neighbor contour tracing algorithm
function traceContour(
  startX: number,
  startY: number,
  width: number,
  height: number,
  binaryData: Uint8Array,
  visited: Uint8Array
): Point[] {
  const points: Point[] = [];
  let cx = startX;
  let cy = startY;

  points.push({ x: cx, y: cy });
  visited[cy * width + cx] = 1;

  // Directions: Right, Down-Right, Down, Down-Left, Left, Up-Left, Up, Up-Right
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let backtrackDir = 4; // Start looking left
  let maxSteps = 2000;
  let steps = 0;

  while (steps < maxSteps) {
    let foundNext = false;
    let nextDir = backtrackDir;

    for (let i = 0; i < 8; i++) {
      const dirIndex = (nextDir + i) % 8;
      const nx = cx + dx[dirIndex];
      const ny = cy + dy[dirIndex];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = ny * width + nx;
        if (binaryData[idx] === 1) {
          cx = nx;
          cy = ny;
          points.push({ x: cx, y: cy });
          visited[idx] = 1;
          // Backtrack direction is opposite of current move direction
          backtrackDir = (dirIndex + 4) % 8;
          foundNext = true;
          break;
        }
      }
    }

    if (!foundNext) break;

    // Check if returned to start point
    if (points.length > 3 && Math.abs(cx - startX) <= 1 && Math.abs(cy - startY) <= 1) {
      break;
    }
    steps++;
  }

  return points;
}

// Main image-to-vector tracing function
export function traceImageToFeatures(
  canvas: HTMLCanvasElement,
  layerId: string
): Feature[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // 1. Analyze background brightness to determine adaptive threshold
  let sampleSum = 0;
  let sampleCount = 0;
  // Sample a grid
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 10))) {
    for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 10))) {
      const idx = (y * width + x) * 4;
      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      sampleSum += brightness;
      sampleCount++;
    }
  }
  const avgBgBrightness = sampleSum / sampleCount;
  const isLightBg = avgBgBrightness > 127;

  // 2. Thresholding: Create binary map (1 for edge/line pixel, 0 for background)
  const binaryData = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const brightness = (r + g + b) / 3;

    const pixelIdx = i / 4;
    if (isLightBg) {
      // Light background: find dark lines
      binaryData[pixelIdx] = brightness < 120 ? 1 : 0;
    } else {
      // Dark background: find light lines
      binaryData[pixelIdx] = brightness > 130 ? 1 : 0;
    }
  }

  // 3. Trace contours
  const visited = new Uint8Array(width * height);
  const features: Feature[] = [];

  // Downsample grid scans to avoid overlapping fine contours
  const scanStep = 2;

  for (let y = scanStep; y < height - scanStep; y += scanStep) {
    for (let x = scanStep; x < width - scanStep; x += scanStep) {
      const idx = y * width + x;
      if (binaryData[idx] === 1 && visited[idx] === 0) {
        const rawPoints = traceContour(x, y, width, height, binaryData, visited);
        if (rawPoints.length > 5) {
          // Simplify path to make it editable (RDP algorithm)
          const simplified = simplifyPath(rawPoints, 3.0);
          if (simplified.length > 2) {
            // Map coordinates from image space to CAD world space
            // Centering them and fitting to a standard viewport scale
            const mappedPoints = simplified.map((p) => ({
              x: (p.x - width / 2) * 1.5,
              y: (p.y - height / 2) * 1.5,
            }));

            // Determine if the shape is closed (polygon) or open (polyline)
            const first = mappedPoints[0];
            const last = mappedPoints[mappedPoints.length - 1];
            const dist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
            const isClosed = dist < 20 && mappedPoints.length >= 3;

            const geometry: Geometry = isClosed
              ? { type: 'polygon', points: mappedPoints }
              : { type: 'polyline', points: mappedPoints };

            features.push({
              id: createId('feature'),
              layerId,
              name: isClosed ? 'Scanned Plot' : 'Scanned Line',
              zIndex: 1,
              geometry,
              style: {
                borderColor: '#10b981', // Emerald green for scanned elements
                fillColor: isClosed ? 'rgba(16, 185, 129, 0.08)' : undefined,
                lineWidth: 2,
              },
              properties: {
                notes: 'Scanned from image file.',
              },
              createdAt: nowIso(),
              updatedAt: nowIso(),
            });
          }
        }
      }
    }
  }

  return features;
}

// Dynamically load PDF.js from CDN and render first page to canvas
export async function renderPdfToCanvas(
  file: File
): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = async () => {
      try {
        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            
            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              resolve(canvas);
            } else {
              resolve(null);
            }
          } catch (err) {
            console.error('PDF.js render error', err);
            resolve(null);
          }
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('PDF loading error', err);
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}
