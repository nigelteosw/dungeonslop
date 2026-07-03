import type { Pos } from '../engine';

export const TILE = 1;

export function gridToWorld(p: Pos): [number, number, number] {
  return [p.x * TILE, 0, p.y * TILE];
}

export function boardCenter(w: number, h: number): [number, number, number] {
  return [(w - 1) / 2, 0, (h - 1) / 2];
}
