const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 静的ファイル
app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function randomCard() {
  return Math.floor(Math.random() * 10) + 1;
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("createRoom", (name, cb) => {
    const id = Math.random().toString(36).substr(2, 5);

    rooms[id] = {
      host: socket.id,
      players: {},
      started: false,
      theme: "",
      rule: "11",
    };

    rooms[id].players[socket.id] = {
      name,
      card: randomCard(),
      word: "",
      redraw: 0,
    };

    socket.join(id);
    cb(id);
    io.to(id).emit("roomUpdate", rooms[id]);
  });

  socket.on("joinRoom", (roomId, name, cb) => {
    const room = rooms[roomId];
    if (!room || Object.keys(room.players).length >= 2) {
      cb(false);
      return;
    }

    room.players[socket.id] = {
      name,
      card: randomCard(),
      word: "",
      redraw: 0,
    };

    socket.join(roomId);
    cb(true);
    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("startGame", (roomId, theme, rule) => {
    const room = rooms[roomId];
    if (!room || room.host !== socket.id) return;

    room.started = true;
    room.theme = theme;
    room.rule = rule;

    io.to(roomId).emit("gameStarted", room);
  });

  socket.on("sendWord", (roomId, word) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].word = word;
    io.to(roomId).emit("roomUpdate", room);
  });

  socket.on("challenge", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const ps = Object.values(room.players);

    let success = false;

    if (room.rule === "same") {
      success = ps[0].card === ps[1].card;
    } else {
      success = ps[0].card + ps[1].card === 11;
    }

    io.to(roomId).emit("result", {
      success,
      players: ps,
      theme: room.theme,
    });
  });

  socket.on("chat", (roomId, msg) => {
    io.to(roomId).emit("chat", msg);
  });

  socket.on("disconnect", () => {
    for (const id in rooms) {
      if (rooms[id].players[socket.id]) {
        delete rooms[id].players[socket.id];
        io.to(id).emit("roomUpdate", rooms[id]);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
