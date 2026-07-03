import { expect, test } from "bun:test";
import { createRoom, inBounds, legalMoves, lineOfSight, traceLine } from "./index";

const rng = () => 0.42;

test("inBounds respects 16x16", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  expect(inBounds(s.board, { x: 15, y: 15 })).toBe(true);
  expect(inBounds(s.board, { x: 16, y: 0 })).toBe(false);
});

test("legalMoves for range-4 knight excludes start, includes 4 east, excludes 5 east", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const moves = legalMoves(s, "p0");
  expect(moves).not.toContainEqual({ x: 1, y: 1 });
  expect(moves).toContainEqual({ x: 5, y: 1 });
  expect(moves).not.toContainEqual({ x: 6, y: 1 });
});

test("lineOfSight blocked by a wall between two points", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  expect(lineOfSight(s, { x: 5, y: 6 }, { x: 8, y: 6 })).toBe(false);
  expect(lineOfSight(s, { x: 1, y: 1 }, { x: 1, y: 4 })).toBe(true);
});

test("traceLine stops at a wall and collects tiles", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const result = traceLine(s, { x: 3, y: 6 }, { x: 1, y: 0 }, 9);
  expect(result.tiles).toContainEqual({ x: 5, y: 6 });
  expect(result.tiles).not.toContainEqual({ x: 6, y: 6 });
});
