import type { Feature, Geometry, Point } from "../types";

export const createId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export const nowIso = () => new Date().toISOString();

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const roundTo = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const areaOfPolygon = (points: Point[]) => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
};

export const perimeterOfPolygon = (points: Point[]) => {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += distance(a, b);
  }
  return sum;
};

export const polylineLength = (points: Point[]) => {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    sum += distance(points[i], points[i + 1]);
  }
  return sum;
};

export const featureCenter = (feature: Feature): Point => {
  const geometry = feature.geometry;
  switch (geometry.type) {
    case "point":
      return geometry.point;
    case "label":
      return geometry.point;
    case "line":
    case "polyline":
    case "polygon":
      return centroid(geometry.points);
    case "image":
    case "rectangle":
      return {
        x: geometry.origin.x + geometry.width / 2,
        y: geometry.origin.y + geometry.height / 2,
      };
    case "circle":
      return geometry.center;
    case "arrow":
      return midpoint(geometry.start, geometry.end);
    case "symbol":
      return geometry.point;
  }
};

export const centroid = (points: Point[]) => {
  if (!points.length) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const area = areaOfPolygon(points);
  if (area === 0) {
    const total = points.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    return { x: total.x / points.length, y: total.y / points.length };
  }
  let cx = 0;
  let cy = 0;
  let factor: number;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    factor = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * factor;
    cy += (a.y + b.y) * factor;
  }
  const scaledArea = area * 6;
  return { x: cx / scaledArea, y: cy / scaledArea };
};

