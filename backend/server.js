require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- REST: CRUD ----------
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: "Server error" }); });

app.get("/api/transcriptions", wrap(async (req, res) => {
  res.json(await db.list((req.query.q || "").trim()));
}));

app.get("/api/transcriptions/:id", wrap(async (req, res) => {
  const row = await db.get(req.params.id);
  row ? res.json(row) : res.status(404).json({ error: "Not found" });
}));

app.post("/api/transcriptions", wrap(async (req, res) => {
  const { text, language = "hi+en", engine = "deepgram", duration_sec = 0 } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  res.status(201).json(await db.create({ text: text.trim(), language, engine, duration_sec }));
}));

app.put("/api/transcriptions/:id", wrap(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });
  const row = await db.update(req.params.id, text.trim());
  row ? res.json(row) : res.status(404).json({ error: "Not found" });
}));

app.delete("/api/transcriptions/:id", wrap(async (req, res) => {
  (await db.remove(req.params.id)) ? res.json({ deleted: true }) : res.status(404).json({ error: "Not found" });
}));

// ---------- WebSocket: live audio -> Deepgram -> live text ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

const DG_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&language=multi" + // multi = code-switching (Hindi + English)
  "&interim_results=true&smart_format=true&punctuate=true&endpointing=100";

wss.on("connection", (client) => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    client.send(JSON.stringify({ type: "error", message: "DEEPGRAM_API_KEY missing on server" }));
    return client.close();
  }

  const dg = new WebSocket(DG_URL, { headers: { Authorization: `Token ${key}` } });
  const pending = []; // audio that arrives before Deepgram is ready

  dg.on("open", () => {
    pending.forEach((chunk) => dg.send(chunk));
    pending.length = 0;
    client.send(JSON.stringify({ type: "ready" }));
  });

  dg.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const text = msg.channel?.alternatives?.[0]?.transcript;
      if (msg.type === "Results" && text) {
        client.send(JSON.stringify({ type: "transcript", text, isFinal: !!msg.is_final }));
      }
    } catch {}
  });

  dg.on("error", (err) => client.send(JSON.stringify({ type: "error", message: err.message })));
  dg.on("close", () => client.readyState === WebSocket.OPEN && client.close());

  client.on("message", (data, isBinary) => {
    if (!isBinary) return;
    dg.readyState === WebSocket.OPEN ? dg.send(data) : pending.push(data);
  });

  client.on("close", () => {
    if (dg.readyState === WebSocket.OPEN) {
      dg.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => dg.close(), 500);
    }
  });
});

const PORT = process.env.PORT || 4000;
db.init()
  .then(() => server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`)))
  .catch((e) => { console.error("Database connection failed:", e.message); process.exit(1); });
