"use strict";

const socket = io();
const $ = id => document.getElementById(id);

/* ===== Elements ===== */
const nameInput = $("name");
const roomIdInput = $("roomId");

const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");
const btnCopy = $("btnCopy");

const players = $("players");

const themeInput = $("theme");
const winType = $("winType");
const customSum = $("customSum");
const btnStart = $("btnStart");

const chatLog = $("chatLog");
const chatText = $("chatText");
const btnSend = $("btnSend");

const chatLog2 = $("chatLog2");
const chatText2 = $("chatText2");
const btnSend2 = $("btnSend2");

const themeShow = $("themeShow");
const condShow = $("condShow");

const myCard = $("myCard");
const btnRedraw = $("btnRedraw");

const wordInput = $("wordInput");
const btnWord = $("btnWord");
const wordStatus = $("wordStatus");

const btnChallenge = $("btnChallenge");

const resultText = $("resultText");
const themeResult = $("themeResult");
const condResult = $("condResult");
const cardsShow = $("cardsShow");

/* ===== Safety check ===== */
if (!btnCreate || !btnJoin || !btnSend) {
  console.error("HTML IDs did not match — check index.html");
}

/* ===== Event Attach ===== */
btnCreate.onclick = () => {
  if (!nameInput.value.trim()) return alert("名前を入力してね");
  socket.emit("room:create", { name: nameInput.value });
};

btnJoin.onclick = () => {
  if (!nameInput.value.trim()) return alert("名前を入力してね");
  socket.emit("room:join", {
    roomId: roomIdInput.value,
    name: nameInput.value
  });
};

btnSend.onclick = sendChat;
btnSend2.onclick = sendChat;

function sendChat() {
  const t = document.activeElement === chatText2
    ? chatText2.value
    : chatText.value;

  if (!t.trim()) return;
  socket.emit("chat:send", { text: t });
  chatText.value = "";
  chatText2.value = "";
}

/* ===== Socket ===== */
socket.on("room:created", ({ roomId }) => {
  $("roomShow").textContent = roomId;
  document.getElementById("join").classList.add("hidden");
  document.getElementById("lobby").classList.remove("hidden");
});

socket.on("room:state", s => {
  $("roomShow").textContent = s.roomId;

  players.innerHTML = "";
  s.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = (p.id === s.hostId ? "👑 " : "") + p.name;
    players.appendChild(li);
  });

  themeInput.value = s.settings.theme;
  winType.value = s.settings.winType;
  customSum.value = s.settings.customSum;

  themeInput.disabled = s.hostId !== socket.id;
  winType.disabled = s.hostId !== socket.id;
  customSum.disabled = s.hostId !== socket.id;

  btnStart.disabled = !(s.players.length === 2);

  themeShow.textContent = s.settings.theme;
  condShow.textContent = s.settings.winType;

  wordStatus.innerHTML = "";
  s.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name}：${p.word || "未"}`;
    wordStatus.appendChild(li);
  });

  if (s.phase === "playing") {
    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
  }
});

socket.on("chat:msg", m => {
  addChat(chatLog, m);
  addChat(chatLog2, m);
});

function addChat(box, m) {
  const d = document.createElement("div");
  d.className = "msg" + (m.system ? " system" : "");
  d.textContent = `[${m.name}] ${m.text}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
