export type CrewRole = 'pilot' | 'engineer' | 'gunner' | 'medic';
export type SystemId = 'helm' | 'reactor' | 'weapons' | 'shields' | 'oxygen';

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
}

export interface ShipRoomView { id: string; x: number; y: number; w: number; h: number; oxygen: number; fire: number; breached: boolean; }
export interface ShipDoorView { id: string; a: string; b: string; open: boolean; locked: boolean; }
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
}

export function toShipViewState(state: DungeonStateLike): ShipViewState {
  const crew: Record<string, CrewView> = {};
  const rooms: Record<string, ShipRoomView> = {};
  const doors: Record<string, ShipDoorView> = {};
  const systems: Record<string, ShipSystemView> = {};
  const boarders: Record<string, BoarderView> = {};
  const votes: Record<string, string> = {};
  state.crew.forEach((member, id) => { crew[id] = { ...member }; });
  state.shipRooms.forEach((room, id) => { rooms[id] = { ...room }; });
  state.shipDoors.forEach((door, id) => { doors[id] = { ...door }; });
  state.shipSystems.forEach((system, id) => { systems[id] = { ...system }; });
  state.boarders.forEach((boarder, id) => { boarders[id] = { ...boarder }; });
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
  };
}

export function toLobbyPlayers(state: DungeonStateLike): LobbyPlayerLike[] {
  return Array.from(state.players).map((player) => ({ ...player }));
}
