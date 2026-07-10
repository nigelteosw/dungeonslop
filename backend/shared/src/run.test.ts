import { expect, test } from "bun:test";
import { castVote, stepRun } from "./run";
import { createCrew, createRun } from "./ship";

test("all crew voting starts the selected encounter", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "pilot"), createCrew("c1", "s1", "Bob", "gunner")]);
  run = castVote(run, "s0", "shield-leech");
  expect(run.status).toBe("mapVote");
  run = castVote(run, "s1", "shield-leech");
  expect(run.status).toBe("encounter");
  expect(run.enemy?.id).toBe("shield-leech");
});

test("captain vote breaks a tied expired vote", () => {
  let run = createRun("seed", [createCrew("c0", "captain", "Ada", "pilot"), createCrew("c1", "friend", "Bob", "gunner")]);
  run = castVote(run, "captain", "volatile-derelict");
  run = castVote(run, "friend", "scrap-raider");
  expect(run.enemy?.id).toBe("volatile-derelict");
});

test("encounter victory opens upgrade vote and upgrade advances sector", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "gunner", "weapons")]);
  run = castVote(run, "s0", "scrap-raider");
  run.enemy!.hull = 0;
  run = stepRun(run, () => 1);
  expect(run.status).toBe("layoutVote");
  expect(run.ship.scrap).toBe(8);
  run = castVote(run, "s0", "battle");
  expect(run.status).toBe("upgradeVote");
  expect(run.ship.layoutId).toBe("battle");
  run = castVote(run, "s0", "reinforced-hull");
  expect(run.status).toBe("mapVote");
  expect(run.sectorIndex).toBe(1);
  expect(run.ship.maxHull).toBe(56);
  expect(run.slopEffectId).toBe("thin-air");
});

test("a run crosses three sectors and ends in final victory", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "gunner")]);
  for (let sector = 0; sector < 3; sector += 1) {
    run = castVote(run, "s0", "volatile-derelict");
    run.enemy!.hull = 0;
    run = stepRun(run, () => 1);
    if (sector < 2) {
      expect(run.status).toBe("layoutVote");
      run = castVote(run, "s0", sector === 0 ? "battle" : "rescue");
      expect(run.status).toBe("upgradeVote");
      run = castVote(run, "s0", sector === 0 ? "shield-capacitor" : "reactor-tap");
      expect(run.sectorIndex).toBe(sector + 1);
    }
  }
  expect(run.status).toBe("victory");
  expect(run.objectiveText).toBe("Three sectors survived");
  expect(run.installedUpgrades).toEqual(["shield-capacitor", "reactor-tap"]);
});

test("authored event vote changes shared resources before combat", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "medic")]);
  run = castVote(run, "s0", "suspicious-signal");
  expect(run.status).toBe("eventVote");
  run = castVote(run, "s0", "strip-wreck");
  expect(run.status).toBe("encounter");
  expect(run.ship.scrap).toBe(10);
  expect(run.ship.rooms.oxygen?.breached).toBe(true);
});

test("expanded event and upgrade effects persist into encounters", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "engineer")]);
  run = castVote(run, "s0", "quarantine-buoy");
  run = castVote(run, "s0", "open-buoy");
  expect(run.boarders.eventBoarder?.roomId).toBe("medbay");
  expect(run.ship.scrap).toBe(12);

  run.enemy!.hull = 0;
  run = stepRun(run, () => 1);
  run = castVote(run, "s0", "rescue");
  run = castVote(run, "s0", "auto-turret");
  expect(run.installedUpgrades).toContain("auto-turret");
});

test("purge buoy event ignites the oxygen room", () => {
  let run = createRun("seed", [createCrew("c0", "s0", "Ada", "medic")]);
  run = castVote(run, "s0", "quarantine-buoy");
  run = castVote(run, "s0", "purge-buoy");
  expect(Object.values(run.ship.fires).some((fire) => fire.roomId === "oxygen")).toBe(true);
});
