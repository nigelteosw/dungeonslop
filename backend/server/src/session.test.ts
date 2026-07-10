import { expect, test } from "bun:test";
import { GameSession } from "./session";
import { projectShipSnapshot } from "./snapshot";

function startedSession(): GameSession {
  const session = new GameSession("test-seed");
  session.join("host");
  session.join("friend");
  session.setRole("host", "pilot");
  session.setRole("friend", "engineer");
  session.toggleReady("host");
  session.toggleReady("friend");
  session.start("host");
  return session;
}

test("host starts a run with one owned crew member per player", () => {
  const session = startedSession();
  expect(session.run?.status).toBe("mapVote");
  expect(session.sessionToCrew.get("host")).toBe("c0");
  expect(session.run?.crew.c1?.role).toBe("engineer");
});

test("schema snapshot includes authoritative room geometry and doors", () => {
  const session = startedSession();
  const run = session.snapshot().run;
  if (!run) throw new Error("expected run snapshot");
  const state = projectShipSnapshot(run);

  expect(state.rooms.find((room) => room.id === "bridge")).toMatchObject({ x: 8, y: 3, w: 2, h: 2 });
  expect(state.doors.find((door) => door.id === "bridge--weapons")).toMatchObject({
    a: "weapons",
    b: "bridge",
    open: true,
    locked: false,
  });
});

test("player cannot command another player's crew", () => {
  const session = startedSession();
  session.castVote("host", "scrap-raider");
  session.castVote("friend", "scrap-raider");
  expect(() => session.handleCommand("host", { kind: "move", crewId: "c1", roomId: "shields" })).toThrow(
    "cannot command another player's crew",
  );
});

test("owned crew command updates authoritative run", () => {
  const session = startedSession();
  session.castVote("host", "scrap-raider");
  session.castVote("friend", "scrap-raider");
  session.handleCommand("host", { kind: "move", crewId: "c0", roomId: "weapons" });
  expect(session.run?.crew.c0?.roomId).toBe("weapons");
});

test("server tick advances the authoritative simulation", () => {
  const session = startedSession();
  session.tick();
  expect(session.run?.tick).toBe(1);
});

test("crew votes advance the authoritative run into an encounter", () => {
  const session = startedSession();
  session.castVote("host", "shield-leech");
  session.castVote("friend", "shield-leech");
  expect(session.run?.status).toBe("encounter");
  expect(session.run?.enemy?.id).toBe("shield-leech");
});
