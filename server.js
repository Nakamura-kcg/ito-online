"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const rooms = Object.create(null);

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  while (true) {
    let id = "";
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    if (!rooms[id]) return id;
  }
}

function rollCard() {
  return 1 + Math.floor(Math.random() * 10);
}

function computeSuccess(a, b, settings) {
  const sum = a + b;
  const same = a === b;
  switch (settings.winType) {
    case "sum11": return sum === 11;
    case "same": return same;
    case "both": return sum === 11 || same;
    case "custom": return sum === Number(settings.customSum || 11);
    default: return false;
  }
}

function condLabel(settings) {
  switch (settings.winType) {
    case "both": return "合計11 または 同じ数字";
    case "sum11": return "合計が11";
    case "same": return "同じ数字";
    case "custom": return `合計が ${Number(settings.customSum || 11)}`;
    default: return "";
  }
}

function roomState(roomId) {
  const r = rooms[roomId];
  if (!r) return null;
  const players = Object.entries(r.players).map(([id, p]) => ({
    id,
    name: p.name,
    word: p.word || "",
    wordLocked: !!p.wordLocked
  }));
  return {
    roomId,
    hostId: r.hostId,
    phase: r.phase,
    settings: { ...r.settings },
    redraw: { ...r.redraw },
    players
  };
}

function broadcastRoom(roomId) {
  io.to(roomId).emit("room:state", roomState(roomId));
}

function systemMsg(roomId, text) {
  io.to(roomId).emit("chat:msg", { ts: Date.now(), name: "system", text, system: true });
}

