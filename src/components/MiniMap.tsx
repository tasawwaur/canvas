import React, { useRef, useEffect, useState } from 'react';
import { Feature, Layer, Viewport, Point } from '../types';

type MiniMapProps = {
  features: Feature[];
  layers: Layer[];
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: Viewport) => void;
};

export const MiniMap: React.FC<MiniMapProps> = ({
  features,
  layers,
  viewport,
  canvasWidth,
  canvasHeight,
  onViewportChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const miniMapWidth = 280;
  const miniMapHeight = 180;

  // Compute bounding box for all features to determine minimap scale
  const getBounds = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    features.forEach(f => {
      // Very rough bounding box approximation for minimap
      const pts: Point[] = [];
      const g = f.geometry;
      if (g.type === 'point' || g.type === 'label' || g.type === 'symbol') pts.push(g.point);
      if (g.type === 'line') pts.push(...g.points);
      if (g.type === 'polyline' || g.type === 'polygon') pts.push(...g.points);
      if (g.type === 'rectangle') {
        pts.push(g.origin);
        pts.push({ x: g.origin.x + g.width, y: g.origin.y + g.height });
      }
      if (g.type === 'circle') {
        pts.push({ x: g.center.x - g.radius, y: g.center.y - g.radius });
        pts.push({ x: g.center.x + g.radius, y: g.center.y + g.radius });
      }

      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
    });

    if (minX === Infinity) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    }

    // Add padding
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  };

  const drawMinimap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, miniMapWidth, miniMapHeight);
    
    const bounds = getBounds();
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    
    // Scale from world to minimap coords
    const scaleX = miniMapWidth / bw;
    const scaleY = miniMapHeight / bh;
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = (miniMapWidth - bw * scale) / 2 - bounds.minX * scale;
    const offsetY = (miniMapHeight - bh * scale) / 2 - bounds.minY * scale;

    // Draw features
    features.forEach(f => {
      const layer = layers.find(l => l.id === f.layerId);
      if (!layer || !layer.visible) return;

      ctx.fillStyle = f.style.fillColor || layer.color;
      ctx.strokeStyle = f.style.borderColor || layer.color;
      ctx.globalAlpha = f.style.fillOpacity ?? 0.5;

      const g = f.geometry;
      ctx.beginPath();
      
      const toMiniMap = (p: Point) => ({
        x: p.x * scale + offsetX,
        y: p.y * scale + offsetY
      });

      if (g.type === 'point' || g.type === 'label' || g.type === 'symbol') {
        const p = toMiniMap(g.type === 'point' ? g.point : (g as any).point);
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (g.type === 'line') {
        const p1 = toMiniMap(g.points[0]);
        const p2 = toMiniMap(g.points[1]);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (g.type === 'polyline' || g.type === 'polygon') {
        if (g.points.length > 0) {
          const p0 = toMiniMap(g.points[0]);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < g.points.length; i++) {
            const p = toMiniMap(g.points[i]);
            ctx.lineTo(p.x, p.y);
          }
          if (g.type === 'polygon') {
            ctx.closePath();
            ctx.fill();
          }
          ctx.stroke();
        }
      } else if (g.type === 'rectangle') {
        const p = toMiniMap(g.origin);
        ctx.rect(p.x, p.y, g.width * scale, g.height * scale);
        ctx.fill();
        ctx.stroke();
      } else if (g.type === 'circle') {
        const p = toMiniMap(g.center);
        ctx.arc(p.x, p.y, g.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // Draw viewport rectangle
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)'; // amber
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    
    // Viewport bounds in world coords
    const vwWorld = canvasWidth / viewport.scale;
    const vhWorld = canvasHeight / viewport.scale;
    
    const vpTL = { x: -viewport.x / viewport.scale, y: -viewport.y / viewport.scale };
    
    const vpMiniMapX = vpTL.x * scale + offsetX;
    const vpMiniMapY = vpTL.y * scale + offsetY;
    const vpMiniMapW = vwWorld * scale;
    const vpMiniMapH = vhWorld * scale;
    
    ctx.strokeRect(vpMiniMapX, vpMiniMapY, vpMiniMapW, vpMiniMapH);
    ctx.setLineDash([]);
  };

  useEffect(() => {
    drawMinimap();
  }, [features, layers, viewport, canvasWidth, canvasHeight]);

  const handleInteract = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mousemove' && !isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const bounds = getBounds();
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const scaleX = miniMapWidth / bw;
    const scaleY = miniMapHeight / bh;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (miniMapWidth - bw * scale) / 2 - bounds.minX * scale;
    const offsetY = (miniMapHeight - bh * scale) / 2 - bounds.minY * scale;

    // Convert minimap click to world coordinates
    const worldX = (mx - offsetX) / scale;
    const worldY = (my - offsetY) / scale;

    // Update viewport so the center of the viewport is at worldX, worldY
    const newVx = -(worldX * viewport.scale - canvasWidth / 2);
    const newVy = -(worldY * viewport.scale - canvasHeight / 2);

    onViewportChange({ ...viewport, x: newVx, y: newVy });
  };

  return (
    <div className="mini-map">
      <div className="mini-map-header">Overview</div>
      <canvas
        ref={canvasRef}
        width={miniMapWidth}
        height={miniMapHeight}
        className="mini-map-canvas"
        onMouseDown={(e) => { setIsDragging(true); handleInteract(e); }}
        onMouseMove={handleInteract}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => { setIsDragging(true); handleInteract(e); }}
        onTouchMove={handleInteract}
        onTouchEnd={() => setIsDragging(false)}
      />
    </div>
  );
};
