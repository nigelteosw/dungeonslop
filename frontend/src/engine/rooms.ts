import { Board, GameState, Unit, Pos, HAND_SIZE } from './types';
import { CLASSES } from './content/classes';
import { MONSTERS } from './content/monsters';
import { shuffle } from './rng';

function board(): Board {
  const walls: Pos[] = [
    { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 },
    { x: 6, y: 9 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 },
  ];
  return { width: 16, height: 16, walls, exit: { x: 15, y: 15 } };
}

const ROOM_MONSTERS: Record<number, { defId: string; pos: Pos }[]> = {
  0: [{ defId: 'goblin', pos: { x: 13, y: 2 } }, { defId: 'goblin', pos: { x: 13, y: 13 } }],
};

export function createRoom(
  roomIndex: number,
  playerSeed: { name: string; classId: string }[],
  rng: () => number,
): GameState {
  const units: Record<string, Unit> = {};
  const order: string[] = [];

  playerSeed.forEach((p, i) => {
    const def = CLASSES[p.classId]!;
    const id = `p${i}`;
    order.push(id);
    const deck = shuffle(def.startingDeck, rng);
    const hand = deck.splice(0, HAND_SIZE);
    units[id] = {
      id, team: 'player', name: p.name, defId: def.id, pos: { x: 1, y: 1 + i * 2 },
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack,
      energy: def.maxEnergy, maxEnergy: def.maxEnergy, block: 0, hasMoved: false,
      deck, hand, discard: [], inventory: [], equipment: {},
    };
  });

  (ROOM_MONSTERS[roomIndex] ?? []).forEach((m, i) => {
    const def = MONSTERS[m.defId]!;
    units[`m${i}`] = {
      id: `m${i}`, team: 'monster', name: def.name, defId: def.id, pos: m.pos,
      hp: def.maxHp, maxHp: def.maxHp, moveRange: def.moveRange, attack: def.attack,
      energy: 0, maxEnergy: 0, block: 0, hasMoved: false, deck: [], hand: [], discard: [],
    };
  });

  return { board: board(), units, order, activeIndex: 0, phase: 'player', roomIndex };
}
