import { expect, test } from "bun:test";
import { CLASSES, EQUIPMENT, MONSTERS, SLOP_CARDS, UPGRADES, applyUpgrade, createRoom, drawSlopCard, equip, validateContent } from "./index";

const rng = () => 0.42;

test("content validates and has v0 counts", () => {
  expect(() => validateContent()).not.toThrow();
  expect(Object.keys(CLASSES)).toHaveLength(2);
  expect(Object.keys(MONSTERS)).toHaveLength(5);
  expect(Object.keys(UPGRADES)).toHaveLength(20);
  expect(Object.keys(EQUIPMENT)).toHaveLength(15);
  expect(Object.keys(SLOP_CARDS)).toHaveLength(15);
});

test("applyUpgrade applies stats and addCard effects", () => {
  const s = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const stronger = applyUpgrade(s, "p0", "bigger_sword");
  expect(stronger.units.p0?.attack).toBe((s.units.p0?.attack ?? 0) + 1);
  const carded = applyUpgrade(stronger, "p0", "learn_vulcan");
  expect(carded.units.p0?.discard).toContain("vulcan");
});

test("equip applies the item slot effect", () => {
  const s0 = createRoom(0, [{ name: "A", classId: "knight" }], rng);
  const p0 = s0.units.p0;
  if (!p0) throw new Error("missing player");
  const s = { ...s0, units: { ...s0.units, p0: { ...p0, inventory: ["rusty_sword"] } } };
  const n = equip(s, "p0", "rusty_sword");
  expect(n.units.p0?.equipment?.weapon).toBe("rusty_sword");
  expect(n.units.p0?.attack).toBe(p0.attack + 1);
});

test("drawSlopCard returns a configured slop id", () => {
  expect(SLOP_CARDS[drawSlopCard(rng)]).toBeDefined();
});
