import { GameState, Pos, ORTHO } from './types';
import { inBounds, isBlocked } from './board';

const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function nearestPlayer(s: GameState, from: Pos): Pos | undefined {
  const ps = Object.values(s.units).filter((u) => u.team === 'player');
  if (!ps.length) return undefined;
  ps.sort((a, b) => manhattan(from, a.pos) - manhattan(from, b.pos));
  return ps[0]!.pos;
}

function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id];
  if (!u) return;
  const absorbed = Math.min(u.block, amount);
  u.block -= absorbed;
  u.hp -= (amount - absorbed);
  if (u.hp <= 0) delete s.units[id];
}

export function runMonsterPhase(state: GameState): GameState {
  const s: GameState = structuredClone(state);
  const ids = Object.values(s.units).filter((u) => u.team === 'monster').map((u) => u.id);
  for (const id of ids) {
    const m = s.units[id];
    if (!m) continue;
    const adjPlayer = Object.values(s.units).find((o) => o.team === 'player' && manhattan(o.pos, m.pos) === 1);
    if (adjPlayer) { damageUnit(s, adjPlayer.id, m.attack); continue; }
    const goal = nearestPlayer(s, m.pos);
    if (!goal) continue;
    let best: Pos | undefined;
    let bestDist = manhattan(m.pos, goal);
    for (const st of ORTHO) {
      const nx = { x: m.pos.x + st.x, y: m.pos.y + st.y };
      if (!inBounds(s.board, nx) || isBlocked(s, nx)) continue;
      const d = manhattan(nx, goal);
      if (d < bestDist) { bestDist = d; best = nx; }
    }
    if (best) m.pos = best;
  }
  return s;
}
