import type { GameState, Unit } from "./types";
import { HAND_SIZE } from "./types";
import { shuffle, type Rng } from "./rng";

const clone = (s: GameState): GameState => structuredClone(s);

function drawTo(u: Unit, count: number, rng: Rng): void {
  while (u.hand.length < count) {
    if (u.deck.length === 0) {
      if (u.discard.length === 0) break;
      u.deck = shuffle(u.discard, rng);
      u.discard = [];
    }
    const card = u.deck.shift();
    if (!card) break;
    u.hand.push(card);
  }
}

export function isRoomClear(s: GameState): boolean {
  return !Object.values(s.units).some((u) => u.team === "monster");
}

export function isDefeat(s: GameState): boolean {
  return !Object.values(s.units).some((u) => u.team === "player");
}

function settle(s: GameState): GameState {
  if (isDefeat(s)) return { ...s, phase: "defeat" };
  if (isRoomClear(s)) return { ...s, phase: "roomClear" };
  return s;
}

export function startTurn(s: GameState, rng: Rng): GameState {
  const n = clone(s);
  const activeId = n.order[n.activeIndex];
  if (!activeId) return n;
  const u = n.units[activeId];
  if (!u) return n;

  u.energy = u.maxEnergy;
  u.hasMoved = false;
  u.block = 0;
  drawTo(u, HAND_SIZE, rng);
  return n;
}

export function endTurn(s: GameState, runMonsterPhase: (s: GameState) => GameState, rng: Rng): GameState {
  let n = clone(s);
  if (n.phase !== "player") throw new Error("not player phase");

  const activeId = n.order[n.activeIndex];
  const active = activeId ? n.units[activeId] : undefined;
  if (active) {
    active.discard.push(...active.hand);
    active.hand = [];
  }

  n.activeIndex += 1;
  if (n.activeIndex >= n.order.length) {
    n.phase = "monster";
    n = runMonsterPhase(n);
    n.activeIndex = 0;
    const settled = settle(n);
    if (settled.phase === "defeat" || settled.phase === "roomClear") return settled;
    n = { ...n, phase: "player" };
  }

  const afterClear = settle(n);
  if (afterClear.phase === "defeat" || afterClear.phase === "roomClear") return afterClear;
  return startTurn(n, rng);
}
