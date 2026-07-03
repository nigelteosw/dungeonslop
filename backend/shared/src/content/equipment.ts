import { z } from "zod";

export type EquipmentSlot = "weapon" | "armor" | "trinket";
export type EquipmentEffect =
  | { kind: "maxHp"; amount: number }
  | { kind: "attack"; amount: number }
  | { kind: "moveRange"; amount: number }
  | { kind: "maxEnergy"; amount: number };

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  effect: EquipmentEffect;
}

const equipmentEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("maxHp"), amount: z.number().int() }),
  z.object({ kind: z.literal("attack"), amount: z.number().int() }),
  z.object({ kind: z.literal("moveRange"), amount: z.number().int() }),
  z.object({ kind: z.literal("maxEnergy"), amount: z.number().int() }),
]);

const equipmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slot: z.enum(["weapon", "armor", "trinket"]),
  effect: equipmentEffectSchema,
}) satisfies z.ZodType<EquipmentDef>;

export const EQUIPMENT = z.record(equipmentSchema).parse({
  rusty_sword: { id: "rusty_sword", name: "Rusty Sword", slot: "weapon", effect: { kind: "attack", amount: 1 } },
  ash_staff: { id: "ash_staff", name: "Ash Staff", slot: "weapon", effect: { kind: "attack", amount: 1 } },
  dragon_spoon: { id: "dragon_spoon", name: "Dragon Spoon", slot: "weapon", effect: { kind: "attack", amount: 2 } },
  buckler: { id: "buckler", name: "Buckler", slot: "armor", effect: { kind: "maxHp", amount: 2 } },
  bone_mail: { id: "bone_mail", name: "Bone Mail", slot: "armor", effect: { kind: "maxHp", amount: 3 } },
  moon_robe: { id: "moon_robe", name: "Moon Robe", slot: "armor", effect: { kind: "maxEnergy", amount: 1 } },
  lucky_tooth: { id: "lucky_tooth", name: "Lucky Tooth", slot: "trinket", effect: { kind: "moveRange", amount: 1 } },
  gel_amulet: { id: "gel_amulet", name: "Gel Amulet", slot: "trinket", effect: { kind: "maxHp", amount: 1 } },
  hex_ring: { id: "hex_ring", name: "Hex Ring", slot: "trinket", effect: { kind: "attack", amount: 1 } },
  cracked_crown: { id: "cracked_crown", name: "Cracked Crown", slot: "trinket", effect: { kind: "maxEnergy", amount: 1 } },
  jogging_blade: { id: "jogging_blade", name: "Jogging Blade", slot: "weapon", effect: { kind: "moveRange", amount: 1 } },
  tax_mail: { id: "tax_mail", name: "Tax Mail", slot: "armor", effect: { kind: "maxHp", amount: 2 } },
  wand_of_maybe: { id: "wand_of_maybe", name: "Wand of Maybe", slot: "weapon", effect: { kind: "attack", amount: 1 } },
  kettle_helm: { id: "kettle_helm", name: "Kettle Helm", slot: "armor", effect: { kind: "maxHp", amount: 2 } },
  coupon_book: { id: "coupon_book", name: "Coupon Book", slot: "trinket", effect: { kind: "maxEnergy", amount: 1 } },
}) as Record<string, EquipmentDef>;
