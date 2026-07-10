import { expect, test } from "bun:test";
import type { RunState } from "./types";
import { applyShipCommand, createCrew, createRun, createShip, SHIP_LAYOUTS, shortestRoomPath, stepShipSimulation } from "./ship";
import { castVote } from "./run";

function encounter(role: "pilot" | "engineer" | "gunner" | "medic", roomId = "bridge") {
  return castVote(createRun("seed", [createCrew("c0", "s0", "Ada", role, roomId)]), "s0", "scrap-raider");
}

function completeInteraction(run: RunState, ticks = 5): RunState {
  for (let i = 0; i < ticks; i += 1) run = stepShipSimulation(run, () => 1);
  return run;
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

test("crew channels before operating a colocated station", () => {
  const run = encounter("pilot");
  const moved = applyShipCommand(run, { kind: "move", crewId: "c0", roomId: "weapons" });
  const started = applyShipCommand(moved, { kind: "operate", crewId: "c0", systemId: "weapons" });
  expect(started.crew.c0?.interaction).toMatchObject({ kind: "operate", ticksDone: 0, totalTicks: 5 });
  const operated = completeInteraction(started);
  expect(operated.crew.c0?.roomId).toBe("weapons");
  expect(operated.ship.systems.weapons.operatorCrewId).toBe("c0");
  expect(run.crew.c0?.roomId).toBe("bridge");
});

test("only an engineering operator can reroute reactor power", () => {
  const run = encounter("engineer", "engineering");
  expect(() => applyShipCommand(run, { kind: "setPower", crewId: "c0", systemId: "weapons", power: 2 })).toThrow(
    "only an engineering operator",
  );

  let operated = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "reactor" });
  operated = completeInteraction(operated);
  const rerouted = applyShipCommand(operated, { kind: "setPower", crewId: "c0", systemId: "weapons", power: 2 });
  expect(rerouted.ship.systems.weapons.power).toBe(2);
  expect(rerouted.crew.c0?.interaction).toBeUndefined();
});

test("power allocation respects reactor capacity and damaged system bars", () => {
  let run = encounter("engineer", "engineering");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "reactor" });
  run = completeInteraction(run);
  run.ship.systems.weapons.health = 1;

  expect(() => applyShipCommand(run, { kind: "setPower", crewId: "c0", systemId: "weapons", power: 2 })).toThrow(
    "functional system capacity",
  );
  run.ship.systems.weapons.health = 4;
  run.ship.systems.shields.power = 3;
  run.ship.systems.oxygen.power = 1;
  run.ship.systems.helm.power = 1;
  expect(() => applyShipCommand(run, { kind: "setPower", crewId: "c0", systemId: "weapons", power: 1 })).toThrow(
    "reactor capacity exceeded",
  );
});

test("system damage immediately depowers bars it can no longer support", () => {
  let run = encounter("engineer", "engineering");
  run.ship.systems.weapons.power = 3;
  run.ship.systems.weapons.health = 1;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.systems.weapons.power).toBe(1);
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

test("WASD movement crosses a room boundary only at its open door tile", () => {
  const run = encounter("gunner", "weapons");
  run.crew.c0!.deckX = 7;
  run.crew.c0!.deckY = 3;
  expect(() => applyShipCommand(run, { kind: "moveVector", crewId: "c0", dx: 0, dy: 1 })).toThrow("no open door in that direction");
});

test("breach drains oxygen and low oxygen incapacitates crew deterministically", () => {
  let run = encounter("engineer", "engineering");
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "engineering" || door.roomB === "engineering") door.state = "locked";
  }
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

test("manned weapons charge, fire an aimed volley, and win the encounter", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 0;
  run.enemy!.hull = 2;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = applyShipCommand(run, { kind: "setWeaponTarget", crewId: "c0", target: "core" });
  run = applyShipCommand(run, { kind: "fireWeapon", crewId: "c0" });
  expect(run.enemy?.hull).toBe(0);
  expect(run.status).toBe("victory");
});

test("weapons only charge while powered and their operator selects the target", () => {
  let run = encounter("gunner", "weapons");
  expect(() => applyShipCommand(run, { kind: "setWeaponTarget", crewId: "c0", target: "weapons" })).toThrow(
    "only the weapons operator",
  );
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  expect(run.ship.weaponChargeTicks).toBe(2);
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.weaponChargeTicks).toBe(4);
  run = applyShipCommand(run, { kind: "setWeaponTarget", crewId: "c0", target: "weapons" });
  expect(run.ship.weaponTarget).toBe("weapons");
  run.ship.systems.weapons.power = 0;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.weaponChargeTicks).toBe(0);
});

