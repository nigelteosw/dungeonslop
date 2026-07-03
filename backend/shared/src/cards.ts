import type { Dir, GameState, Pos, Unit } from "./types";
import { ORTHO } from "./types";
import { CARDS } from "./content/cards";
import { inBounds, keyOf, legalMoves, lineOfSight, occupant, traceLine } from "./board";

export const clone = (s: GameState): GameState => structuredClone(s);

export function requireActivePlayer(s: GameState, id: string): void {
  if (s.phase !== "player") throw new Error("not player phase");
  if (s.order[s.activeIndex] !== id) throw new Error("not this unit's turn");
  const unit = s.units[id];
  if (!unit || unit.team !== "player") throw new Error("not a player unit");
}

export function applyMove(s: GameState, unitId: string, to: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId];
  if (!u) throw new Error("unknown unit");
  if (u.hasMoved) throw new Error("already moved this turn");
  if (!legalMoves(s, unitId).some((p) => keyOf(p) === keyOf(to))) throw new Error("illegal move");

  const n = clone(s);
  const moved = n.units[unitId];
  if (!moved) throw new Error("unknown unit");
  moved.pos = { ...to };
  moved.hasMoved = true;
  return n;
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function effectiveRange(s: GameState, base: number): number {
  return Math.max(1, base + (s.modifiers?.losRangeDelta ?? 0));
}

function enemiesOf(s: GameState, unit: Unit): Unit[] {
  return Object.values(s.units).filter((o) => o.team !== unit.team);
}

function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id];
  if (!u) return;
  const absorbed = Math.min(u.block, amount);
  u.block -= absorbed;
  u.hp -= amount - absorbed;
  if (u.hp <= 0) delete s.units[id];
}

function isOrthoTarget(from: Pos, target: Pos): boolean {
  return (from.x === target.x && from.y !== target.y) || (from.y === target.y && from.x !== target.x);
}

function dirTo(from: Pos, target: Pos): Dir {
  if (!isOrthoTarget(from, target)) throw new Error("line target must be orthogonal");
  return {
    x: Math.sign(target.x - from.x) as -1 | 0 | 1,
    y: Math.sign(target.y - from.y) as -1 | 0 | 1,
  };
}

export function cardTargets(s: GameState, unitId: string, cardId: string): Pos[] {
  const u = s.units[unitId];
  const card = CARDS[cardId];
  if (!u) throw new Error("unknown unit");
  if (!card) throw new Error("unknown card");
  if (u.team !== "player") return [];

  if (card.shape === "self") return [{ ...u.pos }];

  if (card.effect === "heal") {
    const range = effectiveRange(s, card.range ?? 1);
    return Object.values(s.units)
      .filter((o) => o.team === u.team)
      .filter((o) => manhattan(o.pos, u.pos) <= range)
      .filter((o) => lineOfSight(s, u.pos, o.pos))
      .map((o) => ({ ...o.pos }));
  }

  if (card.shape === "melee") {
    return enemiesOf(s, u)
      .filter((o) => manhattan(o.pos, u.pos) === 1)
      .map((o) => ({ ...o.pos }));
  }

  if (card.shape === "ranged") {
    const range = effectiveRange(s, card.range ?? 1);
    return enemiesOf(s, u)
      .filter((o) => manhattan(o.pos, u.pos) <= range)
      .filter((o) => lineOfSight(s, u.pos, o.pos))
      .map((o) => ({ ...o.pos }));
  }

  const tiles: Pos[] = [];
  const range = effectiveRange(s, card.range ?? 1);
  for (const dir of ORTHO) tiles.push(...traceLine(s, u.pos, dir, range).tiles);
  return tiles;
}

export function playCard(s: GameState, unitId: string, cardId: string, target: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId];
  const card = CARDS[cardId];
  if (!u) throw new Error("unknown unit");
  if (!card) throw new Error("unknown card");
  if (!u.hand.includes(cardId)) throw new Error("card not in hand");
  if (u.energy < card.cost) throw new Error("not enough energy");
  if (!inBounds(s.board, target)) throw new Error("target out of bounds");
  if (!cardTargets(s, unitId, cardId).some((p) => keyOf(p) === keyOf(target))) throw new Error("illegal target");

  const n = clone(s);
  const nu = n.units[unitId];
  if (!nu) throw new Error("unknown unit");
  nu.energy -= card.cost;
  const handIndex = nu.hand.indexOf(cardId);
  if (handIndex < 0) throw new Error("card not in hand");
  nu.hand.splice(handIndex, 1);
  nu.discard.push(cardId);

  if (card.effect === "block") {
    nu.block += card.power;
    return n;
  }

  if (card.effect === "heal") {
    const ally = occupant(n, target);
    if (!ally || ally.team !== nu.team) throw new Error("heal target missing");
    ally.hp = Math.min(ally.maxHp, ally.hp + card.power);
    return n;
  }

  const damage = nu.attack + card.power;
  if (card.shape === "line") {
    const dir = dirTo(nu.pos, target);
    const { hitUnitIds } = traceLine(n, nu.pos, dir, effectiveRange(n, card.range ?? 1));
    for (const id of hitUnitIds) {
      const hit = n.units[id];
      if (hit && hit.team !== nu.team) damageUnit(n, id, damage);
    }
    return n;
  }

  const enemy = occupant(n, target);
  if (!enemy || enemy.team === nu.team) throw new Error("damage target missing");
  damageUnit(n, enemy.id, damage);
  return n;
}
