import { Board, GameState, Pos, Unit, Dir, ORTHO } from './types';

export function keyOf(p: Pos): string { return `${p.x},${p.y}`; }

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
  const unit = s.units[unitId]!;
  if (unit.hasMoved) return [];
  const start = unit.pos;
  const dist = new Map<string, number>([[keyOf(start), 0]]);
  const queue: Pos[] = [start];
  const out: Pos[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(keyOf(cur))!;
    if (d >= unit.moveRange) continue;
    for (const st of ORTHO) {
      const nx = { x: cur.x + st.x, y: cur.y + st.y };
      if (!inBounds(s.board, nx) || dist.has(keyOf(nx)) || isBlocked(s, nx)) continue;
      dist.set(keyOf(nx), d + 1);
      queue.push(nx);
      out.push(nx);
    }
  }
  return out;
}

// Bresenham: walls strictly between `from` and `to` block line of sight (endpoints excluded).
export function lineOfSight(s: GameState, from: Pos, to: Pos): boolean {
  let x0 = from.x, y0 = from.y;
  const x1 = to.x, y1 = to.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) break;
    if (isWall(s.board, { x: x0, y: y0 })) return false;
  }
  return true;
}

export function traceLine(s: GameState, from: Pos, dir: Dir, range: number): { tiles: Pos[]; hitUnitIds: string[] } {
  const tiles: Pos[] = [];
  const hitUnitIds: string[] = [];
  for (let i = 1; i <= range; i++) {
    const p = { x: from.x + dir.x * i, y: from.y + dir.y * i };
    if (!inBounds(s.board, p) || isWall(s.board, p)) break;
    tiles.push(p);
    const u = occupant(s, p);
    if (u) hitUnitIds.push(u.id);
  }
  return { tiles, hitUnitIds };
}
