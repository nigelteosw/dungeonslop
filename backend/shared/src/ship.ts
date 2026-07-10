import type {
  CrewRole,
  CrewState,
  DoorKind,
  DoorSide,
  DoorState,
  RunState,
  ShipCommand,
  ShipDoor,
  ShipState,
  SystemId,
  WeaponTarget,
} from "./types";
import type { Rng } from "./rng";

export const SHIP_ROOM_IDS = ["bridge", "shields", "medbay", "engineering", "weapons", "oxygen"] as const;

const SYSTEM_ROOMS: Record<SystemId, string> = {
  helm: "bridge",
  reactor: "engineering",
  weapons: "weapons",
  shields: "shields",
  oxygen: "oxygen",
};

const ROOM_MAX_INTEGRITY = 100;
const HIT_INTEGRITY_DAMAGE = 25;
const FIRE_OXY_DRAIN_PER_TOKEN = 2;
const FIRE_INTEGRITY_DAMAGE_PER_TOKEN = 1;
const FIRE_CREW_DAMAGE_PER_TOKEN = 1;
const STEP_TICKS = 5;
const INTERACTION_TICKS = 5;
const FIRE_EXTINGUISH_TICKS: Record<"small" | "medium" | "large", number> = { small: 3, medium: 6, large: 9 };
const FIRE_GROW_TICKS = { medium: 15, large: 30 };
const FIRE_SPREAD_CHANCE = 0.0125;
const SPREAD_SIDES: DoorSide[] = ["e", "n", "s", "w"];
const OXY_DRAIN_PER_CREW = 1;
const OXY_PRODUCE_PER_TICK = 2;
const OXY_SHIPWIDE_PRODUCE_PER_TICK = 1;
const OXY_EQUALIZE_RATE = 3;

export interface RoomBounds { x: number; y: number; w: number; h: number; }
interface ShipLayoutDef { rooms: Record<string, RoomBounds>; doors: readonly [string, string][]; }

export const SHIP_LAYOUTS: Record<string, ShipLayoutDef> = {
  balanced: {
    rooms: { engineering:{x:2,y:3,w:2,h:2}, shields:{x:4,y:2,w:2,h:2}, oxygen:{x:4,y:4,w:2,h:2}, weapons:{x:6,y:2,w:2,h:2}, medbay:{x:6,y:4,w:2,h:2}, bridge:{x:8,y:3,w:2,h:2} },
    doors: [["engineering","shields"],["engineering","oxygen"],["shields","weapons"],["oxygen","medbay"],["weapons","medbay"],["weapons","bridge"],["medbay","bridge"]],
  },
  battle: {
    rooms: { engineering:{x:2,y:3,w:2,h:2}, oxygen:{x:4,y:2,w:2,h:2}, medbay:{x:4,y:4,w:2,h:2}, shields:{x:6,y:2,w:2,h:2}, weapons:{x:6,y:4,w:2,h:2}, bridge:{x:8,y:3,w:2,h:2} },
    doors: [["engineering","oxygen"],["engineering","medbay"],["oxygen","shields"],["medbay","weapons"],["shields","weapons"],["shields","bridge"],["weapons","bridge"]],
  },
  rescue: {
    rooms: { engineering:{x:2,y:2,w:2,h:2}, oxygen:{x:2,y:4,w:2,h:2}, shields:{x:4,y:2,w:2,h:2}, medbay:{x:4,y:4,w:2,h:2}, weapons:{x:6,y:3,w:2,h:2}, bridge:{x:8,y:3,w:2,h:2} },
    doors: [["engineering","oxygen"],["engineering","shields"],["oxygen","medbay"],["shields","medbay"],["shields","weapons"],["medbay","weapons"],["weapons","bridge"]],
  },
};

function doorId(a: string, b: string): string {
  return [a, b].sort().join("--");
}

const SIDE_DELTA: Record<DoorSide, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
};
const OPPOSITE_SIDE: Record<DoorSide, DoorSide> = { n: "s", s: "n", e: "w", w: "e" };

function computeInteriorDoorAnchor(boundsA: RoomBounds, boundsB: RoomBounds): { x: number; y: number; side: DoorSide } {
  if (boundsA.x + boundsA.w === boundsB.x) return { x: boundsA.x + boundsA.w - 1, y: Math.max(boundsA.y, boundsB.y), side: "e" };
  if (boundsB.x + boundsB.w === boundsA.x) return { x: boundsA.x, y: Math.max(boundsA.y, boundsB.y), side: "w" };
  if (boundsA.y + boundsA.h === boundsB.y) return { x: Math.max(boundsA.x, boundsB.x), y: boundsA.y + boundsA.h - 1, side: "s" };
  if (boundsB.y + boundsB.h === boundsA.y) return { x: Math.max(boundsA.x, boundsB.x), y: boundsA.y, side: "n" };
  throw new Error("rooms do not share a wall");
}

