import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import giveawayRealtimeConfig from "./lib/giveaway-realtime-config";

const { getGiveawayAllowedOrigins, isGiveawayOriginAllowed } =
  giveawayRealtimeConfig;

const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const allowedOrigins = getGiveawayAllowedOrigins();

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    const origin = request.headers.origin;
    if (isGiveawayOriginAllowed(origin, allowedOrigins) && origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ ok: true, service: "swiftdu-realtime" }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin(origin, callback) {
      const allowed = isGiveawayOriginAllowed(origin, allowedOrigins);
      callback(allowed ? null : new Error("Origin is not allowed."), allowed);
    },
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

httpServer.listen(port, hostname, () => {
  console.log(`> SwiftDU realtime ready on http://${hostname}:${port}`);
  void import("./lib/giveaway-socket")
    .then(({ default: installGiveawaySocket }) => installGiveawaySocket(io))
    .catch((error) => {
      console.error("Failed to load giveaway socket handlers.", error);
    });
});
