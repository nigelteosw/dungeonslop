import { expect, test } from "bun:test";
import type { GameState, Pos } from "./index";
import { cardTargets, createRoom, keyOf, playCard } from "./index";

const rng = () => 0.42;

function withMonsterAt(s: GameState, id: string, pos: Pos, hp: number): GameState {
  const unit = s.units[id];
  if (!unit) throw new Error("missing monster");
  return { ...s, units: { ...s.units, [id]: { ...unit, pos, hp, maxHp: Math.max(unit.maxHp, hp) } } };
}

test("melee card targets an adjacent enemy and deals attack+power", () => {
  let s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const p0 = s.units.p0;
  if (!p0) throw new Error("missing player");
  s = withMonsterAt(s, "m0", { x: 2, y: 1 }, 10);
  s = { ...s, units: { ...s.units, p0: { ...p0, hand: ["slash"] } } };

  expect(cardTargets(s, "p0", "slash").map(keyOf)).toContain(keyOf({ x: 2, y: 1 }));
  const n = playCard(s, "p0", "slash", { x: 2, y: 1 });
  expect(n.units.m0?.hp).toBe(5);
  expect(n.units.p0?.energy).toBe((s.units.p0?.energy ?? 0) - 1);
  expect(n.units.p0?.hand).not.toContain("slash");
  expect(n.units.p0?.discard).toContain("slash");
});

test("line card pierces enemies until a wall", () => {
  let s = createRoom(0, [{ name: "A", classId: "wizard" }], rng);
  const p0 = s.units.p0;
  if (!p0) throw new Error("missing player");
  s = { ...s, units: { ...s.units, p0: { ...p0, pos: { x: 3, y: 6 }, hand: ["vulcan"] } } };
  s = withMonsterAt(s, "m0", { x: 4, y: 6 }, 10);
  s = withMonsterAt(s, "m1", { x: 5, y: 6 }, 10);

  const n = playCard(s, "p0", "vulcan", { x: 5, y: 6 });
  expect(n.units.m0?.hp).toBe(6);
  expect(n.units.m1?.hp).toBe(6);
});

test("block card shields the caster", () => {
  const s0 = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const p0 = s0.units.p0;
  if (!p0) throw new Error("missing player");
  const s = { ...s0, units: { ...s0.units, p0: { ...p0, hand: ["block"] } } };
  const n = playCard(s, "p0", "block", p0.pos);
  expect(n.units.p0?.block).toBe(5);
});
