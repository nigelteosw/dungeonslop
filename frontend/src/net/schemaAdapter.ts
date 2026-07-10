export type CrewRole = 'pilot' | 'engineer' | 'gunner' | 'medic';
export type SystemId = 'helm' | 'reactor' | 'weapons' | 'shields' | 'oxygen';
export type WeaponTarget = 'shields' | 'weapons' | 'helm' | 'core';

export interface LobbyPlayerLike {
  sessionId: string;
  name: string;
  role: CrewRole;
  ready: boolean;
  host: boolean;
}

export interface CrewView {
  id: string;
  ownerId: string;
  name: string;
  role: CrewRole;
  roomId: string;
  deckX: number;
  deckY: number;
  health: number;
  maxHealth: number;
  incapacitated: boolean;
  bleedoutTicks: number;
  abilityCooldownTicks: number;
  interactionKind: string;
  interactionTicks: number;
  interactionTotalTicks: number;
}

export interface ShipRoomView {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  oxygen: number;
  breached: boolean;
  integrity: number;
  maxIntegrity: number;
  destroyed: boolean;
}

export type DoorSide = 'n' | 's' | 'e' | 'w';
export type DoorKind = 'interior' | 'hull';
export type DoorState = 'open' | 'closed' | 'locked';

export interface ShipDoorView {
  id: string;
  x: number;
  y: number;
  side: DoorSide;
  kind: DoorKind;
  state: DoorState;
  roomA: string;
  roomB?: string;
}

export interface FireView {
  id: string;
  roomId: string;
  x: number;
  y: number;
  size: 'small' | 'medium' | 'large';
  ageTicks: number;
  stepsDone: number;
  channelTicks: number;
}
export interface BoarderView { id: string; roomId: string; health: number; targetRoomId: string; }
export interface ShipSystemView {
  id: SystemId;
  roomId: string;
  health: number;
  maxHealth: number;
  power: number;
  maxPower: number;
  operatorCrewId: string;
}

interface MapLike<T> { forEach(cb: (value: T, id: string) => void): void; }

export interface DungeonStateLike {
  status: string;
  players: Iterable<LobbyPlayerLike>;
  crew: MapLike<CrewView>;
  shipRooms: MapLike<ShipRoomView>;
  shipDoors: MapLike<ShipDoorView>;
  shipSystems: MapLike<ShipSystemView>;
  boarders: MapLike<BoarderView>;
  fires: MapLike<FireView>;
  tick: number;
  sectorIndex: number;
  nodeIndex: number;
  captainSeat: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  scrap: number;
  reactorCapacity: number;
  weaponChargeTicks: number;
  weaponChargeMaxTicks: number;
  weaponTarget: WeaponTarget;
  shipLayoutId: string;
  objectiveText: string;
  enemyHull: number;
  enemyMaxHull: number;
  enemyShields: number;
  enemyWeaponChargeTicks: number;
  enemyWeaponChargeMaxTicks: number;
  slopEffectId: string;
  voteKind: string;
  voteOptions: Iterable<string>;
  votes: MapLike<string>;
  voteDeadlineTick: number;
  installedUpgrades: Iterable<string>;
}

export interface ShipViewState {
  status: string;
  tick: number;
  sectorIndex: number;
  nodeIndex: number;
  captainSeat: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  scrap: number;
  reactorCapacity: number;
  weaponChargeTicks: number;
  weaponChargeMaxTicks: number;
  weaponTarget: WeaponTarget;
  shipLayoutId: string;
  objectiveText: string;
  enemyHull: number;
  enemyMaxHull: number;
  enemyShields: number;
  enemyWeaponChargeTicks: number;
  enemyWeaponChargeMaxTicks: number;
  slopEffectId: string;
  voteKind: string;
  voteOptions: string[];
  votes: Record<string, string>;
  voteDeadlineTick: number;
  installedUpgrades: string[];
  crew: Record<string, CrewView>;
  rooms: Record<string, ShipRoomView>;
  doors: Record<string, ShipDoorView>;
  systems: Record<string, ShipSystemView>;
  boarders: Record<string, BoarderView>;
  fires: Record<string, FireView>;
}

export function toShipViewState(state: DungeonStateLike): ShipViewState {
  const crew: Record<string, CrewView> = {};
  const rooms: Record<string, ShipRoomView> = {};
  const doors: Record<string, ShipDoorView> = {};
  const systems: Record<string, ShipSystemView> = {};
  const boarders: Record<string, BoarderView> = {};
  const fires: Record<string, FireView> = {};
  const votes: Record<string, string> = {};
  state.crew.forEach((member, id) => { crew[id] = { ...member }; });
  state.shipRooms.forEach((room, id) => { rooms[id] = { ...room }; });
  state.shipDoors.forEach((door, id) => {
    doors[id] = { ...door, roomB: door.roomB || undefined };
  });
  state.shipSystems.forEach((system, id) => { systems[id] = { ...system }; });
  state.boarders.forEach((boarder, id) => { boarders[id] = { ...boarder }; });
  state.fires.forEach((fire, id) => { fires[id] = { ...fire, size: fire.size ?? 'small', ageTicks: fire.ageTicks ?? 0 }; });
  state.votes.forEach((option, ownerId) => { votes[ownerId] = option; });
  return {
    status: state.status,
    tick: state.tick,
    sectorIndex: state.sectorIndex,
    nodeIndex: state.nodeIndex,
    captainSeat: state.captainSeat,
    hull: state.hull,
    maxHull: state.maxHull,
    shields: state.shields,
    maxShields: state.maxShields,
    scrap: state.scrap,
    reactorCapacity: state.reactorCapacity,
    weaponChargeTicks: state.weaponChargeTicks,
    weaponChargeMaxTicks: state.weaponChargeMaxTicks,
    weaponTarget: state.weaponTarget,
    shipLayoutId: state.shipLayoutId,
    objectiveText: state.objectiveText,
    enemyHull: state.enemyHull,
    enemyMaxHull: state.enemyMaxHull,
    enemyShields: state.enemyShields,
    enemyWeaponChargeTicks: state.enemyWeaponChargeTicks,
    enemyWeaponChargeMaxTicks: state.enemyWeaponChargeMaxTicks,
    slopEffectId: state.slopEffectId,
    voteKind: state.voteKind,
    voteOptions: Array.from(state.voteOptions),
    votes,
    voteDeadlineTick: state.voteDeadlineTick,
    installedUpgrades: Array.from(state.installedUpgrades),
    crew,
    rooms,
    doors,
    systems,
    boarders,
    fires,
  };
}

export function toLobbyPlayers(state: DungeonStateLike): LobbyPlayerLike[] {
  return Array.from(state.players).map((player) => ({ ...player }));
}