test("an aimed shield volley strips two layers and consumes its charge", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 2;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = applyShipCommand(run, { kind: "fireWeapon", crewId: "c0" });
  expect(run.enemy?.shields).toBe(0);
  expect(run.ship.weaponChargeTicks).toBe(0);
});

test("a manned weapon auto-fires the tick after charging completes, with no manual fire command", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 0;
  run.enemy!.hull = 10;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = stepShipSimulation(run, () => 0.5);
  expect(run.enemy!.hull).toBe(8);
  expect(run.ship.weaponChargeTicks).toBe(0);
});

test("a manned auto-fire volley can still miss, at a low rate", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 0;
  run.enemy!.hull = 10;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = stepShipSimulation(run, () => 0.05);
  expect(run.enemy!.hull).toBe(10);
  expect(run.ship.weaponChargeTicks).toBe(0);
});

test("a manned auto-fire volley can crit for double damage", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 0;
  run.enemy!.hull = 10;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = stepShipSimulation(run, () => 0.15);
  expect(run.enemy!.hull).toBe(6);
});

test("an unmanned auto-turret volley misses far more often and never crits", () => {
  let run = encounter("pilot", "weapons");
  run.installedUpgrades.push("auto-turret");
  run.enemy!.shields = 0;
  run.enemy!.hull = 10;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = stepShipSimulation(run, () => 0.3);
  expect(run.enemy!.hull).toBe(10);
  expect(run.ship.weaponChargeTicks).toBe(0);
});

test("manual fire always lands cleanly regardless of the auto-fire miss chance", () => {
  let run = encounter("gunner", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "weapons" });
  run = completeInteraction(run);
  run.enemy!.shields = 0;
  run.enemy!.hull = 10;
  run.ship.weaponChargeTicks = run.ship.weaponChargeMaxTicks;
  run = applyShipCommand(run, { kind: "fireWeapon", crewId: "c0" });
  expect(run.enemy?.hull).toBe(8);
});

test("boarders sabotage systems and can be fought by colocated crew", () => {
  let run = encounter("gunner", "oxygen");
  run.boarders.b0 = { id: "b0", roomId: "oxygen", health: 40, targetRoomId: "oxygen" };
  run = applyShipCommand(run, { kind: "attackBoarder", crewId: "c0", boarderId: "b0" });
  run = completeInteraction(run);
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
  pilot = completeInteraction(pilot);
  expect(pilot.enemy?.weaponChargeTicks).toBe(7);

  let engineer = encounter("engineer", "engineering");
  engineer.ship.systems.reactor.health = 1;
  const engRoom = engineer.ship.rooms.engineering!;
  engineer.ship.fires.f0 = { id: "f0", roomId: "engineering", x: engRoom.x, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer.ship.fires.f1 = { id: "f1", roomId: "engineering", x: engRoom.x + 1, y: engRoom.y, stepsDone: 0, channelTicks: 0 };
  engineer = applyShipCommand(engineer, { kind: "useAbility", crewId: "c0" });
  engineer = completeInteraction(engineer);
  expect(engineer.ship.systems.reactor.health).toBe(3);
  expect(Object.values(engineer.ship.fires).filter((fire) => fire.roomId === "engineering")).toHaveLength(1);

  let gunner = encounter("gunner");
  gunner.enemy!.shields = 0;
  gunner = applyShipCommand(gunner, { kind: "useAbility", crewId: "c0" });
  gunner = completeInteraction(gunner);
  expect(gunner.enemy?.hull).toBe(15);

  let medic = castVote(createRun("seed", [createCrew("c0", "s0", "Ada", "medic"), createCrew("c1", "s1", "Bob", "pilot")]), "s0", "scrap-raider");
  medic = castVote(medic, "s1", "scrap-raider");
  medic.crew.c1!.health = 20;
  medic = applyShipCommand(medic, { kind: "useAbility", crewId: "c0" });
  medic = completeInteraction(medic);
  expect(medic.crew.c1?.health).toBe(50);
  expect(medic.crew.c0?.abilityCooldownTicks).toBe(31);
  expect(() => applyShipCommand(medic, { kind: "useAbility", crewId: "c0" })).toThrow("cooling down");
});

test("medbay healing restores 10 health alone and 20 health with a conscious ally", () => {
  let solo = encounter("medic", "medbay");
  solo.crew.c0!.health = 45;
  solo = applyShipCommand(solo, { kind: "heal", crewId: "c0" });
  expect(solo.crew.c0?.interaction).toMatchObject({ kind: "heal", ticksDone: 0, totalTicks: 5 });
  solo = completeInteraction(solo);
  expect(solo.crew.c0?.health).toBe(55);

  let paired = castVote(createRun("seed", [createCrew("c0", "s0", "Ada", "medic", "medbay"), createCrew("c1", "s1", "Bob", "pilot", "medbay")]), "s0", "scrap-raider");
  paired = castVote(paired, "s1", "scrap-raider");
  paired.crew.c0!.health = 45;
  paired = applyShipCommand(paired, { kind: "heal", crewId: "c0" });
  paired = completeInteraction(paired);
  expect(paired.crew.c0?.health).toBe(65);
});

test("medbay healing is unavailable outside the medbay or at full health", () => {
  const elsewhere = encounter("medic", "bridge");
  elsewhere.crew.c0!.health = 50;
  expect(() => applyShipCommand(elsewhere, { kind: "heal", crewId: "c0" })).toThrow("requires the medbay");

  const fullHealth = encounter("medic", "medbay");
  expect(() => applyShipCommand(fullHealth, { kind: "heal", crewId: "c0" })).toThrow("already at full health");
});

test("extinguish starts channeling on the targeted fire token", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  expect(run.crew.c0?.extinguishingFireId).toBe("f0");
  expect(run.ship.fires.f0).toBeDefined();
});

