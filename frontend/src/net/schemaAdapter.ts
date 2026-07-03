import type { GameState, Phase, Team, Unit } from '../engine';

// Minimal structural shape of what we read off the Colyseus-synced
// DungeonState (see backend/server/src/schema.ts). This is the network
// boundary: colyseus.js decodes schema instances without needing the
// server's exact classes, so we type only the fields/iteration we use
// rather than importing the backend's schema module.
interface PosLike { x: number; y: number; }
interface EquipmentLike { weapon: string; armor: string; trinket: string; }
interface UnitLike {
  id: string; team: string; name: string; defId: string; pos: PosLike;
  hp: number; maxHp: number; moveRange: number; attack: number;
  energy: number; maxEnergy: number; block: number; hasMoved: boolean;
  deck: Iterable<string>; hand: Iterable<string>; discard: Iterable<string>;
  inventory: Iterable<string>;
  equipment: EquipmentLike;
}
interface BoardLike { width: number; height: number; walls: Iterable<PosLike>; exit: PosLike; }
export interface LobbyPlayerLike { sessionId: string; name: string; classId: string; ready: boolean; host: boolean; }
export interface DungeonStateLike {
  phase: string;
  players: Iterable<LobbyPlayerLike>;
  board: BoardLike;
  units: { forEach(cb: (u: UnitLike, id: string) => void): void };
  order: Iterable<string>;
  activeIndex: number;
  roomIndex: number;
  currentSlopCardId: string;
  rewardOptions: Iterable<string>;
}

function toUnit(u: UnitLike): Unit {
  return {
    id: u.id,
    team: u.team as Team,
    name: u.name,
    defId: u.defId,
    pos: { x: u.pos.x, y: u.pos.y },
    hp: u.hp,
    maxHp: u.maxHp,
    moveRange: u.moveRange,
    attack: u.attack,
    energy: u.energy,
    maxEnergy: u.maxEnergy,
    block: u.block,
    hasMoved: u.hasMoved,
    deck: Array.from(u.deck),
    hand: Array.from(u.hand),
    discard: Array.from(u.discard),
    inventory: Array.from(u.inventory),
    equipment: {
      weapon: u.equipment.weapon || undefined,
      armor: u.equipment.armor || undefined,
      trinket: u.equipment.trinket || undefined,
    },
  };
}

export function toGameState(s: DungeonStateLike): GameState {
  const units: Record<string, Unit> = {};
  s.units.forEach((u, id) => { units[id] = toUnit(u); });
  return {
    board: {
      width: s.board.width,
      height: s.board.height,
      walls: Array.from(s.board.walls).map((w) => ({ x: w.x, y: w.y })),
      exit: { x: s.board.exit.x, y: s.board.exit.y },
    },
    units,
    order: Array.from(s.order),
    activeIndex: s.activeIndex,
    phase: s.phase as Phase,
    roomIndex: s.roomIndex,
  };
}

export function toLobbyPlayers(s: DungeonStateLike): LobbyPlayerLike[] {
  return Array.from(s.players);
}
