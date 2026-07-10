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
  closed.ship.doors["bridge--weapons"]!.state = "closed";
  expect(() => applyShipCommand(closed, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");

  const locked = encounter("pilot");
  locked.ship.doors["bridge--weapons"]!.state = "locked";
  expect(() => applyShipCommand(locked, { kind: "move", crewId: "c0", roomId: "weapons" })).toThrow("not directly reachable");
});

test("doors are anchored to a specific tile-to-tile junction", () => {
  const ship = createShip();
  const door = ship.doors["bridge--weapons"];
  expect(door).toMatchObject({ kind: "interior", state: "open", roomA: "weapons", roomB: "bridge" });
  expect(door!.x).toBe(7);
  expect(door!.y).toBe(3);
  expect(door!.side).toBe("e");
});

test("every room boundary tile not touching another room gets a locked hull vent", () => {
  const ship = createShip();
  const hullVents = Object.values(ship.doors).filter((door) => door.kind === "hull");
  expect(hullVents.length).toBeGreaterThan(0);
  for (const vent of hullVents) {
    expect(vent.state).toBe("locked");
    expect(vent.roomB).toBeUndefined();
  }
  const weaponsVents = hullVents.filter((door) => door.roomA === "weapons");
  expect(weaponsVents.length).toBeGreaterThan(0);
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
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
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
  const engRoom = engineer.ship.rooms.engineering!;
  engineer.ship.fires.f0 = { id: "f0", roomId: "engineering", x: engRoom.x, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer.ship.fires.f1 = { id: "f1", roomId: "engineering", x: engRoom.x + 1, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer = applyShipCommand(engineer, { kind: "useAbility", crewId: "c0" });
  expect(engineer.ship.systems.reactor.health).toBe(3);
  expect(Object.values(engineer.ship.fires).filter((fire) => fire.roomId === "engineering")).toHaveLength(1);

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

test("extinguish starts channeling on the targeted fire token", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  expect(run.crew.c0?.extinguishingFireId).toBe("f0");
  expect(run.ship.fires.f0).toBeDefined();
});

test("a crew member can open a closed interior door from either side", () => {
  const run = encounter("pilot");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  const opened = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "open" });
  expect(opened.ship.doors["bridge--weapons"]?.state).toBe("open");
});

test("only a crew member at the door can open it, and only the bridge can close or lock it", () => {
  const run = encounter("pilot", "engineering");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  expect(() => applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "open" })).toThrow(
    "not at that door",
  );
  expect(() => applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "closed" })).toThrow(
    "only the bridge",
  );
});

test("bridge operator controls any door or hull vent ship-wide", () => {
  let run = encounter("pilot", "bridge");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "helm" });
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull")!.id;
  const opened = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  expect(opened.ship.doors[hullVentId]?.state).toBe("open");
  const relocked = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "locked" });
  expect(relocked.ship.doors["bridge--weapons"]?.state).toBe("locked");
});

test("opening a hull vent kills anyone inside and empties the room's oxygen", () => {
  let run = encounter("pilot", "bridge");
  run.crew.c1 = createCrew("c1", "s1", "Riko", "engineer", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "helm" });
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull" && door.roomA === "weapons")!.id;
  run.ship.rooms.weapons!.oxygen = 90;
  const vented = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  expect(vented.ship.rooms.weapons?.oxygen).toBe(0);
  expect(vented.crew.c1).toBeUndefined();
  expect(vented.crew.c0).toBeDefined();
});

test("a room at zero integrity is destroyed: its system dies, it breaches, and its doors lock", () => {
  let run = encounter("engineer", "engineering");
  run.ship.rooms.engineering!.integrity = 0;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.engineering?.destroyed).toBe(true);
  expect(run.ship.rooms.engineering?.breached).toBe(true);
  expect(run.ship.systems.reactor.health).toBe(0);
  const touchingDoors = Object.values(run.ship.doors).filter((door) => door.roomA === "engineering" || door.roomB === "engineering");
  expect(touchingDoors.length).toBeGreaterThan(0);
  expect(touchingDoors.every((door) => door.state === "locked")).toBe(true);
});

test("a weapon hit reduces the target room's integrity", () => {
  let run = encounter("pilot");
  run.enemy!.weaponChargeTicks = run.enemy!.weaponChargeMaxTicks - 1;
  run.ship.shields = 0;
  const before = { ...run.ship.rooms.bridge! };
  run = stepShipSimulation(run, () => 0.99);
  const hitRoom = Object.values(run.ship.rooms).find((room, index) => room.integrity < Object.values(before as never)[index]);
  expect(Object.values(run.ship.rooms).some((room) => room.integrity < room.maxIntegrity)).toBe(true);
});

test("extinguishing a fire takes three channeled steps", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  for (let i = 0; i < 14; i += 1) run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeDefined();
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeUndefined();
});

test("moving away from a fire resets its extinguish progress", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  run = stepShipSimulation(run, () => 1);
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0?.channelTicks).toBe(2);
  run = applyShipCommand(run, { kind: "moveVector", crewId: "c0", dx: -1, dy: 0 });
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toMatchObject({ stepsDone: 0, channelTicks: 0 });
});

test("taking damage while channeling does not interrupt extinguish progress", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run.ship.rooms.bridge!.oxygen = 5;
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  run = stepShipSimulation(run, () => 1);
  expect(run.crew.c0!.health).toBeLessThan(100);
  expect(run.ship.fires.f0?.channelTicks).toBe(1);
});

test("fire self-extinguishes once its room runs out of oxygen", () => {
  let run = encounter("pilot", "bridge");
  run.ship.rooms.bridge!.oxygen = 0;
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 1, channelTicks: 2 };
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeUndefined();
});

test("fire can spread into an adjacent room only through an open door", () => {
  let run = encounter("pilot", "weapons");
  run.ship.fires.f0 = { id: "f0", roomId: "weapons", x: 7, y: 3, stepsDone: 0, channelTicks: 0 };
  run = stepShipSimulation(run, () => 0);
  const spread = Object.values(run.ship.fires).some((fire) => fire.roomId === "bridge" && fire.x === 8 && fire.y === 3);
  expect(spread).toBe(true);
});

test("fire does not spread through a closed door", () => {
  let run = encounter("pilot", "weapons");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  run.ship.fires.f0 = { id: "f0", roomId: "weapons", x: 7, y: 3, stepsDone: 0, channelTicks: 0 };
  run = stepShipSimulation(run, () => 0);
  const spread = Object.values(run.ship.fires).some((fire) => fire.roomId === "bridge");
  expect(spread).toBe(false);
});
