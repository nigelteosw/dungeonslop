export interface Pos {
  x: number;
  y: number;
}

export type Team = "player" | "monster";

export interface EquipmentSlots {
  weapon?: string;
  armor?: string;
  trinket?: string;
}

export interface Unit {
  id: string;
  team: Team;
  name: string;
  defId: string;
  pos: Pos;
  hp: number;
  maxHp: number;
  moveRange: number;
  attack: number;
  energy: number;
  maxEnergy: number;
  block: number;
  hasMoved: boolean;
  deck: string[];
  hand: string[];
  discard: string[];
  inventory?: string[];
  equipment?: EquipmentSlots;
}

export interface Board {
  width: number;
  height: number;
  walls: Pos[];
  exit: Pos;
}

export type Phase =
  | "lobby"
  | "player"
  | "monster"
  | "slop"
  | "reward"
  | "roomClear"
  | "defeat";

export interface RoomModifiers {
  moveRangeDelta?: number;
  monsterHpDelta?: number;
  energyDelta?: number;
  losRangeDelta?: number;
}

export interface GameState {
  board: Board;
  units: Record<string, Unit>;
  order: string[];
  activeIndex: number;
  phase: Phase;
  roomIndex: number;
  modifiers?: RoomModifiers;
}

export const HAND_SIZE = 5;

export type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

export const ORTHO: readonly Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;
