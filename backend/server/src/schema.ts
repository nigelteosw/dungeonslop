import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import type { BoarderState, CrewState, FireToken, RunState, ShipDoor, ShipRoomState, ShipSystemState } from "shared";
import type { LobbyPlayer, SessionSnapshot } from "./session";
import { projectShipSnapshot } from "./snapshot";

export class PlayerSchema extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("string") role = "";
  @type("boolean") ready = false;
  @type("boolean") host = false;

  constructor(player?: LobbyPlayer) {
    super();
    if (player) Object.assign(this, player);
  }
}

export class CrewSchema extends Schema {
  @type("string") id = "";
  @type("string") ownerId = "";
  @type("string") name = "";
  @type("string") role = "";
  @type("string") roomId = "";
  @type("number") deckX = 0;
  @type("number") deckY = 0;
  @type("number") health = 0;
  @type("number") maxHealth = 0;
  @type("boolean") incapacitated = false;
  @type("number") bleedoutTicks = 0;
  @type("number") abilityCooldownTicks = 0;

  constructor(crew?: CrewState) {
    super();
    if (crew) Object.assign(this, crew);
  }
}

export class ShipRoomSchema extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") w = 0;
  @type("number") h = 0;
  @type("number") oxygen = 100;
  @type("boolean") breached = false;
  @type("number") integrity = 0;
  @type("number") maxIntegrity = 0;
  @type("boolean") destroyed = false;

  constructor(room?: ShipRoomState) {
    super();
    if (room) Object.assign(this, room);
  }
}

export class ShipDoorSchema extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") side = "";
  @type("string") kind = "";
  @type("string") state = "";
  @type("string") roomA = "";
  @type("string") roomB = "";

  constructor(door?: ShipDoor) {
    super();
    if (!door) return;
    Object.assign(this, door);
    this.roomB = door.roomB ?? "";
  }
}

export class ShipSystemSchema extends Schema {
  @type("string") id = "";
  @type("string") roomId = "";
  @type("number") health = 0;
  @type("number") maxHealth = 0;
  @type("number") power = 0;
  @type("number") maxPower = 0;
  @type("string") operatorCrewId = "";

  constructor(system?: ShipSystemState) {
    super();
    if (!system) return;
    Object.assign(this, system);
    this.operatorCrewId = system.operatorCrewId ?? "";
  }
}

export class BoarderSchema extends Schema {
  @type("string") id = "";
  @type("string") roomId = "";
  @type("number") health = 0;
  @type("string") targetRoomId = "";

  constructor(boarder?: BoarderState) {
    super();
    if (!boarder) return;
    Object.assign(this, boarder);
    this.targetRoomId = boarder.targetRoomId ?? "";
  }
}

export class FireSchema extends Schema {
  @type("string") id = "";
  @type("string") roomId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") stepsDone = 0;
  @type("number") channelTicks = 0;

  constructor(fire?: FireToken) {
    super();
    if (fire) Object.assign(this, fire);
  }
}

export class DungeonState extends Schema {
  @type("string") status = "lobby";
  @type([PlayerSchema]) players = new ArraySchema<PlayerSchema>();
  @type({ map: CrewSchema }) crew = new MapSchema<CrewSchema>();
  @type({ map: ShipRoomSchema }) shipRooms = new MapSchema<ShipRoomSchema>();
  @type({ map: ShipDoorSchema }) shipDoors = new MapSchema<ShipDoorSchema>();
  @type({ map: ShipSystemSchema }) shipSystems = new MapSchema<ShipSystemSchema>();
  @type({ map: BoarderSchema }) boarders = new MapSchema<BoarderSchema>();
  @type({ map: FireSchema }) fires = new MapSchema<FireSchema>();
  @type("number") tick = 0;
  @type("number") sectorIndex = 0;
  @type("number") nodeIndex = 0;
  @type("number") captainSeat = 0;
  @type("number") hull = 0;
  @type("number") maxHull = 0;
  @type("number") shields = 0;
  @type("number") maxShields = 0;
  @type("number") scrap = 0;
  @type("number") reactorCapacity = 0;
  @type("string") shipLayoutId = "balanced";
  @type("string") objectiveText = "";
  @type("number") enemyHull = 0;
  @type("number") enemyMaxHull = 0;
  @type("number") enemyShields = 0;
  @type("number") enemyWeaponChargeTicks = 0;
  @type("number") enemyWeaponChargeMaxTicks = 0;
  @type("string") slopEffectId = "";
  @type("string") voteKind = "";
  @type(["string"]) voteOptions = new ArraySchema<string>();
  @type({ map: "string" }) votes = new MapSchema<string>();
  @type("number") voteDeadlineTick = 0;
  @type(["string"]) installedUpgrades = new ArraySchema<string>();

  applySnapshot(snapshot: SessionSnapshot): void {
    this.status = snapshot.status;
    this.players.clear();
    this.players.push(...snapshot.players.map((player) => new PlayerSchema(player)));
    this.crew.clear();
    this.shipRooms.clear();
    this.shipDoors.clear();
    this.shipSystems.clear();
    this.boarders.clear();
    this.fires.clear();
    this.voteOptions.clear();
    this.votes.clear();
    this.installedUpgrades.clear();
    if (!snapshot.run) return;
    const run: RunState = snapshot.run;
    const shipSnapshot = projectShipSnapshot(run);
    this.tick = run.tick;
    this.sectorIndex = run.sectorIndex;
    this.nodeIndex = run.nodeIndex;
    this.captainSeat = run.captainSeat;
    this.hull = run.ship.hull;
    this.maxHull = run.ship.maxHull;
    this.shields = run.ship.shields;
    this.maxShields = run.ship.maxShields;
    this.scrap = run.ship.scrap;
    this.reactorCapacity = run.ship.reactorCapacity;
    this.shipLayoutId = run.ship.layoutId;
    this.objectiveText = run.objectiveText ?? "";
    this.enemyHull = run.enemy?.hull ?? 0;
    this.enemyMaxHull = run.enemy?.maxHull ?? 0;
    this.enemyShields = run.enemy?.shields ?? 0;
    this.enemyWeaponChargeTicks = run.enemy?.weaponChargeTicks ?? 0;
    this.enemyWeaponChargeMaxTicks = run.enemy?.weaponChargeMaxTicks ?? 0;
    this.slopEffectId = run.slopEffectId ?? "";
    this.voteKind = run.vote?.kind ?? "";
    this.voteOptions.push(...(run.vote?.options ?? []));
    for (const [ownerId, option] of Object.entries(run.vote?.votes ?? {})) this.votes.set(ownerId, option);
    this.voteDeadlineTick = run.vote?.deadlineTick ?? 0;
    this.installedUpgrades.push(...run.installedUpgrades);
    for (const crew of Object.values(run.crew)) this.crew.set(crew.id, new CrewSchema(crew));
    for (const room of shipSnapshot.rooms) this.shipRooms.set(room.id, new ShipRoomSchema(room));
    for (const door of shipSnapshot.doors) this.shipDoors.set(door.id, new ShipDoorSchema(door));
    for (const system of Object.values(run.ship.systems)) this.shipSystems.set(system.id, new ShipSystemSchema(system));
    for (const boarder of Object.values(run.boarders)) this.boarders.set(boarder.id, new BoarderSchema(boarder));
    for (const fire of Object.values(run.ship.fires)) this.fires.set(fire.id, new FireSchema(fire));
  }
}
