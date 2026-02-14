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

/* Utils */

function genRoomId() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;

  do {
    id = "";
    for (let i = 0; i < 4; i++) {
      id += c[Math.floor(Math.random() * c.length)];
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
    redraw: r.redraw,
    players
  });
}

/* Socket */

io.on("connection", (s) => {

  // Create
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
      },
      redraw: { last: null, count: 0 }
    };

    s.join(id);
    s.data.room = id;

    s.emit("room:created", { roomId: id });

    broadcast(id);
  });

  // Join
  s.on("room:join", ({ roomId, name }) => {

    const r = rooms[roomId];
    if (!r) return;

    if (Object.keys(r.players).length >= 2) return;

    r.players[s.id] = { name, card: null, word: "" };

    s.join(roomId);
    s.data.room = roomId;

    broadcast(roomId);
  });

  // Settings
  s.on("settings:update", (d) => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (s.id !== r.hostId) return;
    if (r.phase !== "lobby") return;

    r.settings = d;

    broadcast(s.data.room);
  });

  // Start
  s.on("game:start", () => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (Object.keys(r.players).length !== 2) return;

    r.phase = "playing";
    r.redraw = { last: null, count: 0 };

    for (const id in r.players) {
      r.players[id].card = roll();
      r.players[id].word = "";
      io.to(id).emit("card:mine", r.players[id].card);
    }

    broadcast(s.data.room);
  });

  // Redraw
  s.on("card:redraw", () => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (r.phase !== "playing") return;

    const me = r.players[s.id];

    if (r.redraw.last === s.id) {
      if (r.redraw.count >= 3) return;
      r.redraw.count++;
    } else {
      r.redraw.last = s.id;
      r.redraw.count = 1;
    }

    me.card = roll();
    me.word = "";

    io.to(s.id).emit("card:mine", me.card);

    broadcast(s.data.room);
  });

  // Word
  s.on("word:submit", ({ word }) => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (r.phase !== "playing") return;

    const me = r.players[s.id];
    if (!me) return;

    const w = String(word || "").trim();

    if (!w) return;
    if (w.length > 30) return;

    me.word = w;

    broadcast(s.data.room);
  });

  // Challenge
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

  // Chat
  s.on("chat:send", ({ text }) => {

    const r = rooms[s.data.room];
    if (!r) return;

    const p = r.players[s.id];
    if (!p) return;

    const t = String(text || "").trim();
    if (!t) return;

    io.to(s.data.room).emit("chat:msg", {
      ts: Date.now(),
      name: p.name,
      text: t,
      system: false
    });
  });

});

server.listen(PORT);
