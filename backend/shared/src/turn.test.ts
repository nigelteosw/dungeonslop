import { expect, test } from "bun:test";
import { HAND_SIZE, createRoom, endTurn, isRoomClear, startTurn } from "./index";
import type { GameState } from "./index";

const rng = () => 0.42;
const noMonsters = (s: GameState) => s;

test("startTurn refills energy, resets move/block, draws to hand size", () => {
  const s0 = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const p0 = s0.units.p0;
  if (!p0) throw new Error("missing player");
  const s = {
    ...s0,
    units: {
      ...s0.units,
      p0: { ...p0, energy: 0, hasMoved: true, block: 3, hand: [], discard: [...p0.hand] },
    },
  };
  const n = startTurn(s, rng);
  expect(n.units.p0?.energy).toBe(n.units.p0?.maxEnergy);
  expect(n.units.p0?.hasMoved).toBe(false);
  expect(n.units.p0?.block).toBe(0);
  expect(n.units.p0?.hand).toHaveLength(HAND_SIZE);
});

test("endTurn on a solo player runs a new round", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const n = endTurn(s, noMonsters, rng);
  expect(n.phase).toBe("player");
  expect(n.activeIndex).toBe(0);
});

test("room clears when no monsters remain", () => {
  const s0 = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const p0 = s0.units.p0;
  if (!p0) throw new Error("missing player");
  const s = { ...s0, units: { p0 } };
  const n = endTurn(s, noMonsters, rng);
  expect(isRoomClear(n)).toBe(true);
  expect(n.phase).toBe("roomClear");
});
