import type { GameState, Pos } from "./types";
import { ORTHO } from "./types";
import { inBounds, isBlocked } from "./board";

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id];
  if (!u) return;
  const absorbed = Math.min(u.block, amount);
  u.block -= absorbed;
  u.hp -= amount - absorbed;
  if (u.hp <= 0) delete s.units[id];
}

function nearestPlayerPosition(s: GameState, from: Pos): Pos | undefined {
  const players = Object.values(s.units).filter((u) => u.team === "player");
  players.sort((a, b) => manhattan(from, a.pos) - manhattan(from, b.pos));
  return players[0]?.pos;
}

export function runMonsterPhase(state: GameState): GameState {
  const s: GameState = structuredClone(state);
  const monsterIds = Object.values(s.units)
    .filter((u) => u.team === "monster")
    .map((u) => u.id);

  for (const id of monsterIds) {
    const monster = s.units[id];
    if (!monster) continue;

    const adjacent = Object.values(s.units).find((u) => u.team === "player" && manhattan(u.pos, monster.pos) === 1);
    if (adjacent) {
      damageUnit(s, adjacent.id, monster.attack);
      continue;
    }

    const goal = nearestPlayerPosition(s, monster.pos);
    if (!goal) continue;

    let best: Pos | undefined;
    let bestDist = manhattan(monster.pos, goal);
    for (let stepCount = 0; stepCount < monster.moveRange; stepCount += 1) {
      for (const step of ORTHO) {
        const next = { x: monster.pos.x + step.x, y: monster.pos.y + step.y };
        if (!inBounds(s.board, next) || isBlocked(s, next)) continue;
        const dist = manhattan(next, goal);
        if (dist < bestDist) {
          bestDist = dist;
          best = next;
        }
      }
      if (!best) break;
      monster.pos = best;
      if (bestDist <= 1) break;
      best = undefined;
    }
  }

  return s;
}