test("a crew member channels before opening a closed interior door", () => {
  let run = encounter("pilot");
  run.ship.doors["bridge--weapons"]!.state = "closed";
  run = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "open" });
  expect(run.ship.doors["bridge--weapons"]?.state).toBe("closed");
  const opened = completeInteraction(run);
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
  run = completeInteraction(run);
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull" && door.roomA === "weapons")!.id;
  let opened = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  opened = completeInteraction(opened);
  expect(opened.ship.doors[hullVentId]?.state).toBe("open");
  let relocked = applyShipCommand(opened, { kind: "setDoorState", crewId: "c0", doorId: "bridge--weapons", state: "locked" });
  relocked = completeInteraction(relocked);
  expect(relocked.ship.doors["bridge--weapons"]?.state).toBe("locked");
});

test("opening a hull vent kills anyone inside and empties the room's oxygen", () => {
  let run = encounter("pilot", "bridge");
  run.crew.c1 = createCrew("c1", "s1", "Riko", "engineer", "weapons");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "helm" });
  run = completeInteraction(run);
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull" && door.roomA === "weapons")!.id;
  run.ship.rooms.weapons!.oxygen = 90;
  let vented = applyShipCommand(run, { kind: "setDoorState", crewId: "c0", doorId: hullVentId, state: "open" });
  vented = completeInteraction(vented);
  expect(vented.ship.rooms.weapons?.oxygen).toBe(0);
  expect(vented.crew.c1).toBeUndefined();
  expect(vented.crew.c0).toBeDefined();
});

test("venting a room clears its system's operatorCrewId and stops phantom oxygen production", () => {
  let run = encounter("engineer", "oxygen");
  run.crew.c1 = createCrew("c1", "s1", "Riko", "pilot", "bridge");
  for (const door of Object.values(run.ship.doors)) {
    if (door.kind === "interior" && (door.roomA === "oxygen" || door.roomB === "oxygen")) door.state = "locked";
  }
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "oxygen" });
  run = completeInteraction(run);
  run = applyShipCommand(run, { kind: "operate", crewId: "c1", systemId: "helm" });
  run = completeInteraction(run);
  expect(run.ship.systems.oxygen.operatorCrewId).toBe("c0");
  const hullVentId = Object.values(run.ship.doors).find((door) => door.kind === "hull" && door.roomA === "oxygen")!.id;
  let vented = applyShipCommand(run, { kind: "setDoorState", crewId: "c1", doorId: hullVentId, state: "open" });
  vented = completeInteraction(vented);
  expect(vented.crew.c0).toBeUndefined();
  expect(vented.ship.systems.oxygen.operatorCrewId).toBeUndefined();
  expect(vented.ship.rooms.oxygen?.oxygen).toBe(0);

  const stepped = stepShipSimulation(vented, () => 1);
  expect(stepped.ship.rooms.oxygen?.oxygen).toBe(0);
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
  run = stepShipSimulation(run, () => 0.99);
  expect(Object.values(run.ship.rooms).some((room) => room.integrity < room.maxIntegrity)).toBe(true);
});

test("the enemy's first hull hit scripts a combined fire and breach while the player's weapon is still charging", () => {
  let run = encounter("pilot");
  run.ship.shields = 0;
  run.enemy!.weaponChargeTicks = run.enemy!.weaponChargeMaxTicks - 1;
  run = stepShipSimulation(run, () => 0);
  expect(run.enemy?.scriptedVolleyUsed).toBe(true);
  expect(run.ship.rooms.bridge?.breached).toBe(true);
  expect(Object.values(run.ship.fires).some((fire) => fire.roomId === "bridge")).toBe(true);
});