export const boundsOfPoints = (points: Point[]) => {
  if (!points.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const geometryBounds = (geometry: Geometry) => {
  switch (geometry.type) {
    case "point":
    case "label":
    case "symbol":
      return {
        minX: geometry.point.x,
        minY: geometry.point.y,
        maxX: geometry.point.x,
        maxY: geometry.point.y,
        width: 0,
        height: 0,
      };
    case "line":
    case "polyline":
    case "polygon":
      return boundsOfPoints(geometry.points);
    case "image":
    case "rectangle":
      return boundsOfPoints([
        geometry.origin,
        { x: geometry.origin.x + geometry.width, y: geometry.origin.y + geometry.height },
      ]);
    case "circle":
      return {
        minX: geometry.center.x - geometry.radius,
        minY: geometry.center.y - geometry.radius,
        maxX: geometry.center.x + geometry.radius,
        maxY: geometry.center.y + geometry.radius,
        width: geometry.radius * 2,
        height: geometry.radius * 2,
      };
    case "arrow":
      return boundsOfPoints([geometry.start, geometry.end]);
  }
};

export const toPolygonPoints = (geometry: Geometry): Point[] => {
  switch (geometry.type) {
    case "polygon":
      return geometry.points;
    case "image":
    case "rectangle":
      return [
        geometry.origin,
        { x: geometry.origin.x + geometry.width, y: geometry.origin.y },
        { x: geometry.origin.x + geometry.width, y: geometry.origin.y + geometry.height },
        { x: geometry.origin.x, y: geometry.origin.y + geometry.height },
      ];
    case "circle": {
      const segments = 64;
      return Array.from({ length: segments }, (_, index) => {
        const angle = (index / segments) * Math.PI * 2;
        return {
          x: geometry.center.x + Math.cos(angle) * geometry.radius,
          y: geometry.center.y + Math.sin(angle) * geometry.radius,
        };
      });
    }
    default:
      return [];
  }
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const distanceToSegment = (point: Point, a: Point, b: Point) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return distance(point, a);
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
};

export const hitTestGeometry = (geometry: Geometry, point: Point, tolerance = 8) => {
  switch (geometry.type) {
    case "point":
    case "label":
    case "symbol":
      return distance(point, geometry.point) <= tolerance;
    case "line":
      return distanceToSegment(point, geometry.points[0], geometry.points[1]) <= tolerance;
    case "polyline":
      return geometry.points.some((vertex, index) => {
        if (index === geometry.points.length - 1) return false;
        return distanceToSegment(point, vertex, geometry.points[index + 1]) <= tolerance;
      });
    case "polygon": {
      const polygon = geometry.points;
      return pointInPolygon(point, polygon) || polygon.some((vertex) => distance(vertex, point) <= tolerance) || polygon.some((vertex, index) => {
        if (index === polygon.length - 1) return distanceToSegment(point, vertex, polygon[0]) <= tolerance;
        return distanceToSegment(point, vertex, polygon[index + 1]) <= tolerance;
      });
    }
    case "image":
    case "rectangle": {
      const polygon = toPolygonPoints(geometry);
      return pointInPolygon(point, polygon) || polygon.some((vertex) => distance(vertex, point) <= tolerance);
    }
    case "circle": {
      const delta = Math.abs(distance(point, geometry.center) - geometry.radius);
      return delta <= tolerance;
    }
    case "arrow":
      return distanceToSegment(point, geometry.start, geometry.end) <= tolerance;
  }
};

export const translateGeometry = (geometry: Geometry, dx: number, dy: number): Geometry => {
  switch (geometry.type) {
    case "point":
      return { ...geometry, point: { x: geometry.point.x + dx, y: geometry.point.y + dy } };
    case "label":
      return { ...geometry, point: { x: geometry.point.x + dx, y: geometry.point.y + dy } };
    case "symbol":
      return { ...geometry, point: { x: geometry.point.x + dx, y: geometry.point.y + dy } };
    case "line":
      return {
        ...geometry,
        points: geometry.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) as [Point, Point],
      };
    case "polyline":
    case "polygon":
      return {
        ...geometry,
        points: geometry.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    case "image":
    case "rectangle":
      return {
        ...geometry,
        origin: { x: geometry.origin.x + dx, y: geometry.origin.y + dy },
      };
    case "circle":
      return {
        ...geometry,
        center: { x: geometry.center.x + dx, y: geometry.center.y + dy },
      };
    case "arrow":
      return {
        ...geometry,
        start: { x: geometry.start.x + dx, y: geometry.start.y + dy },
        end: { x: geometry.end.x + dx, y: geometry.end.y + dy },
      };
  }
};

export const normalizeRectangle = (start: Point, current: Point) => {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  return {
    origin: { x, y },
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
};

export const polygonIsClosedEnough = (points: Point[], target: Point, tolerance = 16) =>
  points.length > 2 && distance(points[0], target) <= tolerance;

export const angleBetweenPoints = (a: Point, b: Point, c: Point): number => {
  const angle1 = Math.atan2(a.y - b.y, a.x - b.x);
  const angle2 = Math.atan2(c.y - b.y, c.x - b.x);
  let angle = (angle2 - angle1) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
};

export const lineSegmentIntersection = (a1: Point, a2: Point, b1: Point, b2: Point): Point | null => {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (d === 0) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d;
  const u = ((a1.x - b1.x) * (a1.y - a2.y) - (a1.y - b1.y) * (a1.x - a2.x)) / d;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: a1.x + t * (a2.x - a1.x),
      y: a1.y + t * (a2.y - a1.y),
    };
  }
  return null;
};

export const splitPolygonByLine = (polygon: Point[], lineStart: Point, lineEnd: Point): [Point[], Point[]] | null => {
  const intersections: {point: Point, index: number}[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    const p1 = polygon[i];
    const p2 = polygon[next];
    const inter = lineSegmentIntersection(p1, p2, lineStart, lineEnd);
    if (inter) {
      intersections.push({point: inter, index: i});
    }
  }
  if (intersections.length === 2) {
    const [i1, i2] = intersections.sort((a,b) => a.index - b.index);
    const poly1 = [...polygon.slice(0, i1.index + 1), i1.point, i2.point, ...polygon.slice(i2.index + 1)];
    const poly2 = [i1.point, ...polygon.slice(i1.index + 1, i2.index + 1), i2.point];
    return [poly1, poly2];
  }
  return null;
};

export const mergeAdjacentPolygons = (poly1: Point[], poly2: Point[]): Point[] | null => {
  if (!poly1 || poly1.length < 3 || !poly2 || poly2.length < 3) return null;
  const tolerance = 0.5;
  let sharedIndex1 = -1;
  let sharedIndex2 = -1;

  for (let i = 0; i < poly1.length; i++) {
    for (let j = 0; j < poly2.length; j++) {
      if (distance(poly1[i], poly2[j]) < tolerance) {
        sharedIndex1 = i;
        sharedIndex2 = j;
        break;
      }
    }
    if (sharedIndex1 !== -1) break;
  }

  if (sharedIndex1 === -1 || sharedIndex2 === -1) return null;

  const next1 = (sharedIndex1 + 1) % poly1.length;
  const prev1 = (sharedIndex1 - 1 + poly1.length) % poly1.length;
  const next2 = (sharedIndex2 + 1) % poly2.length;
  const prev2 = (sharedIndex2 - 1 + poly2.length) % poly2.length;

  let nextShared1 = -1;
  let nextShared2 = -1;

  if (distance(poly1[next1], poly2[prev2]) < tolerance) {
    nextShared1 = next1;
    nextShared2 = prev2;
  } else if (distance(poly1[next1], poly2[next2]) < tolerance) {
    nextShared1 = next1;
    nextShared2 = next2;
  } else if (distance(poly1[prev1], poly2[next2]) < tolerance) {
    nextShared1 = prev1;
    nextShared2 = next2;
  } else if (distance(poly1[prev1], poly2[prev2]) < tolerance) {
    nextShared1 = prev1;
    nextShared2 = prev2;
  }

  if (nextShared1 === -1) return null;

  const newPoints: Point[] = [];
  let idx = nextShared1;
  while (true) {
    newPoints.push(poly1[idx]);
    if (idx === sharedIndex1) break;
    idx = (idx + 1) % poly1.length;
  }

  const step = (nextShared2 + 1) % poly2.length === sharedIndex2 ? 1 : -1;
  idx = (nextShared2 + step + poly2.length) % poly2.length;
  while (idx !== sharedIndex2) {
    newPoints.push(poly2[idx]);
    idx = (idx + step + poly2.length) % poly2.length;
  }

  return newPoints;
};

export const offsetPolyline = (points: Point[], dist: number): {left: Point[], right: Point[], center: Point[]} => {
  const left: Point[] = [];
  const right: Point[] = [];
  for(let i=0; i<points.length-1; i++) {
    const p1 = points[i];
    const p2 = points[i+1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = -dy / len * dist;
    const ny = dx / len * dist;
    left.push({x: p1.x + nx, y: p1.y + ny});
    left.push({x: p2.x + nx, y: p2.y + ny});
    right.push({x: p1.x - nx, y: p1.y - ny});
    right.push({x: p2.x - nx, y: p2.y - ny});
  }
  return { left, right, center: points };
};

export const closestPointOnSegment = (point: Point, a: Point, b: Point): Point => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return a;
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  return { x: a.x + abx * t, y: a.y + aby * t };
};

export const findMidpoints = (points: Point[]): Point[] => {
  const midpoints: Point[] = [];
  for(let i=0; i<points.length-1; i++) {
    midpoints.push(midpoint(points[i], points[i+1]));
  }
  if (points.length > 2) {
    midpoints.push(midpoint(points[points.length-1], points[0]));
  }
  return midpoints;
};

export const findAllIntersections = (features: Feature[]): Point[] => {
  const intersections: Point[] = [];
  const segments: {a: Point, b: Point}[] = [];
  
  features.forEach(f => {
    const g = f.geometry;
    if (g.type === 'line') {
      segments.push({a: g.points[0], b: g.points[1]});
    } else if (g.type === 'polyline' || g.type === 'polygon') {
      for (let i = 0; i < g.points.length - 1; i++) {
        segments.push({a: g.points[i], b: g.points[i+1]});
      }
      if (g.type === 'polygon' && g.points.length > 2) {
        segments.push({a: g.points[g.points.length - 1], b: g.points[0]});
      }
    } else if (g.type === 'rectangle') {
      const pts = toPolygonPoints(g);
      for (let i = 0; i < 4; i++) {
        segments.push({a: pts[i], b: pts[(i+1)%4]});
      }
    }
  });
  
  const tolerance = 0.05;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const inter = lineSegmentIntersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b);
      if (inter) {
        if (!intersections.some(p => distance(p, inter) < tolerance)) {
          intersections.push(inter);
        }
      }
    }
  }
  return intersections;
};

