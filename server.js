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

// /room/XXXX 用
app.get("/room/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const rooms = {};

/* ===== Utils ===== */

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
  if (s.winType === "same") return "同じ数字";
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

function sys(roomId, text) {
  io.to(roomId).emit("chat:msg", {
    ts: Date.now(),
    name: "system",
    text,
    system: true
  });
}

/* ===== Socket ===== */

io.on("connection", (s) => {

  // 作成
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

    sys(id, "部屋を作成しました");
    broadcast(id);
  });

  // 入室
  s.on("room:join", ({ roomId, name }) => {

    const r = rooms[roomId];
    if (!r) return;

    if (Object.keys(r.players).length >= 2) return;

    r.players[s.id] = { name, card: null, word: "" };

    s.join(roomId);
    s.data.room = roomId;

    sys(roomId, name + " が参加しました");
    broadcast(roomId);
  });

  // 設定
  s.on("settings:update", (d) => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (s.id !== r.hostId) return;
    if (r.phase !== "lobby") return;

    r.settings = d;

    broadcast(s.data.room);
  });

  // 開始
  s.on("game:start", () => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (s.id !== r.hostId) return;
    if (Object.keys(r.players).length !== 2) return;

    r.phase = "playing";
    r.redraw = { last: null, count: 0 };

    for (const id in r.players) {
      r.players[id].card = roll();
      r.players[id].word = "";
      io.to(id).emit("card:mine", r.players[id].card);
    }

    sys(s.data.room, "ゲーム開始！");
    broadcast(s.data.room);
  });

  // 引き直し
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

    sys(s.data.room, me.name + " が引き直しました");
    broadcast(s.data.room);
  });

  // ワード
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

  // 挑戦
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

  // チャット
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

  // リセット
  s.on("game:reset", () => {

    const r = rooms[s.data.room];
    if (!r) return;
    if (s.id !== r.hostId) return;

    r.phase = "lobby";

    for (const id in r.players) {
      r.players[id].card = null;
      r.players[id].word = "";
    }

    broadcast(s.data.room);
  });

});
server.listen(PORT);
