import { createRoom } from './rooms';
import { applyMove, cardTargets, playCard } from './cards';
import { keyOf } from './board';
import { GameState } from './types';

const rng = () => 0.42;

function withMonsterAt(s: GameState, id: string, pos: { x: number; y: number }, hp: number): GameState {
  return { ...s, units: { ...s.units, [id]: { ...s.units[id]!, pos, hp } } };
}

test('applyMove moves once and sets hasMoved; second move throws', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // p0 at (1,1)
  const n = applyMove(s, 'p0', { x: 3, y: 1 });
  expect(n.units.p0!.pos).toEqual({ x: 3, y: 1 });
  expect(n.units.p0!.hasMoved).toBe(true);
  expect(() => applyMove(n, 'p0', { x: 4, y: 1 })).toThrow();
});

test('melee card targets an adjacent enemy and deals attack+power', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // knight attack 3
  s = withMonsterAt(s, 'm0', { x: 2, y: 1 }, 10); // adjacent to p0 at (1,1)
  s = { ...s, units: { ...s.units, p0: { ...s.units.p0!, hand: ['slash'] } } };
  expect(cardTargets(s, 'p0', 'slash').map(keyOf)).toContain(keyOf({ x: 2, y: 1 }));
  const n = playCard(s, 'p0', 'slash', { x: 2, y: 1 }); // 3+2 = 5
  expect(n.units.m0!.hp).toBe(5);
  expect(n.units.p0!.energy).toBe(s.units.p0!.energy - 1);
  expect(n.units.p0!.hand).not.toContain('slash');
  expect(n.units.p0!.discard).toContain('slash');
});

test('line card (vulcan) pierces enemies until a wall', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'wizard' }], rng);
  s = { ...s, units: { ...s.units, p0: { ...s.units.p0!, pos: { x: 3, y: 6 }, hand: ['vulcan'] } } };
  s = withMonsterAt(s, 'm0', { x: 4, y: 6 }, 10);
  s = withMonsterAt(s, 'm1', { x: 5, y: 6 }, 10); // wall at (6,6) stops the line
  const n = playCard(s, 'p0', 'vulcan', { x: 5, y: 6 }); // dir east; 2+2 = 4 to each
  expect(n.units.m0!.hp).toBe(6);
  expect(n.units.m1!.hp).toBe(6);
});

test('block card shields the caster', () => {
  const s0 = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  const s = { ...s0, units: { ...s0.units, p0: { ...s0.units.p0!, hand: ['block'] } } };
  const n = playCard(s, 'p0', 'block', s.units.p0!.pos);
  expect(n.units.p0!.block).toBe(5);
});
