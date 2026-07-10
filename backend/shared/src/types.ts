export type RunStatus =
  | "lobby"
  | "mapVote"
  | "eventVote"
  | "encounter"
  | "upgradeVote"
  | "layoutVote"
  | "victory"
  | "defeat";

export type CrewRole = "pilot" | "engineer" | "gunner" | "medic";
export type SystemId = "helm" | "reactor" | "weapons" | "shields" | "oxygen";

export type DoorState = "open" | "closed" | "locked";
export type DoorSide = "n" | "s" | "e" | "w";
export type DoorKind = "interior" | "hull";

export interface ShipDoor {
  id: string;
  x: number;
  y: number;
  side: DoorSide;
  kind: DoorKind;
  state: DoorState;
  roomA: string;
  roomB?: string;
}

export interface ShipSystemState {
  id: SystemId;
  roomId: string;
  health: number;
  maxHealth: number;
  power: number;
  maxPower: number;
  operatorCrewId?: string;
}

export interface ShipRoomState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  oxygen: number;
  fire: number;
  breached: boolean;
}

export interface ShipState {
  layoutId: string;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  scrap: number;
  reactorCapacity: number;
  rooms: Record<string, ShipRoomState>;
  doors: Record<string, ShipDoor>;
  systems: Record<SystemId, ShipSystemState>;
}

export interface CrewState {
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
  carryingItemId?: string;
}

export interface BoarderState {
  id: string;
  roomId: string;
  health: number;
  targetRoomId?: string;
}

export interface EnemyState {
  id: string;
  hull: number;
  maxHull: number;
  shields: number;
  weaponChargeTicks: number;
  weaponChargeMaxTicks: number;
}

export interface VoteState {
  kind: "map" | "event" | "upgrade" | "layout";
  options: string[];
  votes: Record<string, string>;
  deadlineTick: number;
}

export interface RunState {
  seed: string;
  status: RunStatus;
  tick: number;
  sectorIndex: number;
  nodeIndex: number;
  currentNodeId?: string;
  captainSeat: number;
  ship: ShipState;
  crew: Record<string, CrewState>;
  boarders: Record<string, BoarderState>;
  enemy?: EnemyState;
  vote?: VoteState;
  objectiveText?: string;
  slopEffectId?: string;
  installedUpgrades: string[];
}

export type ShipCommand =
  | { kind: "move"; crewId: string; roomId: string }
  | { kind: "moveVector"; crewId: string; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  | { kind: "operate"; crewId: string; systemId: SystemId }
  | { kind: "repair"; crewId: string; systemId: SystemId }
  | { kind: "setDoorState"; crewId: string; doorId: string; state: DoorState }
  | { kind: "extinguish"; crewId: string }
  | { kind: "sealBreach"; crewId: string }
  | { kind: "attackBoarder"; crewId: string; boarderId: string }
  | { kind: "useAbility"; crewId: string }
  | { kind: "revive"; crewId: string; targetCrewId: string };
