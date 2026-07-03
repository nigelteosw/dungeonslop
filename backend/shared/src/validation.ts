import { CARDS } from "./content/cards";
import { CLASSES } from "./content/classes";
import { EQUIPMENT } from "./content/equipment";
import { MONSTERS } from "./content/monsters";
import { SLOP_CARDS } from "./content/slopcards";
import { UPGRADES } from "./content/upgrades";

export function validateContent(): void {
  for (const classDef of Object.values(CLASSES)) {
    for (const cardId of classDef.startingDeck) {
      if (!CARDS[cardId]) throw new Error(`class ${classDef.id} references unknown card ${cardId}`);
    }
  }

  for (const monster of Object.values(MONSTERS)) {
    for (const itemId of monster.lootTable) {
      if (!EQUIPMENT[itemId]) throw new Error(`monster ${monster.id} references unknown equipment ${itemId}`);
    }
  }

  for (const upgrade of Object.values(UPGRADES)) {
    if (upgrade.effect.kind === "addCard" && !CARDS[upgrade.effect.cardId]) {
      throw new Error(`upgrade ${upgrade.id} references unknown card ${upgrade.effect.cardId}`);
    }
  }

  if (Object.keys(CLASSES).length !== 2) throw new Error("v0 expects exactly 2 classes");
  if (Object.keys(MONSTERS).length !== 5) throw new Error("v0 expects exactly 5 monsters");
  if (Object.keys(UPGRADES).length !== 20) throw new Error("v0 expects exactly 20 upgrades");
  if (Object.keys(EQUIPMENT).length !== 15) throw new Error("v0 expects exactly 15 equipment items");
  if (Object.keys(SLOP_CARDS).length !== 15) throw new Error("v0 expects exactly 15 slop cards");
}
