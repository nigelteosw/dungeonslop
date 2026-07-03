import { createRoom } from './rooms';
import { HAND_SIZE } from './types';

const rng = () => 0.42;

test('createRoom: players full hp/energy, opening hand drawn, monsters present', () => {
  const s = createRoom(0, [{ name: 'Ann', classId: 'knight' }], rng);
  const p = s.units.p0!;
  expect(p.hp).toBe(p.maxHp);
  expect(p.energy).toBe(p.maxEnergy);
  expect(p.hand).toHaveLength(HAND_SIZE);
  expect(p.hasMoved).toBe(false);
  expect(Object.values(s.units).some((u) => u.team === 'monster')).toBe(true);
  expect(s.board.width).toBe(16);
  expect(s.phase).toBe('player');
});
