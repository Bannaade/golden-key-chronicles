import express from "express";
import cors from "cors";
import { Server, matchMaker, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MapSchema, Schema, type } from "@colyseus/schema";
import http from "node:http";

const PORT = Number(process.env.PORT || 2567);
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json());
const server = http.createServer(app);

class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") world = 0;
  @type("boolean") spectator = false;
  @type("boolean") connected = true;
  @type("number") clues = 0;
}
class ChronicleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") roomCode = "";
  @type("string") phase = "waiting";
  @type("string") winner = "";
  @type("number") keyWorld = 0;
  @type("number") keyX = 0;
  @type("number") keyZ = 0;
  @type("string") event = "The portals awaken";
}
const names = ["Tom", "Josh", "Dave", "Joe", "Stone"];
const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();

class ChroniclesRoom extends Room<ChronicleState> {
  maxClients = 10;
  onCreate(options: any) {
    this.setState(new ChronicleState());
    this.state.roomCode = options.roomCode || code();
    this.state.keyWorld = Math.floor(Math.random() * 5);
    this.state.keyX = 10 + Math.floor(Math.random() * 30);
    this.state.keyZ = 10 + Math.floor(Math.random() * 30);
    this.setMetadata({ roomCode: this.state.roomCode });
    this.onMessage("move", (client, msg: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.spectator || this.state.phase !== "playing") return;
      const x = Number(msg?.x), z = Number(msg?.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      p.x = Math.max(0, Math.min(50, x + 25)); p.z = Math.max(0, Math.min(50, z + 25));
    });
    this.onMessage("travel", (client, msg: any) => {
      const p = this.state.players.get(client.sessionId);
      const world = Number(msg?.world);
      if (!p || p.spectator || this.state.phase !== "playing" || !Number.isInteger(world) || world < 0 || world > 4) return;
      p.world = world; p.x = 25; p.z = 25;
    });
    this.onMessage("interact", (client, msg: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.spectator || this.state.phase !== "playing") return;
      const action = String(msg?.action || "");
      if (action === "rune") {
        const rune = Number(msg?.rune);
        if (!Number.isInteger(rune) || rune < 0 || rune > 2) return;
        p.clues = Math.min(3, p.clues | (1 << rune));
        this.broadcast("discovery", { player: p.name, message: `${p.name} discovered an ancient rune.` });
      }
      if (action === "dig") {
        const nearKey = p.world === this.state.keyWorld && Math.hypot(p.x - this.state.keyX, p.z - this.state.keyZ) < 5;
        if (nearKey && p.clues === 7) {
          this.state.winner = p.name;
          this.state.phase = "finished";
          this.state.event = "The Golden Key has been found!";
          this.state.players.forEach(player => { player.spectator = player.name !== p.name; });
          this.broadcast("victory", { winner: p.name });
        } else {
          client.send("notice", { message: "The vault remains sealed. Find all three runes and search the correct world." });
        }
      }
    });
    this.onMessage("requestRoster", (client) => {
      const player = this.state.players.get(client.sessionId);
      client.send("assigned", { name: player?.name || "", spectator: player?.spectator || false, roomCode: this.state.roomCode });
      client.send("roster", this.rosterSnapshot());
    });
    this.onMessage("start", (client) => {
      if (this.state.phase === "waiting" && this.state.players.size >= 1) this.state.phase = "playing";
    });
    this.clock.setInterval(() => {
      if (this.state.phase === "playing") {
        const events = ["The Saffron Winds shift the dunes", "Fireflies gather near an old shrine", "Crystal resonance echoes underground", "A beam of light points toward a portal", "The temple guardians stir"];
        this.state.event = events[Math.floor(Math.random() * events.length)];
        this.broadcast("worldEvent", { text: this.state.event });
      }
    }, 25000);
  }
  onJoin(client: any, options: any) {
    const requested = String(options?.name || "");
    const occupied = [...this.state.players.values()].map(p => p.name);
    const player = new Player();
    player.name = names.includes(requested) && !occupied.includes(requested) ? requested : (names.find(n => !occupied.includes(n)) || `Spectator ${this.state.players.size - 4}`);
    player.spectator = this.state.phase === "finished" || !names.includes(player.name);
    player.x = 25; player.z = 25; player.world = 0;
    this.state.players.set(client.sessionId, player);
    if (this.state.players.size === 5 && this.state.phase === "waiting") this.state.event = "All five explorers have assembled.";
    client.send("assigned", { name: player.name, spectator: player.spectator, roomCode: this.state.roomCode });
    // Send the joining client a direct roster snapshot after adding its player.
    client.send("roster", this.rosterSnapshot());
    this.broadcastRoster();
  }
  private rosterSnapshot() {
    return { roomCode: this.state.roomCode, phase: this.state.phase, players: [...this.state.players.entries()].map(([sessionId, p]) => ({ sessionId, name: p.name, connected: p.connected, spectator: p.spectator })) };
  }
  private broadcastRoster() { this.broadcast("roster", this.rosterSnapshot()); }
  onLeave(client: any) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    this.broadcastRoster();
  }
}

const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define("chronicles", ChroniclesRoom);
app.get("/health", (_req, res) => res.json({ ok: true, service: "golden-key-chronicles" }));
app.post("/api/rooms", async (_req, res) => {
  try {
    const roomCode = code();
    const listing = await matchMaker.createRoom("chronicles", { roomCode });
    console.log(`[rooms] created code=${roomCode} roomId=${listing.roomId}`);
    res.status(201).json({ roomCode, roomId: listing.roomId });
  } catch (e) { res.status(500).json({ error: "Could not create room" }); }
});
app.get("/api/rooms/:code", async (req, res) => {
  const roomCode = req.params.code.trim().toUpperCase();
  try {
    // Resolve invitation codes from Colyseus matchmaking metadata rather than
    // a process-local Map, which can become stale or disappear after restarts.
    const rooms = await matchMaker.query({ name: "chronicles", roomCode });
    const room = rooms.find((entry: any) => entry.metadata?.roomCode === roomCode || entry.roomCode === roomCode);
    if (!room) {
      console.warn(`[rooms] lookup miss code=${roomCode}`);
      return res.status(404).json({ error: "Room not found. Ask the host for a fresh invitation." });
    }
    console.log(`[rooms] lookup hit code=${roomCode} roomId=${room.roomId}`);
    res.json({ roomId: room.roomId });
  } catch (error) {
    console.error(`[rooms] lookup failed code=${roomCode}`, error);
    res.status(500).json({ error: "Could not look up room. Please try again." });
  }
});
app.get("/", (_req, res) => res.send("The Golden Key Chronicles multiplayer server is online."));
server.listen(PORT, "0.0.0.0", () => console.log(`Chronicles server listening on 0.0.0.0:${PORT}`));
