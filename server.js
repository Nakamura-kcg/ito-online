"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/room/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const rooms = {};

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do {
    id = "";
    for (let i = 0; i < 4; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[id]);
  return id;
}

function roll() {
  return 1 + Math.floor(Math.random() * 10);
}

function judge(a, b, s) {
  const sum = a + b;
  const same = a === b;

  if (s.winType === "sum11") return sum === 11;
  if (s.winType === "same") return same;
  if (s.winType === "both") return sum === 11 || same;
  if (s.winType === "custom") return sum === Number(s.customSum);
  return false;
}

function condLabel(s) {
  if (s.winType === "sum11") return "合計11";
  if (s.winType === "same") return "同じ";
  if (s.winType === "both") return "合計11 or 同じ";
  if (s.winType === "custom") return "合計 " + s.customSum;
  return "";
}

function broadcast(roomId) {
  const r = rooms[roomId];
  if (!r) return;

  const players = Object.entries(r.players).map(([id, p]) => ({
    id,
    name: p.name,
    word: p.word || ""
  }));

  io.to(roomId).emit("room:state", {
    roomId,
    hostId: r.hostId,
    phase: r.phase,
    settings: r.settings,
    players
  });
}

io.on("connection", (s) => {

  s.on("room:create", ({ name }) => {
    const id = genRoomId();

    rooms[id] = {
      hostId: s.id,
      phase: "lobby",
      players: {
        [s.id]: { name, card: null, word: "" }
      },
      settings: {
        theme: "",
        winType: "both",
        customSum: 11
      }
    };

    s.join(id);
    s.data.room = id;
    s.emit("room:created", { roomId: id });

    broadcast(id);
  });

  s.on("room:join", ({ roomId, name }) => {
    const r = rooms[roomId];
    if (!r) return;
    if (Object.keys(r.players).length >= 2) return;

    r.players[s.id] = { name, card: null, word: "" };
    s.join(roomId);
    s.data.room = roomId;

    broadcast(roomId);
  });

  s.on("settings:update", (d) => {
    const r = rooms[s.data.room];
    if (!r) return;
    if (s.id !== r.hostId) return;
    if (r.phase !== "lobby") return;

    r.settings = d;
    broadcast(s.data.room);
  });

  s.on("game:start", () => {
    const r = rooms[s.data.room];
    if (!r) return;
    if (Object.keys(r.players).length !== 2) return;

    r.phase = "playing";

    for (const id in r.players) {
      r.players[id].card = roll();
      r.players[id].word = "";
      io.to(id).emit("card:mine", r.players[id].card);
    }

    broadcast(s.data.room);
  });

  s.on("word:submit", ({ word }) => {
    const r = rooms[s.data.room];
    if (!r) return;
    if (r.phase !== "playing") return;

    const me = r.players[s.id];
    if (!me) return;

    const w = String(word || "").trim();
    if (!w || w.length > 30) return;

    me.word = w;
    broadcast(s.data.room);
  });

  s.on("game:challenge", () => {
    const r = rooms[s.data.room];
    if (!r) return;
    if (r.phase !== "playing") return;

    const ids = Object.keys(r.players);
    const A = r.players[ids[0]];
    const B = r.players[ids[1]];

    const ok = judge(A.card, B.card, r.settings);
    r.phase = "result";

    io.to(s.data.room).emit("game:result", {
      success: ok,
      theme: r.settings.theme,
      condition: condLabel(r.settings),
      cards: [
        { name: A.name, card: A.card, word: A.word },
        { name: B.name, card: B.card, word: B.word }
      ]
    });

    broadcast(s.data.room);
  });

  s.on("chat:send", ({ text }) => {
    const r = rooms[s.data.room];
    if (!r) return;

    const p = r.players[s.id];
    if (!p) return;

    const t = String(text || "").trim();
    if (!t) return;

    io.to(s.data.room).emit("chat:msg", {
      name: p.name,
      text: t,
      system: false
    });
  });

});

server.listen(PORT);
