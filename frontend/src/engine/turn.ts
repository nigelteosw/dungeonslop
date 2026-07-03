import { GameState, Unit, HAND_SIZE } from './types';
import { shuffle } from './rng';

const clone = (s: GameState): GameState => structuredClone(s);

function drawTo(u: Unit, n: number, rng: () => number): void {
  while (u.hand.length < n) {
    if (u.deck.length === 0) {
      if (u.discard.length === 0) break;
      u.deck = shuffle(u.discard, rng);
      u.discard = [];
    }
    u.hand.push(u.deck.shift()!);
  }
}

export function isRoomClear(s: GameState): boolean {
  return !Object.values(s.units).some((u) => u.team === 'monster');
}
export function isDefeat(s: GameState): boolean {
  return !Object.values(s.units).some((u) => u.team === 'player');
}

function settle(s: GameState): GameState {
  if (isDefeat(s)) return { ...s, phase: 'defeat' };
  if (isRoomClear(s)) return { ...s, phase: 'roomClear' };
  return s;
}

export function startTurn(s: GameState, rng: () => number): GameState {
  const n = clone(s);
  const u = n.units[n.order[n.activeIndex]!];
  if (!u) return n;
  u.energy = u.maxEnergy;
  u.hasMoved = false;
  u.block = 0;
  drawTo(u, HAND_SIZE, rng);
  return n;
}

export function endTurn(
  s: GameState,
  runMonsterPhase: (s: GameState) => GameState,
  rng: () => number,
): GameState {
  let n = clone(s);
  const cur = n.units[n.order[n.activeIndex]!];
  if (cur) { cur.discard.push(...cur.hand); cur.hand = []; }
  n.activeIndex += 1;

  if (n.activeIndex >= n.order.length) {
    n.phase = 'monster';
    n = runMonsterPhase(n);
    n.activeIndex = 0;
    const settledAfterMonsters = settle(n);
    if (settledAfterMonsters.phase !== n.phase) return settledAfterMonsters;
    n.phase = 'player';
  }

  const settled = settle(n);
  if (settled.phase !== 'player') return settled;
  return startTurn(n, rng);
}
