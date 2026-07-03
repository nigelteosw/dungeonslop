import { expect, test } from "bun:test";
import { applyMove, createRoom } from "./index";

const rng = () => 0.42;

test("applyMove moves once and sets hasMoved; second move throws", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const n = applyMove(s, "p0", { x: 3, y: 1 });
  expect(n.units.p0?.pos).toEqual({ x: 3, y: 1 });
  expect(n.units.p0?.hasMoved).toBe(true);
  expect(() => applyMove(n, "p0", { x: 4, y: 1 })).toThrow();
});
