import type { SymbolType } from "../types";

export const SymbolRenderer = {
  drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    
    // Draw two brick pillars on the sides
    const pillarSize = size / 3;
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - size / 2, y - pillarSize / 2, pillarSize, pillarSize);
    ctx.strokeRect(x - size / 2, y - pillarSize / 2, pillarSize, pillarSize);
    ctx.fillRect(x + size / 2 - pillarSize, y - pillarSize / 2, pillarSize, pillarSize);
    ctx.strokeRect(x + size / 2 - pillarSize, y - pillarSize / 2, pillarSize, pillarSize);

    // Draw the swing radius dashed guide arcs
    ctx.strokeStyle = `${color}80`;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(x - size / 2 + pillarSize, y, size * 0.6, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size / 2 - pillarSize, y, size * 0.6, Math.PI, Math.PI * 0.5, true);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw active metal gates open at 45 degrees
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size / 2 + pillarSize, y);
    ctx.lineTo(x - size / 6, y - size / 3);
    ctx.moveTo(x + size / 2 - pillarSize, y);
    ctx.lineTo(x + size / 6, y - size / 3);
    ctx.stroke();
  },

  drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    
    // Tree trunk shadow
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size * 0.35);
    ctx.stroke();

    // 2D CAD Radial Scalloped Foliage Circles
    ctx.fillStyle = '#22c55e'; // Vibrant Green fill
    ctx.strokeStyle = '#15803d'; // Dark Green border
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // Draw central canopy
    ctx.arc(x, y - size * 0.1, size / 3, 0, Math.PI * 2);
    // Draw minor sub-canopies for rich 2D detail
    ctx.arc(x - size * 0.2, y - size * 0.2, size / 4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.2, y - size * 0.2, size / 4, 0, Math.PI * 2);
    ctx.arc(x - size * 0.2, y + size * 0.1, size / 4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.2, y + size * 0.1, size / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inside branch detail lines
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.1);
    ctx.lineTo(x - size * 0.12, y - size * 0.2);
    ctx.moveTo(x, y - size * 0.1);
    ctx.lineTo(x + size * 0.12, y - size * 0.2);
    ctx.moveTo(x, y - size * 0.1);
    ctx.lineTo(x, y + size * 0.05);
    ctx.stroke();
    
    ctx.restore();
  },

  drawPole(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    // 1. Light fixture yellow glow zone (semi-transparent light cone)
    ctx.fillStyle = 'rgba(234, 179, 8, 0.07)';
    ctx.beginPath();
    ctx.arc(x, y, size * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concrete base circular outline
    ctx.strokeStyle = '#64748b';
    ctx.fillStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. Central Pole cross arm details
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y);
    ctx.lineTo(x + size / 2, y);
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y + size / 2);
    ctx.stroke();

    // Pole center circular terminal cap
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 8, 0, Math.PI * 2);
    ctx.fill();
  },

  drawWaterTank(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Base structural column outlines (grid projection)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.beginPath();
    ctx.rect(x - size / 3, y - size / 3, size * 0.66, size * 0.66);
    ctx.fill();
    ctx.stroke();

    // Circular main reservoir outline
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner concentric support ring
    ctx.beginPath();
    ctx.arc(x, y, size / 3, 0, Math.PI * 2);
    ctx.stroke();

    // Water level texture waves inside
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x - size / 4, y - size / 10);
    ctx.bezierCurveTo(x - size / 8, y - size / 5, x + size / 8, y, x + size / 4, y - size / 10);
    ctx.moveTo(x - size / 4, y + size / 8);
    ctx.bezierCurveTo(x - size / 8, y + size / 16, x + size / 8, y + size / 4, x + size / 4, y + size / 8);
    ctx.stroke();
    
    ctx.restore();
  },

  drawPark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    // Draw dual detailed green bushes
    this.drawTree(ctx, x - size / 3, y + size / 4, size / 1.5, '#22c55e');
    this.drawTree(ctx, x + size / 3, y + size / 4, size / 1.5, '#22c55e');
    this.drawTree(ctx, x, y - size / 4, size / 1.3, '#16a34a');

    // Draw a tiny park sitting bench CAD symbol in center
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // backrest
    ctx.moveTo(x - size / 4, y);
    ctx.lineTo(x + size / 4, y);
    // seat
    ctx.moveTo(x - size / 4, y + size / 8);
    ctx.lineTo(x + size / 4, y + size / 8);
    // armrests & leg frames
    ctx.moveTo(x - size / 4, y - size / 12);
    ctx.lineTo(x - size / 4, y + size * 0.18);
    ctx.moveTo(x + size / 4, y - size / 12);
    ctx.lineTo(x + size / 4, y + size * 0.18);
    ctx.stroke();
    ctx.restore();
  },

  drawSchool(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';

    // Multi-wing layout structure
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 4, size, size / 2); // main corridor
    ctx.rect(x - size / 2, y - size / 2, size / 4, size / 4); // left wing
    ctx.rect(x + size / 4, y - size / 2, size / 4, size / 4); // right wing
    ctx.fill();
    ctx.stroke();

    // Flagpole inside front courtyard
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.lineTo(x, y - size / 2.5);
    ctx.stroke();

    // Flag flag graphic
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2.5);
    ctx.lineTo(x + size / 3, y - size / 2.2);
    ctx.lineTo(x, y - size / 2.0);
    ctx.closePath();
    ctx.fill();
  },

  drawTemple(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';

    // Step 1: Base step platform
    ctx.beginPath();
    ctx.rect(x - size / 2, y + size / 3, size, size / 6);
    ctx.rect(x - size / 2.5, y + size / 6, size * 0.8, size / 6);
    ctx.fill();
    ctx.stroke();

    // Step 2: Triangular shikhara spire structure
    ctx.beginPath();
    ctx.moveTo(x - size / 3, y + size / 6);
    ctx.lineTo(x, y - size / 2);
    ctx.lineTo(x + size / 3, y + size / 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spire top Kalash & Orange Flag
    ctx.strokeStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y - size * 0.85);
    ctx.stroke();

    // Flag flapping
    ctx.fillStyle = '#f97316'; // Saffron orange
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.85);
    ctx.lineTo(x + size * 0.28, y - size * 0.78);
    ctx.lineTo(x, y - size * 0.72);
    ctx.closePath();
    ctx.fill();
  },

  drawMosque(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';

    // Main prayer hall base
    ctx.beginPath();
    ctx.rect(x - size / 2.5, y, size * 0.8, size * 0.4);
    ctx.fill();
    ctx.stroke();

    // Central structural Dome
    ctx.beginPath();
    ctx.arc(x, y, size / 3, Math.PI, 0);
    ctx.stroke();

    // Minarets (left/right side pillars)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 3, size / 8, size * 0.73);
    ctx.rect(x + size / 2 - size / 8, y - size / 3, size / 8, size * 0.73);
    ctx.fill();
    ctx.stroke();

    // Minaret small dome peaks
    ctx.beginPath();
    ctx.arc(x - size / 2 + size / 16, y - size / 3, size / 16, Math.PI, 0);
    ctx.arc(x + size / 2 - size / 16, y - size / 3, size / 16, Math.PI, 0);
    ctx.stroke();

    // Crescent moon star symbol at dome peak
    ctx.font = `${size * 0.35}px Arial`;
    ctx.fillStyle = '#eab308';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌙', x, y - size / 2);
  },

  drawSymbol(ctx: CanvasRenderingContext2D, symbolType: SymbolType, x: number, y: number, size: number, color: string) {
    switch (symbolType) {
      case "gate": this.drawGate(ctx, x, y, size, color); break;
      case "tree": this.drawTree(ctx, x, y, size, color); break;
      case "pole": this.drawPole(ctx, x, y, size, color); break;
      case "waterTank": this.drawWaterTank(ctx, x, y, size, color); break;
      case "park": this.drawPark(ctx, x, y, size, color); break;
      case "school": this.drawSchool(ctx, x, y, size, color); break;
      case "temple": this.drawTemple(ctx, x, y, size, color); break;
      case "mosque": this.drawMosque(ctx, x, y, size, color); break;
    }
  }
};
