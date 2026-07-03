import { Room, type Client } from "colyseus";
import { DungeonState } from "../schema";
import { GameSession, type Intent } from "../session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseName(message: unknown): string {
  if (!isRecord(message) || typeof message.name !== "string") throw new Error("invalid setName payload");
  return message.name;
}

function parseClass(message: unknown): string {
  if (!isRecord(message) || typeof message.classId !== "string") throw new Error("invalid setClass payload");
  return message.classId;
}

function parseItem(message: unknown): string {
  if (!isRecord(message) || typeof message.itemId !== "string") throw new Error("invalid equip payload");
  return message.itemId;
}

function parseUpgrade(message: unknown): string {
  if (!isRecord(message) || typeof message.upgradeId !== "string") throw new Error("invalid pickUpgrade payload");
  return message.upgradeId;
}

function parseIntent(message: unknown): Intent {
  if (!isRecord(message) || typeof message.kind !== "string") throw new Error("invalid intent payload");
  if (message.kind === "move" && isRecord(message.to) && typeof message.to.x === "number" && typeof message.to.y === "number") {
    return { kind: "move", to: { x: message.to.x, y: message.to.y } };
  }
  if (
    message.kind === "playCard" &&
    typeof message.cardId === "string" &&
    isRecord(message.target) &&
    typeof message.target.x === "number" &&
    typeof message.target.y === "number"
  ) {
    return { kind: "playCard", cardId: message.cardId, target: { x: message.target.x, y: message.target.y } };
  }
  if (message.kind === "endTurn") return { kind: "endTurn" };
  throw new Error("invalid intent payload");
}

export class DungeonRoom extends Room<DungeonState> {
  maxClients = 4;
  private session = new GameSession("pending-room-id");

  onCreate(): void {
    this.session = new GameSession(this.roomId || "dungeon");
    this.setState(new DungeonState());
    this.onMessage("setName", (client, message) => this.apply(client, () => this.session.setName(client.sessionId, parseName(message))));
    this.onMessage("setClass", (client, message) => this.apply(client, () => this.session.setClass(client.sessionId, parseClass(message))));
    this.onMessage("toggleReady", (client) => this.apply(client, () => this.session.toggleReady(client.sessionId)));
    this.onMessage("start", (client) => this.apply(client, () => this.session.start(client.sessionId)));
    this.onMessage("intent", (client, message) => this.apply(client, () => this.session.handleIntent(client.sessionId, parseIntent(message))));
    this.onMessage("pickUpgrade", (client, message) => this.apply(client, () => this.session.pickUpgrade(client.sessionId, parseUpgrade(message))));
    this.onMessage("equip", (client, message) => this.apply(client, () => this.session.equip(client.sessionId, parseItem(message))));
  }

  onJoin(client: Client): void {
    this.apply(client, () => this.session.join(client.sessionId));
    client.send("mySessionId", { sessionId: client.sessionId });
  }

  onLeave(client: Client): void {
    this.session.leave(client.sessionId);
    this.project();
  }

  private apply(client: Client, fn: () => void): void {
    try {
      fn();
      this.project();
    } catch (error) {
      client.send("rejected", { message: error instanceof Error ? error.message : "rejected" });
    }
  }

  private project(): void {
    this.state.applySnapshot(this.session.snapshot());
  }
}
