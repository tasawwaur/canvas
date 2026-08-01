import type { Feature } from "../types";
import { geometryBounds } from "../lib/geometry";

type SpatialNode = {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export class SpatialIndex {
  private cellSize: number;
  private grid: Map<string, SpatialNode[]>;

  constructor(cellSize: number = 1000) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear(): void {
    this.grid.clear();
  }

  insert(id: string, minX: number, minY: number, maxX: number, maxY: number): void {
    const startX = Math.floor(minX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);

    const node: SpatialNode = { id, minX, minY, maxX, maxY };

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(node);
      }
    }
  }

  remove(id: string): void {
    for (const [key, cell] of this.grid.entries()) {
      const filtered = cell.filter(n => n.id !== id);
      if (filtered.length === 0) {
        this.grid.delete(key);
      } else {
        this.grid.set(key, filtered);
      }
    }
  }

  query(minX: number, minY: number, maxX: number, maxY: number): string[] {
    const startX = Math.floor(minX / this.cellSize);
    const startY = Math.floor(minY / this.cellSize);
    const endX = Math.floor(maxX / this.cellSize);
    const endY = Math.floor(maxY / this.cellSize);

    const result = new Set<string>();

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const node of cell) {
            if (
              node.minX <= maxX &&
              node.maxX >= minX &&
              node.minY <= maxY &&
              node.maxY >= minY
            ) {
              result.add(node.id);
            }
          }
        }
      }
    }

    return Array.from(result);
  }

  rebuild(features: Feature[]): void {
    this.clear();
    for (const feature of features) {
      const bounds = geometryBounds(feature.geometry);
      this.insert(feature.id, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
    }
  }
}
