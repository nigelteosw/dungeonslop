import { createRoom } from './rooms';
import { endTurn, isRoomClear, startTurn } from './turn';
import { HAND_SIZE, GameState } from './types';

const rng = () => 0.42;
const noMonsters = (s: GameState) => s;

test('startTurn refills energy, resets move/block, draws to hand size', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  s = {
    ...s,
    units: {
      ...s.units,
      p0: { ...s.units.p0!, energy: 0, hasMoved: true, block: 3, hand: [], deck: ['slash', 'slash', 'slash', 'slash', 'slash'] },
    },
  };
  const n = startTurn(s, rng);
  expect(n.units.p0!.energy).toBe(n.units.p0!.maxEnergy);
  expect(n.units.p0!.hasMoved).toBe(false);
  expect(n.units.p0!.block).toBe(0);
  expect(n.units.p0!.hand).toHaveLength(HAND_SIZE);
});

test("ending the only player's turn runs a new round (player phase again)", () => {
  const s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  const n = endTurn(s, noMonsters, rng);
  expect(n.phase).toBe('player');
  expect(n.activeIndex).toBe(0);
});

test('room is clear when no monsters remain', () => {
  let s = createRoom(0, [{ name: 'A', classId: 'knight' }], rng);
  s = { ...s, units: { p0: s.units.p0! } };
  const n = endTurn(s, noMonsters, rng);
  expect(isRoomClear(n)).toBe(true);
  expect(n.phase).toBe('roomClear');
});