function safeName(x) {
  return String(x || "Player").trim().slice(0, 20) || "Player";
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }) => {
    const roomId = genRoomId();
    rooms[roomId] = {
      hostId: socket.id,
      phase: "lobby",
      players: { [socket.id]: { name: safeName(name), card: null, word: "", wordLocked: false } },
      settings: { theme: "", winType: "both", customSum: 11 },
      redraw: { lastPlayerId: null, streak: 0 },
    };

    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room:created", { roomId });
    systemMsg(roomId, `👑 ${rooms[roomId].players[socket.id].name} が部屋を作成しました（${roomId}）`);
    broadcastRoom(roomId);
  });

  socket.on("room:join", ({ roomId, name }) => {
    roomId = String(roomId || "").toUpperCase().trim();
    const r = rooms[roomId];
    if (!r) return socket.emit("error:msg", "部屋が見つかりません");
    if (Object.keys(r.players).length >= 2) return socket.emit("error:msg", "この部屋は満員です（2人専用）");
    if (r.phase !== "lobby") return socket.emit("error:msg", "ゲーム中の部屋には入れません（ホストに再戦してもらってね）");

    r.players[socket.id] = { name: safeName(name), card: null, word: "", wordLocked: false };
    socket.join(roomId);
    socket.data.roomId = roomId;

    systemMsg(roomId, `👤 ${r.players[socket.id].name} が入室しました`);
    broadcastRoom(roomId);
  });

  socket.on("settings:update", ({ theme, winType, customSum }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (socket.id !== r.hostId) return socket.emit("error:msg", "設定はホストのみ変更できます");
    if (r.phase !== "lobby") return socket.emit("error:msg", "ゲーム開始後は設定を変更できません");

    r.settings.theme = String(theme ?? r.settings.theme).slice(0, 60);
    if (["sum11", "same", "both", "custom"].includes(winType)) r.settings.winType = winType;
    const cs = Number(customSum);
    if (Number.isFinite(cs)) r.settings.customSum = cs;

    broadcastRoom(roomId);
  });

  socket.on("game:start", () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (socket.id !== r.hostId) return socket.emit("error:msg", "開始はホストのみできます");
    if (Object.keys(r.players).length !== 2) return socket.emit("error:msg", "2人そろってから開始できます");

    r.phase = "playing";
    r.redraw = { lastPlayerId: null, streak: 0 };

    for (const pid of Object.keys(r.players)) {
      r.players[pid].card = rollCard();
      r.players[pid].word = "";
      r.players[pid].wordLocked = false;
      io.to(pid).emit("card:mine", { card: r.players[pid].card });
    }

    systemMsg(roomId, `🎮 ゲーム開始！ お題：${r.settings.theme || "（未設定）"} / 条件：${condLabel(r.settings)}`);
    broadcastRoom(roomId);
  });

  socket.on("card:redraw", () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (r.phase !== "playing") return;

    const me = r.players[socket.id];
    if (!me) return;

    const last = r.redraw.lastPlayerId;
    const streak = r.redraw.streak;

    if (last === socket.id && streak >= 3) {
      return socket.emit("error:msg", "同じ人が連続で3回までです（相手が1回引くとリセット）");
    }

    if (last === socket.id) {
      r.redraw.streak += 1;
    } else {
      r.redraw.lastPlayerId = socket.id;
      r.redraw.streak = 1;
    }

    me.card = rollCard();
    io.to(socket.id).emit("card:mine", { card: me.card });

    systemMsg(roomId, `🔄 ${me.name} がカードを引き直しました`);
    broadcastRoom(roomId);
  });

  socket.on("word:submit", ({ word }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (r.phase !== "playing") return socket.emit("error:msg", "いまは送信できません");

    const me = r.players[socket.id];
    if (!me) return;

    if (me.wordLocked) return socket.emit("error:msg", "表現ワードは1回だけ送信できます（再戦でリセット）");

    const w = String(word || "").trim();
    if (!w) return socket.emit("error:msg", "表現ワードを入力してね");
    if (w.length > 60) return socket.emit("error:msg", "表現ワードは60文字まで");

    me.word = w;
    me.wordLocked = true;

    systemMsg(roomId, `📝 ${me.name} が表現ワードを送信しました`);
    broadcastRoom(roomId);
  });

  socket.on("game:challenge", () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (r.phase !== "playing") return;
    if (Object.keys(r.players).length !== 2) return;

    const ids = Object.keys(r.players);
    const pA = r.players[ids[0]];
    const pB = r.players[ids[1]];

    const success = computeSuccess(pA.card, pB.card, r.settings);
    r.phase = "result";

    io.to(roomId).emit("game:result", {
      success,
      theme: r.settings.theme || "（未設定）",
      condition: condLabel(r.settings),
      cards: [
        { name: pA.name, card: pA.card, word: pA.word || "" },
        { name: pB.name, card: pB.card, word: pB.word || "" }
      ],
      note: (!pA.word || !pB.word) ? "※表現ワードが未送信のまま挑戦しました" : ""
    });

    systemMsg(roomId, success ? "✅ 成功！" : "❌ 失敗…");
    broadcastRoom(roomId);
  });

  socket.on("chat:send", ({ text }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    const p = r.players[socket.id];
    if (!p) return;

    const msg = String(text || "").trim();
    if (!msg) return;
    if (msg.length > 200) return socket.emit("error:msg", "チャットは200文字までです");

    io.to(roomId).emit("chat:msg", { ts: Date.now(), name: p.name, text: msg, system: false });
  });

  socket.on("game:reset", () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (socket.id !== r.hostId) return socket.emit("error:msg", "ロビーに戻すのはホストのみできます");

    r.phase = "lobby";
    r.redraw = { lastPlayerId: null, streak: 0 };
    for (const pid of Object.keys(r.players)) {
      r.players[pid].card = null;
      r.players[pid].word = "";
      r.players[pid].wordLocked = false;
      io.to(pid).emit("card:mine", { card: null });
    }

    systemMsg(roomId, "🔁 ロビーに戻りました（設定変更できます）");
    broadcastRoom(roomId);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;

    const leaving = r.players[socket.id];
    delete r.players[socket.id];

    const remaining = Object.keys(r.players);

    if (leaving) systemMsg(roomId, `🚪 ${leaving.name} が退出しました`);

    if (remaining.length === 0) {
      delete rooms[roomId];
      return;
    }

    if (r.hostId === socket.id) {
      r.hostId = remaining[0];
      systemMsg(roomId, `👑 ホストが交代しました：${r.players[r.hostId].name}`);
    }

    r.phase = "lobby";
    r.redraw = { lastPlayerId: null, streak: 0 };
    for (const pid of Object.keys(r.players)) {
      r.players[pid].card = null;
      r.players[pid].word = "";
      r.players[pid].wordLocked = false;
      io.to(pid).emit("card:mine", { card: null });
    }

    broadcastRoom(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
