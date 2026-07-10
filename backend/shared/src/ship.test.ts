import { expect, test } from "bun:test";
import { applyShipCommand, createCrew, createRun, createShip, SHIP_LAYOUTS, shortestRoomPath, stepShipSimulation } from "./ship";
import { castVote } from "./run";

function encounter(role: "pilot" | "engineer" | "gunner" | "medic", roomId = "bridge") {
  return castVote(createRun("seed", [createCrew("c0", "s0", "Ada", role, roomId)]), "s0", "scrap-raider");
}

test("ship layout has a path between bridge and weapons", () => {
  expect(shortestRoomPath(createShip(), "bridge", "weapons")).toEqual(["bridge", "weapons"]);
});

test("every authoritative layout uses square rooms", () => {
  for (const layout of Object.values(SHIP_LAYOUTS)) {
    expect(Object.values(layout.rooms).every((room) => room.w === room.h)).toBe(true);
  }
});

test("closed and locked doors are excluded from movement", () => {
  const closed = encounter("pilot");
  closed.ship.doors["bridge--weapons"]!.open = false;
  expect(() => applyShipCommand(closed, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");

  const locked = encounter("pilot");
  locked.ship.doors["bridge--weapons"]!.locked = true;
  expect(() => applyShipCommand(locked, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");
});

test("crew moves one room and operates a colocated station", () => {
  const run = encounter("pilot");
  const moved = applyShipCommand(run, { kind: "move", crewId: "c0", roomId: "weapons" });
  const operated = applyShipCommand(moved, { kind: "operate", crewId: "c0", systemId: "weapons" });
  expect(operated.crew.c0?.roomId).toBe("weapons");
  expect(operated.ship.systems.weapons.operatorCrewId).toBe("c0");
  expect(run.crew.c0?.roomId).toBe("bridge");
});

test("crew cannot move through a non-adjacent room", () => {
  const run = encounter("pilot");
  expect(() => applyShipCommand(run, { kind: "move", crewId: "c0", roomId: "engineering" })).toThrow("not directly reachable");
});

test("WASD movement updates deck position and crosses only a connected module boundary", () => {
  let run = encounter("pilot");
  expect(run.crew.c0).toMatchObject({ roomId: "bridge", deckX: 8, deckY: 3 });
  run = applyShipCommand(run, { kind: "moveVector", crewId: "c0", dx: -1, dy: 0 });
  expect(run.crew.c0).toMatchObject({ roomId: "weapons", deckX: 7, deckY: 3 });
  const bridgeRun = encounter("pilot");
  bridgeRun.crew.c0!.deckX = 9;
  expect(() => applyShipCommand(bridgeRun, { kind: "moveVector", crewId: "c0", dx: 1, dy: 0 })).toThrow("leaves the ship");
});

test("breach drains oxygen and low oxygen incapacitates crew deterministically", () => {
  let run = encounter("engineer", "engineering");
  run.ship.rooms.engineering!.breached = true;
  run.ship.rooms.engineering!.oxygen = 8;
  run.crew.c0!.health = 4;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.engineering?.oxygen).toBe(5);
  expect(run.crew.c0?.incapacitated).toBe(true);
  expect(run.crew.c0?.bleedoutTicks).toBe(40);
});

test("same state and rng produce the same tick", () => {
  const run = encounter("medic");
  run.ship.rooms.bridge!.fire = 1;
  expect(stepShipSimulation(run, () => 0.9)).toEqual(stepShipSimulation(run, () => 0.9));
});

test("enemy volley damages shields before hull", () => {
  let run = encounter("pilot");
  run.enemy!.weaponChargeTicks = run.enemy!.weaponChargeMaxTicks - 1;
  run = stepShipSimulation(run, () => 0);
  expect(run.ship.shields).toBe(1);
  expect(run.ship.hull).toBe(run.ship.maxHull);
});

test("manned weapons disable the enemy and win the encounter", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run.enemy!.shields = 0;
  run.enemy!.hull = 2;
  run.tick = 7;
  run = stepShipSimulation(run, () => 1);
  expect(run.enemy?.hull).toBe(0);
  expect(run.status).toBe("victory");
});

test("boarders sabotage systems and can be fought by colocated crew", () => {
  let run = encounter("gunner", "oxygen");
  run.boarders.b0 = { id: "b0", roomId: "oxygen", health: 40, targetRoomId: "engineering" };
  run = applyShipCommand(run, { kind: "attackBoarder", crewId: "c0", boarderId: "b0" });
  expect(run.boarders.b0).toBeUndefined();

  run.boarders.b1 = { id: "b1", roomId: "weapons", health: 75, targetRoomId: "engineering" };
  run.tick = 3;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.systems.weapons.health).toBe(3);
});

test("each role ability creates a distinct authoritative effect", () => {
  let pilot = encounter("pilot");
  pilot.enemy!.weaponChargeTicks = 8;
  pilot = applyShipCommand(pilot, { kind: "useAbility", crewId: "c0" });
  expect(pilot.enemy?.weaponChargeTicks).toBe(2);

  let engineer = encounter("engineer", "engineering");
  engineer.ship.systems.reactor.health = 1;
  engineer.ship.rooms.engineering!.fire = 2;
  engineer = applyShipCommand(engineer, { kind: "useAbility", crewId: "c0" });
  expect(engineer.ship.systems.reactor.health).toBe(3);
  expect(engineer.ship.rooms.engineering?.fire).toBe(1);

  let gunner = encounter("gunner");
  gunner.enemy!.shields = 0;
  gunner = applyShipCommand(gunner, { kind: "useAbility", crewId: "c0" });
  expect(gunner.enemy?.hull).toBe(15);

  let medic = castVote(createRun("seed", [createCrew("c0", "s0", "Ada", "medic"), createCrew("c1", "s1", "Bob", "pilot")]), "s0", "scrap-raider");
  medic = castVote(medic, "s1", "scrap-raider");
  medic.crew.c1!.health = 20;
  medic = applyShipCommand(medic, { kind: "useAbility", crewId: "c0" });
  expect(medic.crew.c1?.health).toBe(50);
  expect(medic.crew.c0?.abilityCooldownTicks).toBe(32);
  expect(() => applyShipCommand(medic, { kind: "useAbility", crewId: "c0" })).toThrow("cooling down");
});
