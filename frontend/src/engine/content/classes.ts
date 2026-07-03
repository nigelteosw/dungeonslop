export interface ClassDef { id: string; name: string; maxHp: number; moveRange: number; attack: number; maxEnergy: number; startingDeck: string[]; }

export const CLASSES: Record<string, ClassDef> = {
  knight: {
    id: 'knight', name: 'Knight', maxHp: 14, moveRange: 4, attack: 3, maxEnergy: 3,
    startingDeck: ['slash', 'slash', 'slash', 'block', 'block', 'cleave'],
  },
  wizard: {
    id: 'wizard', name: 'Wizard', maxHp: 9, moveRange: 4, attack: 2, maxEnergy: 3,
    startingDeck: ['firebolt', 'firebolt', 'frost', 'frost', 'heal', 'vulcan'],
  },
};
