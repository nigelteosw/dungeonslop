import { createRoom } from './rooms';
import { runMonsterPhase } from './ai';

const rng = () => 0.42;

test('adjacent monster attacks a player (respecting block)', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // knight 14hp at (1,1)
  s = { ...s, units: { ...s.units, m0: { ...s.units.m0!, pos: { x: 2, y: 1 }, attack: 3 } } };
  const n = runMonsterPhase(s);
  expect(n.units.p0!.hp).toBe(11);
});

test('distant monster steps toward nearest player', () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng); // m0 at (13,2)
  const n = runMonsterPhase(s);
  expect(n.units.m0!.pos.x).toBeLessThan(13);
});