export const rotatePoint = (point: Point, center: Point, angleDeg: number): Point => {
  const angleRad = angleDeg * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: cos * (point.x - center.x) - sin * (point.y - center.y) + center.x,
    y: sin * (point.x - center.x) + cos * (point.y - center.y) + center.y,
  };
};

export const scalePoints = (points: Point[], center: Point, factor: number): Point[] => {
  return points.map(p => ({
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor,
  }));
};

export const rotateGeometry = (geometry: Geometry, center: Point, angleDeg: number): Geometry => {
  switch(geometry.type) {
    case 'point': return {...geometry, point: rotatePoint(geometry.point, center, angleDeg)};
    case 'label': return {...geometry, point: rotatePoint(geometry.point, center, angleDeg)};
    case 'symbol': return {...geometry, point: rotatePoint(geometry.point, center, angleDeg)};
    case 'line': return {...geometry, points: geometry.points.map(p => rotatePoint(p, center, angleDeg)) as [Point, Point]};
    case 'polyline': 
    case 'polygon': return {...geometry, points: geometry.points.map(p => rotatePoint(p, center, angleDeg))};
    case 'image': return {
      ...geometry,
      origin: rotatePoint(geometry.origin, center, angleDeg)
    };
    case 'rectangle': return {
      type: 'polygon',
      points: toPolygonPoints(geometry).map(p => rotatePoint(p, center, angleDeg))
    };
    case 'circle': return {...geometry, center: rotatePoint(geometry.center, center, angleDeg)};
    case 'arrow': return {...geometry, start: rotatePoint(geometry.start, center, angleDeg), end: rotatePoint(geometry.end, center, angleDeg)};
  }
  return geometry;
};