test("later hull hits fall back to a single random hazard once the scripted volley is spent", () => {
  let run = encounter("pilot");
  run.ship.shields = 0;
  run.enemy!.scriptedVolleyUsed = true;
  run.enemy!.weaponChargeTicks = run.enemy!.weaponChargeMaxTicks - 1;
  run = stepShipSimulation(run, () => 0.99);
  expect(run.ship.rooms.oxygen?.breached).toBe(true);
  expect(Object.values(run.ship.fires).some((fire) => fire.roomId === "oxygen")).toBe(false);
});

test("a small fire is extinguished by a short channel", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  expect(run.crew.c0?.interaction?.totalTicks).toBe(3);
  for (let i = 0; i < 2; i += 1) run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeDefined();
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0).toBeUndefined();
});

test("ignored fires escalate and take longer to extinguish", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  for (let i = 0; i < 15; i += 1) run = stepShipSimulation(run, () => 1);
  expect(run.ship.fires.f0?.size).toBe("medium");
  run = applyShipCommand(run, { kind: "extinguish", crewId: "c0", fireId: "f0" });
  expect(run.crew.c0?.interaction?.totalTicks).toBe(6);
});

test("a single fire chips away at a room's health pool", () => {
  let run = encounter("pilot", "bridge");
  const initialIntegrity = run.ship.rooms.bridge!.integrity;
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };

  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.bridge?.integrity).toBe(initialIntegrity - 1);
});

test("a fire deals only one health damage per tick to nearby crew", () => {
  let run = encounter("pilot", "bridge");
  run.ship.fires.f0 = { id: "f0", roomId: "bridge", x: 8, y: 3, stepsDone: 0, channelTicks: 0 };
  run = stepShipSimulation(run, () => 1);
  expect(run.crew.c0?.health).toBe(99);
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
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "bridge" || door.roomB === "bridge") door.state = "locked";
  }
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

test("an empty room's oxygen does not change on its own", () => {
  let run = encounter("pilot", "bridge");
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  run.ship.rooms.shields!.oxygen = 42;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.shields?.oxygen).toBe(42);
});

test("occupied rooms drain oxygen faster with more crew present", () => {
  let solo = encounter("pilot", "shields");
  for (const door of Object.values(solo.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  solo = stepShipSimulation(solo, () => 1);
  expect(solo.ship.rooms.shields?.oxygen).toBe(99);

  let crewed = createRun("seed", [
    createCrew("c0", "s0", "Ada", "pilot", "shields"),
    createCrew("c1", "s1", "Bo", "gunner", "shields"),
  ]);
  crewed = castVote(crewed, "s0", "scrap-raider");
  crewed = castVote(crewed, "s1", "scrap-raider");
  for (const door of Object.values(crewed.ship.doors)) {
    if (door.roomA === "shields" || door.roomB === "shields") door.state = "locked";
  }
  crewed = stepShipSimulation(crewed, () => 1);
  expect(crewed.ship.rooms.shields?.oxygen).toBe(98);
});

test("oxygen only regenerates in the oxygen room while it is operated, and equalizes through its open door", () => {
  let run = encounter("engineer", "oxygen");
  for (const door of Object.values(run.ship.doors)) {
    if (door.id !== "medbay--oxygen") door.state = "locked";
  }
  run.ship.rooms.oxygen!.oxygen = 50;
  run.ship.rooms.medbay!.oxygen = 50;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.oxygen?.oxygen).toBe(50);

  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "oxygen" });
  run = completeInteraction(run);
  expect(run.ship.systems.oxygen.operatorCrewId).toBe("c0");
});

test("operating the oxygen system raises levels ship-wide, not just in its own room", () => {
  let run = encounter("engineer", "oxygen");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "oxygen" });
  run = completeInteraction(run);
  run.ship.rooms.bridge!.oxygen = 50;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.bridge?.oxygen).toBeGreaterThan(50);
});

test("a breached room is excluded from the ship-wide oxygen trickle", () => {
  let run = encounter("engineer", "oxygen");
  run = applyShipCommand(run, { kind: "operate", crewId: "c0", systemId: "oxygen" });
  run = completeInteraction(run);
  for (const door of Object.values(run.ship.doors)) {
    if (door.roomA === "bridge" || door.roomB === "bridge") door.state = "locked";
  }
  run.ship.rooms.bridge!.breached = true;
  run.ship.rooms.bridge!.oxygen = 0;
  run = stepShipSimulation(run, () => 1);
  expect(run.ship.rooms.bridge?.oxygen).toBe(0);
});
