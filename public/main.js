"use strict";

const socket = io();

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

/* ===== Elements ===== */

const nameInput = $("name");
const roomIdInput = $("roomId");

const btnCreate = $("btnCreate");
const btnJoin = $("btnJoin");

const roomShow = $("roomShow");
const btnCopy = $("btnCopy");

const players = $("players");

const themeInput = $("theme");
const winType = $("winType");
const customWrap = $("customWrap");
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
const redrawInfo = $("redrawInfo");

const wordInput = $("wordInput");
const btnWord = $("btnWord");
const wordStatus = $("wordStatus");

const btnChallenge = $("btnChallenge");

const resultText = $("resultText");
const themeResult = $("themeResult");
const condResult = $("condResult");
const cardsShow = $("cardsShow");
const btnReset = $("btnReset");

/* ===== State ===== */

let myId = "";
let roomId = "";
let myCardNum = null;

/* ===== Utils ===== */

function addChat(box, m) {
  const div = document.createElement("div");
  div.className = "msg" + (m.system ? " system" : "");
  div.textContent = `[${m.name}] ${m.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function labelCond(s) {
  if (s.winType === "sum11") return "合計11";
  if (s.winType === "same") return "同じ数字";
  if (s.winType === "both") return "合計11 or 同じ";
  if (s.winType === "custom") return "合計 " + s.customSum;
  return "";
}

/* ===== Events ===== */

btnCreate.onclick = () => {
  socket.emit("room:create", {
    name: nameInput.value || "Player"
  });
};

btnJoin.onclick = () => {
  socket.emit("room:join", {
    roomId: roomIdInput.value,
    name: nameInput.value || "Player"
  });
};

btnCopy.onclick = async () => {
  if (!roomId) return;

  const url = location.origin + "/?room=" + roomId;

  await navigator.clipboard.writeText(url);

  alert("コピーしました");
};

btnStart.onclick = () => socket.emit("game:start");

btnRedraw.onclick = () => socket.emit("card:redraw");

btnWord.onclick = () => {
  socket.emit("word:submit", {
    word: wordInput.value
  });
};

btnChallenge.onclick = () => socket.emit("game:challenge");

btnReset.onclick = () => socket.emit("game:reset");

/* Chat */

btnSend.onclick = () => {
  if (!chatText.value) return;
  socket.emit("chat:send", { text: chatText.value });
  chatText.value = "";
};

btnSend2.onclick = () => {
  if (!chatText2.value) return;
  socket.emit("chat:send", { text: chatText2.value });
  chatText2.value = "";
};

/* Settings */

themeInput.oninput =
winType.onchange =
customSum.oninput = () => {

  socket.emit("settings:update", {
    theme: themeInput.value,
    winType: winType.value,
    customSum: customSum.value
  });
};

/* ===== Socket ===== */

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("room:created", d => {
  roomId = d.roomId;

  roomShow.textContent = roomId;

  hide("join");
  show("lobby");
});

socket.on("room:state", s => {

  roomId = s.roomId;

  roomShow.textContent = roomId;

  /* Players */
  players.innerHTML = "";

  s.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent =
      (p.id === s.hostId ? "👑 " : "") + p.name;
    players.appendChild(li);
  });

  /* Settings */
  themeInput.value = s.settings.theme || "";
  winType.value = s.settings.winType || "both";
  customSum.value = s.settings.customSum || 11;

  if (winType.value === "custom")
    customWrap.classList.remove("hidden");
  else
    customWrap.classList.add("hidden");

  btnStart.disabled =
    s.players.length !== 2 ||
    myId !== s.hostId ||
    s.phase !== "lobby";

  /* Game header */
  themeShow.textContent = s.settings.theme;
  condShow.textContent = labelCond(s.settings);

  /* Redraw */
  const last = s.redraw.last;
  const cnt = s.redraw.count;

  btnRedraw.disabled =
    s.phase !== "playing" ||
    (last === myId && cnt >= 3);

  redrawInfo.textContent =
    (last === myId)
      ? `連続 ${cnt}/3`
      : "";

  /* Word status */
  wordStatus.innerHTML = "";

  s.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent =
      p.name + "：" +
      (p.word ? "送信済み" : "未送信");
    wordStatus.appendChild(li);
  });

  /* Screen */
  if (s.phase === "lobby") {
    show("lobby"); hide("game"); hide("result");
  }
  if (s.phase === "playing") {
    show("game"); hide("lobby"); hide("result");
  }
  if (s.phase === "result") {
    show("result"); hide("lobby"); hide("game");
  }
});

socket.on("card:mine", n => {
  myCardNum = n;
  myCard.textContent = n;
});

socket.on("chat:msg", m => {
  addChat(chatLog, m);
  addChat(chatLog2, m);
});

socket.on("game:result", r => {

  resultText.textContent =
    r.success ? "成功！" : "失敗…";

  themeResult.textContent = r.theme;
  condResult.textContent = r.condition;

  cardsShow.innerHTML = "";

  r.cards.forEach(c => {
    const p = document.createElement("p");
    p.textContent =
      `${c.name}：${c.card}（${c.word}）`;
    cardsShow.appendChild(p);
  });
});