export const scaleGeometry = (geometry: Geometry, center: Point, factor: number): Geometry => {
  switch(geometry.type) {
    case 'point': return {...geometry, point: scalePoints([geometry.point], center, factor)[0]};
    case 'label': return {...geometry, point: scalePoints([geometry.point], center, factor)[0]};
    case 'symbol': return {...geometry, point: scalePoints([geometry.point], center, factor)[0], size: geometry.size * factor};
    case 'line': return {...geometry, points: scalePoints(geometry.points, center, factor) as [Point, Point]};
    case 'polyline': 
    case 'polygon': return {...geometry, points: scalePoints(geometry.points, center, factor)};
    case 'image': return {
      ...geometry,
      origin: scalePoints([geometry.origin], center, factor)[0],
      width: geometry.width * factor,
      height: geometry.height * factor
    };
    case 'rectangle': return {
      type: 'polygon',
      points: toPolygonPoints(geometry).map(p => scalePoints([p], center, factor)[0])
    };
    case 'circle': return {...geometry, center: scalePoints([geometry.center], center, factor)[0], radius: geometry.radius * factor};
    case 'arrow': return {...geometry, start: scalePoints([geometry.start], center, factor)[0], end: scalePoints([geometry.end], center, factor)[0], headSize: geometry.headSize * factor};
  }
  return geometry;
};
