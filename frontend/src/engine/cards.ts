import { GameState, Pos, Unit, ORTHO } from './types';
import { legalMoves, keyOf, occupant, lineOfSight, traceLine } from './board';
import { CARDS } from './content/cards';

export const clone = (s: GameState): GameState => structuredClone(s);

export function requireActivePlayer(s: GameState, id: string): void {
  if (s.phase !== 'player') throw new Error('not player phase');
  if (s.order[s.activeIndex] !== id) throw new Error("not this unit's turn");
}

export function applyMove(s: GameState, unitId: string, to: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!;
  if (u.hasMoved) throw new Error('already moved this turn');
  if (!legalMoves(s, unitId).some((p) => keyOf(p) === keyOf(to))) throw new Error('illegal move');
  const n = clone(s);
  n.units[unitId]!.pos = { ...to };
  n.units[unitId]!.hasMoved = true;
  return n;
}

function damageUnit(s: GameState, id: string, amount: number): void {
  const u = s.units[id];
  if (!u) return;
  const absorbed = Math.min(u.block, amount);
  u.block -= absorbed;
  u.hp -= (amount - absorbed);
  if (u.hp <= 0) delete s.units[id];
}

function enemiesOf(s: GameState, unit: Unit): Unit[] {
  return Object.values(s.units).filter((o) => o.team !== unit.team);
}

export function cardTargets(s: GameState, unitId: string, cardId: string): Pos[] {
  const u = s.units[unitId]!;
  const c = CARDS[cardId]!;
  if (c.shape === 'self') return [u.pos];

  if (c.effect === 'heal') {
    const range = c.range ?? 1;
    return Object.values(s.units)
      .filter((o) => o.team === u.team)
      .filter((o) => Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) <= range)
      .filter((o) => lineOfSight(s, u.pos, o.pos))
      .map((o) => ({ ...o.pos }));
  }
  if (c.shape === 'melee') {
    return enemiesOf(s, u)
      .filter((o) => Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) === 1)
      .map((o) => ({ ...o.pos }));
  }
  if (c.shape === 'ranged') {
    const range = c.range ?? 1;
    return enemiesOf(s, u)
      .filter((o) => Math.abs(o.pos.x - u.pos.x) + Math.abs(o.pos.y - u.pos.y) <= range)
      .filter((o) => lineOfSight(s, u.pos, o.pos))
      .map((o) => ({ ...o.pos }));
  }
  // line: every reachable tile along the 4 orthogonal rays (up to range, stopping at walls)
  const tiles: Pos[] = [];
  for (const dir of ORTHO) tiles.push(...traceLine(s, u.pos, dir, c.range ?? 1).tiles);
  return tiles;
}

export function playCard(s: GameState, unitId: string, cardId: string, target: Pos): GameState {
  requireActivePlayer(s, unitId);
  const u = s.units[unitId]!;
  const c = CARDS[cardId]!;
  if (!u.hand.includes(cardId)) throw new Error('card not in hand');
  if (u.energy < c.cost) throw new Error('not enough energy');
  if (!cardTargets(s, unitId, cardId).some((p) => keyOf(p) === keyOf(target))) throw new Error('illegal target');

  const n = clone(s);
  const nu = n.units[unitId]!;
  nu.energy -= c.cost;
  nu.hand.splice(nu.hand.indexOf(cardId), 1);
  nu.discard.push(cardId);
  const dmg = nu.attack + c.power;

  if (c.effect === 'block') {
    nu.block += c.power;
  } else if (c.effect === 'heal') {
    const ally = occupant(n, target);
    if (ally) ally.hp = Math.min(ally.maxHp, ally.hp + c.power);
  } else if (c.shape === 'line') {
    const dir = { x: Math.sign(target.x - nu.pos.x) as -1 | 0 | 1, y: Math.sign(target.y - nu.pos.y) as -1 | 0 | 1 };
    const { hitUnitIds } = traceLine(n, nu.pos, dir, c.range ?? 1);
    for (const id of hitUnitIds) if (n.units[id] && n.units[id]!.team !== nu.team) damageUnit(n, id, dmg);
  } else {
    const enemy = occupant(n, target);
    if (enemy && enemy.team !== nu.team) damageUnit(n, enemy.id, dmg);
  }
  return n;
}