function deriveHullVents(layoutId: string, rooms: Record<string, { id: string } & RoomBounds>): ShipDoor[] {
  const vents: ShipDoor[] = [];
  for (const room of Object.values(rooms)) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      for (let y = room.y; y < room.y + room.h; y += 1) {
        for (const side of ["n", "s", "e", "w"] as DoorSide[]) {
          const delta = SIDE_DELTA[side];
          if (roomAtDeckPosition(layoutId, x + delta.dx, y + delta.dy)) continue;
          vents.push({ id: `hull-${room.id}-${x}-${y}-${side}`, x, y, side, kind: "hull", state: "locked", roomA: room.id });
        }
      }
    }
  }
  return vents;
}

function interiorDoorAt(doors: Record<string, ShipDoor>, x: number, y: number, side: DoorSide): ShipDoor | undefined {
  const delta = SIDE_DELTA[side];
  return Object.values(doors).find((door) => {
    if (door.kind !== "interior") return false;
    if (door.x === x && door.y === y && door.side === side) return true;
    return door.x === x + delta.dx && door.y === y + delta.dy && door.side === OPPOSITE_SIDE[side];
  });
}

function buildDoors(layoutId: string, layout: ShipLayoutDef, rooms: Record<string, { id: string } & RoomBounds>): Record<string, ShipDoor> {
  const interiorDoors = layout.doors.map(([a, b]): ShipDoor => {
    const boundsA = layout.rooms[a];
    const boundsB = layout.rooms[b];
    if (!boundsA || !boundsB) throw new Error(`door references unknown room ${a} or ${b}`);
    const anchor = computeInteriorDoorAnchor(boundsA, boundsB);
    return { id: doorId(a, b), ...anchor, kind: "interior", state: "open", roomA: a, roomB: b };
  });
  const hullVents = deriveHullVents(layoutId, rooms);
  return Object.fromEntries([...interiorDoors, ...hullVents].map((door) => [door.id, door]));
}

function ventRoom(next: RunState, roomId: string): void {
  const room = next.ship.rooms[roomId];
  if (!room) return;
  room.oxygen = 0;
  for (const fireId of Object.keys(next.ship.fires)) {
    if (next.ship.fires[fireId]?.roomId === roomId) delete next.ship.fires[fireId];
  }
  for (const crew of Object.values(next.crew)) {
    if (crew.roomId === roomId) {
      for (const system of Object.values(next.ship.systems)) {
        if (system.operatorCrewId === crew.id) system.operatorCrewId = undefined;
      }
      delete next.crew[crew.id];
    }
  }
}

function igniteRandomTile(ship: ShipState, roomId: string, rng: Rng, tick: number): void {
  const room = ship.rooms[roomId];
  if (!room) return;
  for (let attempt = 0; attempt < room.w * room.h; attempt += 1) {
    const x = room.x + Math.floor(rng() * room.w);
    const y = room.y + Math.floor(rng() * room.h);
    const occupied = Object.values(ship.fires).some((fire) => fire.roomId === roomId && fire.x === x && fire.y === y);
    if (occupied) continue;
    const id = `fire-${roomId}-${x}-${y}-${tick}`;
    ship.fires[id] = { id, roomId, x, y, size: "small", ageTicks: 0, stepsDone: 0, channelTicks: 0 };
    return;
  }
}

function extinguishOneToken(ship: ShipState, roomId: string): void {
  const target = Object.values(ship.fires).find((fire) => fire.roomId === roomId);
  if (target) delete ship.fires[target.id];
}

export function igniteRoomOrigin(ship: ShipState, roomId: string): void {
  const room = ship.rooms[roomId];
  if (!room) return;
  const occupied = Object.values(ship.fires).some((fire) => fire.roomId === roomId && fire.x === room.x && fire.y === room.y);
  if (occupied) return;
  const id = `fire-${roomId}-${room.x}-${room.y}-vote`;
  ship.fires[id] = { id, roomId, x: room.x, y: room.y, size: "small", ageTicks: 0, stepsDone: 0, channelTicks: 0 };
}

export function createShip(layoutId = "balanced"): ShipState {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) throw new Error("unknown ship layout");
  const rooms = Object.fromEntries(SHIP_ROOM_IDS.map((id) => {
    const bounds = layout.rooms[id];
    if (!bounds) throw new Error(`room ${id} missing from ship layout`);
    return [id, { id, ...bounds, oxygen: 100, breached: false, integrity: ROOM_MAX_INTEGRITY, maxIntegrity: ROOM_MAX_INTEGRITY, destroyed: false }];
  }));
  const doors = buildDoors(layoutId, layout, rooms);
  const systems = Object.fromEntries(
    (Object.entries(SYSTEM_ROOMS) as [SystemId, string][]).map(([id, roomId]) => [
      id,
      { id, roomId, health: 4, maxHealth: 4, power: id === "reactor" ? 0 : 1, maxPower: id === "reactor" ? 0 : 3 },
    ]),
  ) as ShipState["systems"];
  return {
    layoutId, hull: 50, maxHull: 50, shields: 2, maxShields: 3, scrap: 0, reactorCapacity: 5,
    weaponChargeTicks: 0, weaponChargeMaxTicks: 12, weaponTarget: "shields", rooms, doors, fires: {}, systems,
  };
}

