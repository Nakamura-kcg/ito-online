"use strict";

const socket = io();
const $ = id => document.getElementById(id);

/* ===== 要素取得 ===== */
const nameInput = $("name");
const roomIdInput = $("roomId");

const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");
const btnStart = $("btnStart");
const btnSend = $("btnSend");
const btnSend2 = $("btnSend2");

const chatText = $("chatText");
const chatText2 = $("chatText2");

const chatLog = $("chatLog");
const chatLog2 = $("chatLog2");

/* ===== 安全イベント登録 ===== */
if (btnCreate) {
  btnCreate.onclick = () => {
    if (!nameInput.value.trim()) {
      alert("名前を入力してね");
      return;
    }

    socket.emit("room:create", {
      name: nameInput.value
    });
  };
}

if (btnJoin) {
  btnJoin.onclick = () => {
    if (!nameInput.value.trim()) {
      alert("名前を入力してね");
      return;
    }

    socket.emit("room:join", {
      roomId: roomIdInput.value,
      name: nameInput.value
    });
  };
}

if (btnSend) btnSend.onclick = sendChat;
if (btnSend2) btnSend2.onclick = sendChat;

function sendChat() {

  let t = "";

  if (chatText && document.activeElement === chatText) {
    t = chatText.value;
  } else if (chatText2) {
    t = chatText2.value;
  }

  if (!t.trim()) return;

  socket.emit("chat:send", { text: t });

  if (chatText) chatText.value = "";
  if (chatText2) chatText2.value = "";
}

/* ===== チャット受信 ===== */
socket.on("chat:msg", m => {

  const d = document.createElement("div");
  d.className = "msg";
  d.textContent = `[${m.name}] ${m.text}`;

  if (chatLog) chatLog.appendChild(d);
  if (chatLog2) chatLog2.appendChild(d);
});
