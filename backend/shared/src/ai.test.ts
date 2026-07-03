import { expect, test } from "bun:test";
import { createRoom, runMonsterPhase } from "./index";

const rng = () => 0.42;

test("adjacent monster attacks a player respecting block", () => {
  const s0 = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const m0 = s0.units.m0;
  if (!m0) throw new Error("missing monster");
  const s = { ...s0, units: { ...s0.units, m0: { ...m0, pos: { x: 2, y: 1 }, attack: 3 } } };
  const n = runMonsterPhase(s);
  expect(n.units.p0?.hp).toBe(11);
});

test("distant monster steps toward nearest player", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const n = runMonsterPhase(s);
  expect(n.units.m0?.pos.x).toBeLessThan(13);
});