function roomCenter(layoutId: string, roomId: string): { x: number; y: number } {
  const bounds = SHIP_LAYOUTS[layoutId]?.rooms[roomId];
  if (!bounds) throw new Error("room missing from ship layout");
  return { x: bounds.x + Math.floor((bounds.w - 1) / 2), y: bounds.y + Math.floor((bounds.h - 1) / 2) };
}

export function roomAtDeckPosition(layoutId: string, x: number, y: number): string | undefined {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) return undefined;
  return Object.entries(layout.rooms).find(([, room]) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h)?.[0];
}

export function applyShipLayout(state: RunState, layoutId: string): RunState {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) throw new Error("unknown ship layout");
  const next = structuredClone(state);
  next.ship.layoutId = layoutId;
  for (const [roomId, bounds] of Object.entries(layout.rooms)) {
    const room = next.ship.rooms[roomId];
    if (room) Object.assign(room, bounds);
  }
  next.ship.doors = buildDoors(layoutId, layout, next.ship.rooms);
  for (const crew of Object.values(next.crew)) {
    const center = roomCenter(layoutId, crew.roomId);
    crew.deckX = center.x;
    crew.deckY = center.y;
  }
  return next;
}

export function createCrew(id: string, ownerId: string, name: string, role: CrewRole, roomId = "bridge"): CrewState {
  if (!SHIP_ROOM_IDS.includes(roomId as (typeof SHIP_ROOM_IDS)[number])) throw new Error("unknown ship room");
  const spawn = roomCenter("balanced", roomId);
  return {
    id,
    ownerId,
    name,
    role,
    roomId,
    deckX: spawn.x,
    deckY: spawn.y,
    health: 100,
    maxHealth: 100,
    incapacitated: false,
    bleedoutTicks: 0,
    abilityCooldownTicks: 0,
  };
}

export function createRun(seed: string, crew: CrewState[]): RunState {
  if (crew.length < 1 || crew.length > 4) throw new Error("runs require 1-4 crew");
  return {
    seed,
    status: "mapVote",
    tick: 0,
    sectorIndex: 0,
    nodeIndex: 0,
    captainSeat: 0,
    ship: createShip(),
    crew: Object.fromEntries(crew.map((member) => [member.id, structuredClone(member)])),
    boarders: {},
    vote: { kind: "map", options: ["scrap-raider", "shield-leech", "volatile-derelict", "suspicious-signal", "quarantine-buoy", "union-freighter"], votes: {}, deadlineTick: 40 },
    objectiveText: "Vote on the next destination",
    slopEffectId: "hot-reactor-summer",
    installedUpgrades: [],
  };
}

export function adjacentRooms(ship: ShipState, roomId: string): string[] {
  if (!ship.rooms[roomId]) throw new Error("unknown ship room");
  return Object.values(ship.doors)
    .filter((door) => door.kind === "interior" && door.state === "open" && (door.roomA === roomId || door.roomB === roomId))
    .map((door) => (door.roomA === roomId ? door.roomB! : door.roomA));
}

