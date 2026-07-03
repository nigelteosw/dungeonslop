import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DungeonRoom } from "./rooms/DungeonRoom";

const port = Number.parseInt(process.env.PORT ?? "2567", 10);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN ?? "*";

const httpServer = createServer((_req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": allowedOrigin,
  });
  res.end(JSON.stringify({ ok: true, room: "dungeon" }));
});

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

gameServer.define("dungeon", DungeonRoom);

httpServer.listen(port, () => {
  console.log(`Dungeonslop server listening on :${port}`);
});
