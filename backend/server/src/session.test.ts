import { expect, test } from "bun:test";
import { GameSession } from "./session";

function readyStartedSession(): GameSession {
  const session = new GameSession("test-seed");
  session.join("a");
  session.join("b");
  session.setName("a", "Ann");
  session.setName("b", "Bo");
  session.setClass("a", "knight");
  session.setClass("b", "wizard");
  session.toggleReady("a");
  session.toggleReady("b");
  session.start("a");
  return session;
}

test("host start creates a game and session-owned unit ids", () => {
  const session = readyStartedSession();
  const snap = session.snapshot();
  expect(snap.phase).toBe("player");
  expect(snap.sessionToUnit.a).toBe("p0");
  expect(snap.sessionToUnit.b).toBe("p1");
  expect(snap.game?.units.p0?.name).toBe("Ann");
});

test("non-owner cannot act for the active unit", () => {
  const session = readyStartedSession();
  expect(() => session.handleIntent("b", { kind: "move", to: { x: 2, y: 3 } })).toThrow("not your turn");
});

test("legal move updates authoritative state", () => {
  const session = readyStartedSession();
  session.handleIntent("a", { kind: "move", to: { x: 2, y: 1 } });
  expect(session.snapshot().game?.units.p0?.pos).toEqual({ x: 2, y: 1 });
});

test("out-of-turn after endTurn is rejected for the previous player", () => {
  const session = readyStartedSession();
  session.handleIntent("a", { kind: "endTurn" });
  expect(() => session.handleIntent("a", { kind: "move", to: { x: 2, y: 1 } })).toThrow("not your turn");
});

test("legal playCard updates state when target is valid", () => {
  const session = new GameSession("card-seed");
  session.join("a");
  session.setClass("a", "knight");
  session.toggleReady("a");
  session.start("a");

  const game = session.game;
  if (!game?.units.p0 || !game.units.m0) throw new Error("missing units");
  game.units.p0 = { ...game.units.p0, hand: ["slash"], pos: { x: 1, y: 1 } };
  game.units.m0 = { ...game.units.m0, hp: 10, maxHp: 10, pos: { x: 2, y: 1 } };

  session.handleIntent("a", { kind: "playCard", cardId: "slash", target: { x: 2, y: 1 } });
  expect(session.snapshot().game?.units.m0?.hp).toBe(5);
});
