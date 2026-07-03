import { z } from "zod";

export type CardEffect = "damage" | "heal" | "block";
export type CardShape = "melee" | "ranged" | "line" | "self";

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  effect: CardEffect;
  shape: CardShape;
  power: number;
  range?: number;
}

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().int().min(0),
  effect: z.enum(["damage", "heal", "block"]),
  shape: z.enum(["melee", "ranged", "line", "self"]),
  power: z.number().int().min(0),
  range: z.number().int().positive().optional(),
}) satisfies z.ZodType<CardDef>;

export const CARDS = z.record(cardSchema).parse({
  slash: { id: "slash", name: "Slash", cost: 1, effect: "damage", shape: "melee", power: 2 },
  cleave: { id: "cleave", name: "Cleave", cost: 2, effect: "damage", shape: "line", power: 1, range: 3 },
  block: { id: "block", name: "Shield Block", cost: 1, effect: "block", shape: "self", power: 5 },
  firebolt: { id: "firebolt", name: "Firebolt", cost: 1, effect: "damage", shape: "ranged", power: 2, range: 6 },
  frost: { id: "frost", name: "Frost Shard", cost: 1, effect: "damage", shape: "ranged", power: 1, range: 5 },
  vulcan: { id: "vulcan", name: "AK-47 Vulcan", cost: 2, effect: "damage", shape: "line", power: 2, range: 9 },
  heal: { id: "heal", name: "Mend", cost: 1, effect: "heal", shape: "ranged", power: 4, range: 6 },
  riposte: { id: "riposte", name: "Riposte", cost: 1, effect: "damage", shape: "melee", power: 3 },
  arcane_armor: { id: "arcane_armor", name: "Arcane Armor", cost: 1, effect: "block", shape: "self", power: 4 },
  lightning_line: { id: "lightning_line", name: "Lightning Line", cost: 2, effect: "damage", shape: "line", power: 3, range: 7 },
}) as Record<string, CardDef>;
