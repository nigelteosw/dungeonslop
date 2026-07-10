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
  room.fire = 0;
  for (const crew of Object.values(next.crew)) {
    if (crew.roomId === roomId) delete next.crew[crew.id];
  }
}

export function createShip(layoutId = "balanced"): ShipState {
  const layout = SHIP_LAYOUTS[layoutId];
  if (!layout) throw new Error("unknown ship layout");
  const rooms = Object.fromEntries(SHIP_ROOM_IDS.map((id) => {
    const bounds = layout.rooms[id];
    if (!bounds) throw new Error(`room ${id} missing from ship layout`);
    return [id, { id, ...bounds, oxygen: 100, fire: 0, breached: false }];
  }));
  const doors = buildDoors(layoutId, layout, rooms);
  const systems = Object.fromEntries(
    (Object.entries(SYSTEM_ROOMS) as [SystemId, string][]).map(([id, roomId]) => [
      id,
      { id, roomId, health: 4, maxHealth: 4, power: id === "reactor" ? 0 : 1, maxPower: id === "reactor" ? 0 : 3 },
    ]),
  ) as ShipState["systems"];
  return { layoutId, hull: 50, maxHull: 50, shields: 2, maxShields: 3, scrap: 0, reactorCapacity: 5, rooms, doors, systems };
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

export function applyShipCommand(state: RunState, command: ShipCommand): RunState {
  if (state.status !== "encounter") throw new Error("ship commands require an active encounter");
  const next = structuredClone(state);
  const crew = activeCrew(next, command.crewId);

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
    if (destinationRoom !== crew.roomId && !adjacentRooms(next.ship, crew.roomId).includes(destinationRoom)) throw new Error("no open door in that direction");
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
    room.fire = Math.max(0, room.fire - 1);
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
      room.fire = Math.max(0, room.fire - 1);
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

  const target = next.crew[command.targetCrewId];
  if (!target || target.roomId !== crew.roomId || !target.incapacitated) throw new Error("invalid revive target");
  target.incapacitated = false;
  target.health = crew.role === "medic" ? 40 : 20;
  target.bleedoutTicks = 0;
  return next;
}

export function stepShipSimulation(state: RunState, rng: Rng): RunState {
  if (state.status !== "encounter") return structuredClone(state);
  const next = structuredClone(state);
  next.tick += 1;

  for (const room of Object.values(next.ship.rooms)) {
    const thinAir = next.slopEffectId === "thin-air";
    if (room.breached) room.oxygen = Math.max(0, room.oxygen - (thinAir ? 4 : 3));
    else if (next.ship.systems.oxygen.health > 0 && next.ship.systems.oxygen.power > 0) room.oxygen = Math.min(100, room.oxygen + (thinAir ? 1 : 2));
    if (room.fire > 0) {
      room.oxygen = Math.max(0, room.oxygen - room.fire);
      if (rng() < 0.0125) {
        const targetId = adjacentRooms(next.ship, room.id).find((id) => next.ship.rooms[id]?.fire === 0);
        if (targetId && next.ship.rooms[targetId]) next.ship.rooms[targetId].fire = 1;
      }
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
    const fireDamage = (room?.fire ?? 0) * 2;
    crew.health = Math.max(0, crew.health - damage - fireDamage);
    if (crew.health === 0) {
      crew.incapacitated = true;
      crew.bleedoutTicks = 40;
      for (const system of Object.values(next.ship.systems)) {
        if (system.operatorCrewId === crew.id) system.operatorCrewId = undefined;
      }
    }
  }

  const enemy = next.enemy;
  if (enemy) {
    if (next.tick === 20 && Object.keys(next.boarders).length === 0) {
      next.boarders.b0 = { id: "b0", roomId: "oxygen", health: 75, targetRoomId: "engineering" };
    }
    const weapons = next.ship.systems.weapons;
    const weaponCadence = weapons.operatorCrewId ? 8 : next.installedUpgrades.includes("auto-turret") ? 12 : 0;
    if (weapons.health > 0 && weapons.power > 0 && weaponCadence > 0 && next.tick % weaponCadence === 0) {
      if (enemy.shields > 0) enemy.shields -= 1;
      else enemy.hull = Math.max(0, enemy.hull - (next.slopEffectId === "volatile-weapons" ? 3 : 2));
      if (next.slopEffectId === "volatile-weapons" && rng() < 0.2) next.ship.rooms.weapons!.fire = 1;
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
            if (rng() < 0.45) room.fire = Math.max(1, room.fire);
            else room.breached = true;
          }
        }
      }
    }

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
    if (medbay) medbay.fire = Math.max(0, medbay.fire - 1);
    for (const crew of Object.values(next.crew).filter((member) => member.roomId === "medbay" && !member.incapacitated)) {
      crew.health = Math.min(crew.maxHealth, crew.health + 3);
    }
  }

  if (next.slopEffectId === "hot-reactor-summer" && next.tick % 20 === 0 && rng() < 0.35) {
    next.ship.rooms.engineering!.fire = Math.max(1, next.ship.rooms.engineering!.fire);
  }

  if (next.ship.hull <= 0 || Object.values(next.crew).every((crew) => crew.incapacitated && crew.bleedoutTicks === 0)) {
    next.status = "defeat";
  }
  return next;
}
