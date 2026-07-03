import { z } from "zod";

export interface ClassDef {
  id: string;
  name: string;
  maxHp: number;
  moveRange: number;
  attack: number;
  maxEnergy: number;
  startingDeck: string[];
}

const classSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxHp: z.number().int().positive(),
  moveRange: z.number().int().positive(),
  attack: z.number().int().nonnegative(),
  maxEnergy: z.number().int().positive(),
  startingDeck: z.array(z.string().min(1)).min(1),
}) satisfies z.ZodType<ClassDef>;

export const CLASSES = z.record(classSchema).parse({
  knight: {
    id: "knight",
    name: "Knight",
    maxHp: 14,
    moveRange: 4,
    attack: 3,
    maxEnergy: 3,
    startingDeck: ["slash", "slash", "slash", "block", "block", "cleave"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    maxHp: 9,
    moveRange: 4,
    attack: 2,
    maxEnergy: 3,
    startingDeck: ["firebolt", "firebolt", "frost", "frost", "heal", "vulcan"],
  },
}) as Record<string, ClassDef>;
