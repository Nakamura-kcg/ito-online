"use strict";

const socket = io();

const $ = id => document.getElementById(id);

const nameInput = $("name");
const roomIdInput = $("roomId");
const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");
const btnStart = $("btnStart");
const btnSend = $("btnSend");
const chatText = $("chatText");
const chatLog = $("chatLog");

if (!btnCreate || !btnJoin) {
  console.error("HTML ID mismatch. Check index.html.");
}

/* Create */
btnCreate.onclick = () => {
  if (!nameInput.value.trim()) {
    alert("名前を入力して");
    return;
  }

  socket.emit("room:create", {
    name: nameInput.value
  });
};

/* Join */
btnJoin.onclick = () => {
  if (!nameInput.value.trim()) {
    alert("名前を入力して");
    return;
  }

  socket.emit("room:join", {
    roomId: roomIdInput.value,
    name: nameInput.value
  });
};

/* Chat */
btnSend.onclick = () => {
  if (!chatText.value.trim()) return;

  socket.emit("chat:send", {
    text: chatText.value
  });

  chatText.value = "";
};

socket.on("chat:msg", m => {
  const d = document.createElement("div");
  d.className = "msg";
  d.textContent = `[${m.name}] ${m.text}`;
  chatLog.appendChild(d);
});
