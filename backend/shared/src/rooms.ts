import type { Board, GameState, Pos, RoomModifiers, Unit } from "./types";
import { HAND_SIZE } from "./types";
import { CLASSES } from "./content/classes";
import { MONSTERS } from "./content/monsters";
import { shuffle, type Rng } from "./rng";

function board(): Board {
  const walls: Pos[] = [
    { x: 6, y: 6 },
    { x: 7, y: 6 },
    { x: 8, y: 6 },
    { x: 9, y: 6 },
    { x: 6, y: 9 },
    { x: 7, y: 9 },
    { x: 8, y: 9 },
    { x: 9, y: 9 },
    { x: 3, y: 11 },
    { x: 4, y: 11 },
    { x: 11, y: 4 },
    { x: 11, y: 5 },
  ];
  return { width: 16, height: 16, walls, exit: { x: 15, y: 15 } };
}

const ROOM_MONSTERS: Record<number, { defId: string; pos: Pos }[]> = {
  0: [
    { defId: "goblin", pos: { x: 13, y: 2 } },
    { defId: "slime", pos: { x: 13, y: 13 } },
  ],
  1: [
    { defId: "skeleton", pos: { x: 12, y: 3 } },
    { defId: "cultist", pos: { x: 12, y: 12 } },
    { defId: "slime", pos: { x: 9, y: 14 } },
  ],
  2: [
    { defId: "dragon", pos: { x: 12, y: 8 } },
    { defId: "cultist", pos: { x: 10, y: 5 } },
  ],
};

const PLAYER_SPAWNS: readonly Pos[] = [
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 3, y: 1 },
  { x: 3, y: 3 },
] as const;

export function roomMonsterSeeds(roomIndex: number): { defId: string; pos: Pos }[] {
  return ROOM_MONSTERS[roomIndex] ?? ROOM_MONSTERS[2] ?? [];
}

function withModifier(value: number, delta: number | undefined, min: number): number {
  return Math.max(min, value + (delta ?? 0));
}

export function createRoom(
  roomIndex: number,
  playerSeed: { name: string; classId: string }[],
  rng: Rng,
  modifiers?: RoomModifiers,
): GameState {
  if (playerSeed.length < 1 || playerSeed.length > 4) throw new Error("rooms require 1-4 players");

  const units: Record<string, Unit> = {};
  const order: string[] = [];

  playerSeed.forEach((p, i) => {
    const def = CLASSES[p.classId];
    const spawn = PLAYER_SPAWNS[i];
    if (!def) throw new Error(`unknown class: ${p.classId}`);
    if (!spawn) throw new Error("missing player spawn");

    const id = `p${i}`;
    order.push(id);
    const deck = shuffle(def.startingDeck, rng);
    const hand = deck.splice(0, HAND_SIZE);
    const maxEnergy = withModifier(def.maxEnergy, modifiers?.energyDelta, 1);
    units[id] = {
      id,
      team: "player",
      name: p.name,
      defId: def.id,
      pos: { ...spawn },
      hp: def.maxHp,
      maxHp: def.maxHp,
      moveRange: def.moveRange,
      attack: def.attack,
      energy: maxEnergy,
      maxEnergy,
      block: 0,
      hasMoved: false,
      deck,
      hand,
      discard: [],
      inventory: [],
      equipment: {},
    };
  });

  roomMonsterSeeds(roomIndex).forEach((m, i) => {
    const def = MONSTERS[m.defId];
    if (!def) throw new Error(`unknown monster: ${m.defId}`);
    const id = `m${i}`;
    const maxHp = withModifier(def.maxHp, modifiers?.monsterHpDelta, 1);
    units[id] = {
      id,
      team: "monster",
      name: def.name,
      defId: def.id,
      pos: { ...m.pos },
      hp: maxHp,
      maxHp,
      moveRange: def.moveRange,
      attack: def.attack,
      energy: 0,
      maxEnergy: 0,
      block: 0,
      hasMoved: false,
      deck: [],
      hand: [],
      discard: [],
    };
  });

  return {
    board: board(),
    units,
    order,
    activeIndex: 0,
    phase: "player",
    roomIndex,
    ...(modifiers ? { modifiers } : {}),
  };
}