export function shortestRoomPath(ship: ShipState, from: string, to: string): string[] {
  if (!ship.rooms[from] || !ship.rooms[to]) throw new Error("unknown ship room");
  const queue: string[][] = [[from]];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    if (!current) continue;
    if (current === to) return path;
    for (const next of adjacentRooms(ship, current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  return [];
}

function activeCrew(state: RunState, crewId: string): CrewState {
  const crew = state.crew[crewId];
  if (!crew) throw new Error("unknown crew member");
  if (crew.incapacitated) throw new Error("crew member is incapacitated");
  return crew;
}

function functionalPowerLimit(system: ShipState["systems"][SystemId]): number {
  return Math.max(0, Math.min(system.maxPower, system.health));
}

function allocatedPower(ship: ShipState, replacement?: { systemId: SystemId; power: number }): number {
  return Object.values(ship.systems).reduce((total, system) => {
    if (system.id === "reactor") return total;
    return total + (replacement?.systemId === system.id ? replacement.power : system.power);
  }, 0);
}

function normalizeSystemPower(ship: ShipState): void {
  for (const system of Object.values(ship.systems)) {
    if (system.id === "reactor") {
      system.power = 0;
      continue;
    }
    system.power = Math.min(system.power, functionalPowerLimit(system));
  }
}

function requireWeaponOperator(next: RunState, crewId: string): void {
  const crew = next.crew[crewId];
  const weapons = next.ship.systems.weapons;
  if (!crew || crew.roomId !== weapons.roomId || weapons.operatorCrewId !== crew.id) {
    throw new Error("only the weapons operator can control the volley");
  }
  if (weapons.health <= 0 || weapons.power <= 0) throw new Error("weapons are offline");
}

// Manual fire (a crew member pulling the trigger) always lands cleanly. Auto-fire -
// what happens once the volley is ready and nobody has fired it yet - is rolled: a
// crewed weapon is still reliable and can crit, an unattended auto-turret often misses
// and never crits.
const WEAPON_AUTOFIRE_MISS_CHANCE_MANNED = 0.1;
const WEAPON_AUTOFIRE_MISS_CHANCE_UNMANNED = 0.45;
const WEAPON_AUTOFIRE_CRIT_CHANCE = 0.2;

function resolvePlayerVolley(next: RunState, autofire?: { rng: Rng; manned: boolean }): void {
  const enemy = next.enemy;
  if (!enemy) throw new Error("no hostile target");
  next.ship.weaponChargeTicks = 0;
  if (autofire) {
    const missChance = autofire.manned ? WEAPON_AUTOFIRE_MISS_CHANCE_MANNED : WEAPON_AUTOFIRE_MISS_CHANCE_UNMANNED;
    if (autofire.rng() < missChance) return;
  }
  const crit = !!autofire?.manned && autofire.rng() < WEAPON_AUTOFIRE_CRIT_CHANCE;
  const target = next.ship.weaponTarget;
  if (enemy.shields > 0) {
    enemy.shields = Math.max(0, enemy.shields - (target === "shields" ? 2 : 1) * (crit ? 2 : 1));
  } else {
    const damage = (target === "core" ? 3 : target === "weapons" ? 1 : 2) * (crit ? 2 : 1);
    enemy.hull = Math.max(0, enemy.hull - damage);
    if (target === "weapons") enemy.weaponChargeTicks = Math.max(0, enemy.weaponChargeTicks - 8);
    if (target === "helm") enemy.weaponChargeTicks = Math.max(0, enemy.weaponChargeTicks - 3);
  }
  if (enemy.hull === 0) {
    next.status = "victory";
    next.objectiveText = "Hostile ship disabled";
  }
}

function fireSize(fire: { size?: "small" | "medium" | "large" }): "small" | "medium" | "large" {
  return fire.size ?? "small";
}

function interactionDuration(state: RunState, command: ShipCommand): number {
  return command.kind === "extinguish" ? FIRE_EXTINGUISH_TICKS[fireSize(state.ship.fires[command.fireId] ?? {})] : INTERACTION_TICKS;
}

export function applyShipCommand(state: RunState, command: ShipCommand, resolveInteraction = false): RunState {
  if (state.status !== "encounter") throw new Error("ship commands require an active encounter");
  const next = structuredClone(state);
  const crew = activeCrew(next, command.crewId);

  if (crew.interaction) {
    if (command.kind !== "move" && command.kind !== "moveVector") throw new Error("crew member is busy interacting");
    crew.interaction = undefined;
    crew.pendingCommand = undefined;
    crew.extinguishingFireId = undefined;
  }

  if (!resolveInteraction && command.kind !== "move" && command.kind !== "moveVector" && command.kind !== "setPower" && command.kind !== "setWeaponTarget" && command.kind !== "fireWeapon") {
    // Validate the action against the current authoritative state without applying
    // its effects. Resolution revalidates after the interaction bar completes.
    applyShipCommand(next, command, true);
    crew.interaction = { kind: command.kind, ticksDone: 0, totalTicks: interactionDuration(next, command) };
    crew.pendingCommand = command;
    if (command.kind === "extinguish") crew.extinguishingFireId = command.fireId;
    return next;
  }

  if (command.kind !== "extinguish") crew.extinguishingFireId = undefined;

  if (command.kind === "move") {
    if (!adjacentRooms(next.ship, crew.roomId).includes(command.roomId)) throw new Error("room is not directly reachable");
    crew.roomId = command.roomId;
    const center = roomCenter(next.ship.layoutId, command.roomId);
    crew.deckX = center.x;
    crew.deckY = center.y;
    return next;
  }

  if (command.kind === "moveVector") {
    if (Math.abs(command.dx) + Math.abs(command.dy) !== 1) throw new Error("movement must use one cardinal direction");
    const deckX = crew.deckX + command.dx;
    const deckY = crew.deckY + command.dy;
    const destinationRoom = roomAtDeckPosition(next.ship.layoutId, deckX, deckY);
    if (!destinationRoom) throw new Error("movement leaves the ship");
    if (destinationRoom !== crew.roomId) {
      const side = command.dx === 1 ? "e" : command.dx === -1 ? "w" : command.dy === 1 ? "s" : "n";
      const door = interiorDoorAt(next.ship.doors, crew.deckX, crew.deckY, side);
      const connectsRooms = door && (door.roomA === crew.roomId || door.roomB === crew.roomId)
        && (door.roomA === destinationRoom || door.roomB === destinationRoom);
      if (!connectsRooms || door.state !== "open") throw new Error("no open door in that direction");
    }
    crew.deckX = deckX;
    crew.deckY = deckY;
    crew.roomId = destinationRoom;
    return next;
  }

  if (command.kind === "operate") {
    const system = next.ship.systems[command.systemId];
    if (system.roomId !== crew.roomId) throw new Error("crew member is not at that station");
    for (const candidate of Object.values(next.ship.systems)) {
      if (candidate.operatorCrewId === crew.id) candidate.operatorCrewId = undefined;
    }
    system.operatorCrewId = crew.id;
    return next;
  }

  if (command.kind === "repair") {
    const system = next.ship.systems[command.systemId];
    if (system.roomId !== crew.roomId) throw new Error("crew member is not at that system");
    const amount = crew.role === "engineer" ? 2 : 1;
    system.health = Math.min(system.maxHealth, system.health + amount);
    return next;
  }

  if (command.kind === "setPower") {
    if (!Number.isInteger(command.power) || command.power < 0) throw new Error("power must be a non-negative whole number");
    const reactor = next.ship.systems.reactor;
    if (crew.roomId !== reactor.roomId || reactor.operatorCrewId !== crew.id) throw new Error("only an engineering operator can reroute power");
    if (command.systemId === "reactor") throw new Error("reactor power cannot be allocated directly");
    const system = next.ship.systems[command.systemId];
    if (!system) throw new Error("unknown ship system");
    if (command.power > functionalPowerLimit(system)) throw new Error("power exceeds functional system capacity");
    if (allocatedPower(next.ship, { systemId: command.systemId, power: command.power }) > next.ship.reactorCapacity) {
      throw new Error("reactor capacity exceeded");
    }
    system.power = command.power;
    return next;
  }

  if (command.kind === "setWeaponTarget") {
    requireWeaponOperator(next, crew.id);
    next.ship.weaponTarget = command.target;
    return next;
  }

  if (command.kind === "fireWeapon") {
    requireWeaponOperator(next, crew.id);
    if (next.ship.weaponChargeTicks < next.ship.weaponChargeMaxTicks) throw new Error("weapon is still charging");
    resolvePlayerVolley(next);
    return next;
  }

  if (command.kind === "setDoorState") {
    const door = next.ship.doors[command.doorId];
    if (!door) throw new Error("unknown door");
    const atBridge = next.ship.systems.helm.operatorCrewId === crew.id;
    const bridgeOnly = door.kind === "hull" || door.state === "locked" || command.state === "locked" || command.state === "closed";
    if (bridgeOnly && !atBridge) throw new Error("only the bridge can control that door");
    if (!atBridge) {
      const atDoor = crew.roomId === door.roomA || crew.roomId === door.roomB;
      if (!atDoor) throw new Error("crew member is not at that door");
    }
    door.state = command.state;
    if (door.kind === "hull" && command.state === "open") ventRoom(next, door.roomA);
    return next;
  }

  const room = next.ship.rooms[crew.roomId];
  if (!room) throw new Error("crew member is in an unknown room");
  if (command.kind === "extinguish") {
    const fire = next.ship.fires[command.fireId];
    if (!fire || fire.roomId !== crew.roomId) throw new Error("no fire there to extinguish");
    if (Math.max(Math.abs(fire.x - crew.deckX), Math.abs(fire.y - crew.deckY)) > 1) throw new Error("too far from the fire to extinguish it");
    crew.extinguishingFireId = fire.id;
    return next;
  }
  if (command.kind === "sealBreach") {
    room.breached = false;
    return next;
  }

  if (command.kind === "attackBoarder") {
    const boarder = next.boarders[command.boarderId];
    if (!boarder || boarder.roomId !== crew.roomId) throw new Error("invalid boarder target");
    boarder.health -= crew.role === "gunner" ? 40 : 25;
    if (boarder.health <= 0) delete next.boarders[boarder.id];
    return next;
  }

  if (command.kind === "useAbility") {
    if (crew.abilityCooldownTicks > 0) throw new Error("role ability is cooling down");
    if (crew.role === "pilot") {
      if (!next.enemy) throw new Error("no hostile weapon to evade");
      next.enemy.weaponChargeTicks = Math.max(0, next.enemy.weaponChargeTicks - 6);
    } else if (crew.role === "engineer") {
      const system = Object.values(next.ship.systems).find((candidate) => candidate.roomId === crew.roomId);
      if (!system) throw new Error("engineer ability requires a system room");
      system.health = Math.min(system.maxHealth, system.health + 2);
      extinguishOneToken(next.ship, crew.roomId);
    } else if (crew.role === "gunner") {
      if (!next.enemy) throw new Error("no hostile target");
      if (next.enemy.shields > 0) next.enemy.shields -= 1;
      else next.enemy.hull = Math.max(0, next.enemy.hull - 3);
    } else {
      for (const ally of Object.values(next.crew).filter((candidate) => candidate.roomId === crew.roomId)) {
        ally.incapacitated = false;
        ally.bleedoutTicks = 0;
        ally.health = Math.min(ally.maxHealth, Math.max(ally.health, 1) + 30);
      }
    }
    crew.abilityCooldownTicks = 32;
    return next;
  }

  if (command.kind === "heal") {
    if (crew.roomId !== "medbay") throw new Error("healing requires the medbay");
    if (crew.health >= crew.maxHealth) throw new Error("crew member is already at full health");
    const medbayCrew = Object.values(next.crew).filter((candidate) => candidate.roomId === "medbay" && !candidate.incapacitated);
    const amount = medbayCrew.length >= 2 ? 20 : 10;
    crew.health = Math.min(crew.maxHealth, crew.health + amount);
    return next;
  }

  const target = next.crew[command.targetCrewId];
  if (!target || target.roomId !== crew.roomId || !target.incapacitated) throw new Error("invalid revive target");
  target.incapacitated = false;
  target.health = crew.role === "medic" ? 40 : 20;
  target.bleedoutTicks = 0;
  return next;
}

export function stepShipSimulation(state: RunState, rng: Rng): RunState {
  if (state.status !== "encounter") return structuredClone(state);
  let next = structuredClone(state);
  next.tick += 1;

  for (const crew of Object.values(next.crew)) {
    if (crew.interaction && !crew.incapacitated) crew.interaction.ticksDone += 1;
  }

  const occupancy = new Map<string, number>();
  for (const crew of Object.values(next.crew)) {
    if (crew.incapacitated) continue;
    occupancy.set(crew.roomId, (occupancy.get(crew.roomId) ?? 0) + 1);
  }

  for (const room of Object.values(next.ship.rooms)) {
    const thinAir = next.slopEffectId === "thin-air";
    if (room.breached) {
      room.oxygen = Math.max(0, room.oxygen - (thinAir ? 4 : 3));
    } else {
      const crewCount = occupancy.get(room.id) ?? 0;
      if (crewCount > 0) room.oxygen = Math.max(0, room.oxygen - crewCount * OXY_DRAIN_PER_CREW);
    }
    const roomFireCount = Object.values(next.ship.fires).filter((fire) => fire.roomId === room.id).length;
    if (roomFireCount > 0) {
      room.oxygen = Math.max(0, room.oxygen - FIRE_OXY_DRAIN_PER_TOKEN * roomFireCount);
      room.integrity = Math.max(0, room.integrity - FIRE_INTEGRITY_DAMAGE_PER_TOKEN * roomFireCount);
    }
  }
  normalizeSystemPower(next.ship);

  const oxygenSystem = next.ship.systems.oxygen;
  const oxygenRoom = next.ship.rooms[oxygenSystem.roomId];
  if (oxygenRoom && oxygenSystem.health > 0 && oxygenSystem.power > 0 && oxygenSystem.operatorCrewId) {
    const thinAir = next.slopEffectId === "thin-air";
    oxygenRoom.oxygen = Math.min(100, oxygenRoom.oxygen + (thinAir ? 1 : OXY_PRODUCE_PER_TICK));
    // Life support vents the whole ship, not just its own room; breached and
    // destroyed rooms can't hold the air so they're excluded.
    if (!thinAir) {
      for (const room of Object.values(next.ship.rooms)) {
        if (room.id === oxygenRoom.id || room.breached || room.destroyed) continue;
        room.oxygen = Math.min(100, room.oxygen + OXY_SHIPWIDE_PRODUCE_PER_TICK);
      }
    }
  }

  for (const door of Object.values(next.ship.doors)) {
    if (door.kind !== "interior" || door.state !== "open" || !door.roomB) continue;
    const roomA = next.ship.rooms[door.roomA];
    const roomB = next.ship.rooms[door.roomB];
    if (!roomA || !roomB) continue;
    const diff = roomA.oxygen - roomB.oxygen;
    if (Math.abs(diff) < 1) continue;
    const flow = Math.sign(diff) * Math.min(OXY_EQUALIZE_RATE, Math.abs(diff));
    roomA.oxygen = Math.max(0, Math.min(100, roomA.oxygen - flow));
    roomB.oxygen = Math.max(0, Math.min(100, roomB.oxygen + flow));
  }

  for (const room of Object.values(next.ship.rooms)) {
    if (room.destroyed || room.integrity > 0) continue;
    room.destroyed = true;
    room.breached = true;
    for (const system of Object.values(next.ship.systems)) {
      if (system.roomId === room.id) system.health = 0;
    }
    for (const door of Object.values(next.ship.doors)) {
      if (door.roomA === room.id || door.roomB === room.id) door.state = "locked";
    }
  }
  normalizeSystemPower(next.ship);

  for (const [id, fire] of Object.entries(next.ship.fires)) {
    if ((next.ship.rooms[fire.roomId]?.oxygen ?? 0) <= 0) delete next.ship.fires[id];
  }

  for (const fire of Object.values(next.ship.fires)) {
    if (rng() >= FIRE_SPREAD_CHANCE) continue;
    const side = SPREAD_SIDES[Math.floor(rng() * SPREAD_SIDES.length)]!;
    const delta = SIDE_DELTA[side];
    const nx = fire.x + delta.dx;
    const ny = fire.y + delta.dy;
    const neighborRoomId = roomAtDeckPosition(next.ship.layoutId, nx, ny);
    if (!neighborRoomId) continue;
    if (neighborRoomId !== fire.roomId) {
      const door = interiorDoorAt(next.ship.doors, fire.x, fire.y, side);
      if (!door || door.state !== "open") continue;
    }
    const alreadyBurning = Object.values(next.ship.fires).some(
      (candidate) => candidate.roomId === neighborRoomId && candidate.x === nx && candidate.y === ny,
    );
    if (alreadyBurning) continue;
    const id = `fire-${neighborRoomId}-${nx}-${ny}-${next.tick}`;
    next.ship.fires[id] = { id, roomId: neighborRoomId, x: nx, y: ny, size: "small", ageTicks: 0, stepsDone: 0, channelTicks: 0 };
  }

  for (const fire of Object.values(next.ship.fires)) {
    const channeler = Object.values(next.crew).find(
      (candidate) => candidate.extinguishingFireId === fire.id && !candidate.incapacitated,
    );
    const stillChanneling = channeler
      && channeler.roomId === fire.roomId
      && Math.max(Math.abs(fire.x - channeler.deckX), Math.abs(fire.y - channeler.deckY)) <= 1;
    if (stillChanneling) {
      fire.channelTicks += 1;
    } else {
      fire.stepsDone = 0;
      fire.channelTicks = 0;
      fire.ageTicks = (fire.ageTicks ?? 0) + 1;
      if (fire.ageTicks >= FIRE_GROW_TICKS.large) fire.size = "large";
      else if (fire.ageTicks >= FIRE_GROW_TICKS.medium) fire.size = "medium";
    }
  }
  for (const [id, fire] of Object.entries(next.ship.fires)) {
    if (fire.channelTicks >= FIRE_EXTINGUISH_TICKS[fireSize(fire)]) delete next.ship.fires[id];
  }

  for (const crewId of Object.keys(next.crew)) {
    const crew = next.crew[crewId];
    if (!crew?.interaction || crew.interaction.ticksDone < crew.interaction.totalTicks) continue;
    const command = crew.pendingCommand;
    const kind = crew.interaction.kind;
    crew.interaction = undefined;
    crew.pendingCommand = undefined;
    crew.extinguishingFireId = undefined;
    // Firefighting resolves through its existing three-step fire token channel.
    if (kind === "extinguish" || !command) continue;
    try {
      next = applyShipCommand(next, command, true);
    } catch {
      // A target can disappear or a crew member can be incapacitated while the
      // bar is filling. The authoritative action is then cancelled safely.
    }
  }

  for (const crew of Object.values(next.crew)) {
    crew.abilityCooldownTicks = Math.max(0, crew.abilityCooldownTicks - 1);
    if (crew.incapacitated) {
      crew.bleedoutTicks = Math.max(0, crew.bleedoutTicks - 1);
      continue;
    }
    const room = next.ship.rooms[crew.roomId];
    const damage = (room?.oxygen ?? 0) <= 10 ? 4 : 0;
    const roomFireCount = room ? Object.values(next.ship.fires).filter((fire) => fire.roomId === room.id).length : 0;
    const fireDamage = roomFireCount * FIRE_CREW_DAMAGE_PER_TOKEN;
    crew.health = Math.max(0, crew.health - damage - fireDamage);
    if (crew.health === 0) {
      crew.incapacitated = true;
      crew.bleedoutTicks = 40;
      for (const system of Object.values(next.ship.systems)) {
        if (system.operatorCrewId === crew.id) system.operatorCrewId = undefined;
      }
    }
  }

  const playerWeapons = next.ship.systems.weapons;
  const weaponOperator = playerWeapons.operatorCrewId ? next.crew[playerWeapons.operatorCrewId] : undefined;
  const autoTurret = next.installedUpgrades.includes("auto-turret") && !weaponOperator;
  // A volley that finished charging last tick is still visible as "ready" this tick
  // (so the crew sees and hears it) before auto-fire claims it below.
  const weaponWasReady = next.ship.weaponChargeMaxTicks > 0 && next.ship.weaponChargeTicks >= next.ship.weaponChargeMaxTicks;
  if (playerWeapons.health > 0 && playerWeapons.power > 0 && (weaponOperator || autoTurret)) {
    const chargeRate = weaponOperator?.role === "gunner" ? 2 : 1;
    next.ship.weaponChargeTicks = Math.min(next.ship.weaponChargeMaxTicks, next.ship.weaponChargeTicks + chargeRate);
  } else {
    next.ship.weaponChargeTicks = 0;
  }

  const enemy = next.enemy;
  if (enemy) {
    if (next.tick === 20 && Object.keys(next.boarders).length === 0) {
      next.boarders.b0 = { id: "b0", roomId: "oxygen", health: 75, targetRoomId: "engineering" };
    }
    if (weaponWasReady && (weaponOperator || autoTurret)) {
      resolvePlayerVolley(next, { rng, manned: !!weaponOperator });
      if (next.slopEffectId === "volatile-weapons" && rng() < 0.2) igniteRandomTile(next.ship, "weapons", rng, next.tick);
    }

    enemy.weaponChargeTicks += 1;
    if (enemy.weaponChargeTicks >= enemy.weaponChargeMaxTicks) {
      enemy.weaponChargeTicks = 0;
      if (next.ship.shields > 0) {
        next.ship.shields -= 1;
      } else {
        next.ship.hull = Math.max(0, next.ship.hull - 4);
        const systemIds = Object.keys(next.ship.systems) as SystemId[];
        const systemId = systemIds[Math.min(systemIds.length - 1, Math.floor(rng() * systemIds.length))];
        const system = systemId ? next.ship.systems[systemId] : undefined;
        if (system) {
          system.health = Math.max(0, system.health - 1);
          const room = next.ship.rooms[system.roomId];
          if (room) {
            room.integrity = Math.max(0, room.integrity - HIT_INTEGRITY_DAMAGE);
            // Scripted first-hit salvo: the enemy's opening hull hit lands while the
            // player's own volley is still charging, forcing a fire-and-breach choice
            // instead of the usual single random hazard.
            const weaponsCharging = next.ship.weaponChargeTicks < next.ship.weaponChargeMaxTicks;
            if (!enemy.scriptedVolleyUsed && weaponsCharging) {
              enemy.scriptedVolleyUsed = true;
              igniteRandomTile(next.ship, room.id, rng, next.tick);
              room.breached = true;
            } else if (rng() < 0.45) {
              igniteRandomTile(next.ship, room.id, rng, next.tick);
            } else {
              room.breached = true;
            }
          }
        }
      }
    }

    normalizeSystemPower(next.ship);

    const shields = next.ship.systems.shields;
    if (shields.health > 0 && shields.power > 0 && shields.operatorCrewId && next.tick % 16 === 0) {
      next.ship.shields = Math.min(next.ship.maxShields, next.ship.shields + 1);
    }
    if (enemy.hull === 0) {
      next.status = "victory";
      next.objectiveText = "Scrap Raider disabled";
    }
  }

  for (const boarder of Object.values(next.boarders)) {
    const crewHere = Object.values(next.crew).find((crew) => crew.roomId === boarder.roomId && !crew.incapacitated);
    if (crewHere && next.tick % 4 === 0) {
      crewHere.health = Math.max(0, crewHere.health - 8);
      if (crewHere.health === 0) {
        crewHere.incapacitated = true;
        crewHere.bleedoutTicks = 40;
      }
      continue;
    }
    const systemHere = Object.values(next.ship.systems).find((system) => system.roomId === boarder.roomId && system.health > 0);
    if (systemHere && next.tick % 4 === 0) {
      systemHere.health = Math.max(0, systemHere.health - 1);
      normalizeSystemPower(next.ship);
      continue;
    }
    const boarderMoveCadence = next.installedUpgrades.includes("blast-doors") ? 8 : 4;
    if (next.tick % boarderMoveCadence === 0) {
      const targetRoom = boarder.targetRoomId ?? "engineering";
      const path = shortestRoomPath(next.ship, boarder.roomId, targetRoom);
      const nextRoom = path[1];
      if (nextRoom) boarder.roomId = nextRoom;
    }
  }

  if (next.installedUpgrades.includes("medbay-foam") && next.tick % 4 === 0) {
    const medbay = next.ship.rooms.medbay;
    if (medbay) extinguishOneToken(next.ship, medbay.id);
    for (const crew of Object.values(next.crew).filter((member) => member.roomId === "medbay" && !member.incapacitated)) {
      crew.health = Math.min(crew.maxHealth, crew.health + 3);
    }
  }

  if (next.slopEffectId === "hot-reactor-summer" && next.tick % 20 === 0 && rng() < 0.35) {
    igniteRandomTile(next.ship, "engineering", rng, next.tick);
  }

  if (next.ship.hull <= 0 || Object.values(next.crew).every((crew) => crew.incapacitated && crew.bleedoutTicks === 0)) {
    next.status = "defeat";
  }
  return next;
}
