import type { Board, Dir, GameState, Pos, Unit } from "./types";
import { ORTHO } from "./types";

export function keyOf(p: Pos): string {
  return `${p.x},${p.y}`;
}

export function inBounds(b: Board, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}

export function isWall(b: Board, p: Pos): boolean {
  return b.walls.some((w) => w.x === p.x && w.y === p.y);
}

export function occupant(s: GameState, p: Pos): Unit | undefined {
  return Object.values(s.units).find((u) => u.pos.x === p.x && u.pos.y === p.y);
}

export function isBlocked(s: GameState, p: Pos): boolean {
  return isWall(s.board, p) || occupant(s, p) !== undefined;
}

export function legalMoves(s: GameState, unitId: string): Pos[] {
  const unit = s.units[unitId];
  if (!unit) throw new Error("unknown unit");
  if (unit.team !== "player") throw new Error("only player units can use legalMoves");

  const range = Math.max(0, unit.moveRange + (s.modifiers?.moveRangeDelta ?? 0));
  const dist = new Map<string, number>([[keyOf(unit.pos), 0]]);
  const queue: Pos[] = [{ ...unit.pos }];
  const out: Pos[] = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    const d = dist.get(keyOf(cur));
    if (d === undefined || d >= range) continue;

    for (const step of ORTHO) {
      const next = { x: cur.x + step.x, y: cur.y + step.y };
      if (!inBounds(s.board, next) || dist.has(keyOf(next)) || isBlocked(s, next)) continue;
      dist.set(keyOf(next), d + 1);
      queue.push(next);
      out.push(next);
    }
  }

  return out;
}

export function lineOfSight(s: GameState, from: Pos, to: Pos): boolean {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === x1 && y0 === y1) break;
    if (isWall(s.board, { x: x0, y: y0 })) return false;
  }

  return true;
}

export function traceLine(s: GameState, from: Pos, dir: Dir, range: number): { tiles: Pos[]; hitUnitIds: string[] } {
  if (Math.abs(dir.x) + Math.abs(dir.y) !== 1) throw new Error("line cards require an orthogonal direction");

  const tiles: Pos[] = [];
  const hitUnitIds: string[] = [];
  for (let i = 1; i <= range; i += 1) {
    const p = { x: from.x + dir.x * i, y: from.y + dir.y * i };
    if (!inBounds(s.board, p) || isWall(s.board, p)) break;
    tiles.push(p);
    const hit = occupant(s, p);
    if (hit) hitUnitIds.push(hit.id);
  }

  return { tiles, hitUnitIds };
}
