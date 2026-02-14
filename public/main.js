"use strict";

const socket = io();

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

const nameInput = el("name");
const roomIdInput = el("roomId");
const btnCreate = el("btnCreate");
const btnJoin = el("btnJoin");

const roomShow = el("roomShow");
const btnCopy = el("btnCopy");

const playersList = el("players");
const themeInput = el("theme");
const winTypeSel = el("winType");
const customWrap = el("customWrap");
const customSumInput = el("customSum");
const btnStart = el("btnStart");
const startHint = el("startHint");

const themeShow = el("themeShow");
const condShow = el("condShow");
const myCard = el("myCard");
const btnRedraw = el("btnRedraw");
const redrawInfo = el("redrawInfo");

const wordInput = el("wordInput");
const btnWord = el("btnWord");
const wordStatus = el("wordStatus");

const btnChallenge = el("btnChallenge");

const btnReset = el("btnReset");
const resultText = el("resultText");
const themeResult = el("themeResult");
const condResult = el("condResult");
const noteResult = el("noteResult");
const cardsShow = el("cardsShow");

const chatLog = el("chatLog");
const chatText = el("chatText");
const btnSend = el("btnSend");

const chatLog2 = el("chatLog2");
const chatText2 = el("chatText2");
const btnSend2 = el("btnSend2");

const toast = el("toast");

let myId = null;
let roomId = null;
let myPrivateCard = null;

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function myName() {
  return (nameInput.value || "").trim() || "Player";
}

function parseRoomFromURL() {
  const params = new URLSearchParams(location.search);
  const r = (params.get("room") || "").toUpperCase().trim();
  if (r) roomIdInput.value = r;
}
parseRoomFromURL();

function condLabel(s) {
  if (!s) return "";
  switch (s.winType) {
    case "both": return "合計11 または 同じ数字";
    case "sum11": return "合計が11";
    case "same": return "同じ数字";
    case "custom": return `合計が ${Number(s.customSum || 11)}`;
    default: return "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  }[c]));
}

function appendChat(container, m) {
  const div = document.createElement("div");
  div.className = "msg" + (m.system ? " system" : "");
  const time = new Date(m.ts || Date.now());
  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const who = m.system ? "system" : m.name;
  div.innerHTML = `<span class="muted">[${hh}:${mm}]</span> <span class="who">${escapeHtml(who)}</span> ${escapeHtml(m.text)}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function tryUpdateSettings() {
  if (!roomId) return;
  socket.emit("settings:update", {
    theme: themeInput.value,
    winType: winTypeSel.value,
    customSum: Number(customSumInput.value),
  });
}

winTypeSel.addEventListener("change", () => {
  if (winTypeSel.value === "custom") customWrap.classList.remove("hidden");
  else customWrap.classList.add("hidden");
  tryUpdateSettings();
});
themeInput.addEventListener("input", tryUpdateSettings);
customSumInput.addEventListener("input", tryUpdateSettings);

btnCreate.onclick = () => socket.emit("room:create", { name: myName() });
btnJoin.onclick = () => {
  const rid = (roomIdInput.value || "").toUpperCase().trim();
  if (!rid) return toastMsg("ルームIDを入れてね");
  socket.emit("room:join", { roomId: rid, name: myName() });
};

btnCopy.onclick = async () => {
  if (!roomId) return;
  const url = `${location.origin}/?room=${roomId}`;
  try {
    await navigator.clipboard.writeText(url);
    toastMsg("URLをコピーしました");
  } catch {
    prompt("コピーできない場合はこれをコピー:", url);
  }
};

btnStart.onclick = () => socket.emit("game:start");
btnRedraw.onclick = () => socket.emit("card:redraw");
btnWord.onclick = () => socket.emit("word:submit", { word: wordInput.value });
btnChallenge.onclick = () => socket.emit("game:challenge");
btnReset.onclick = () => socket.emit("game:reset");

function sendChat(text) {
  socket.emit("chat:send", { text });
}

btnSend.onclick = () => {
  const t = chatText.value.trim();
  if (!t) return;
  sendChat(t);
  chatText.value = "";
};
chatText.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSend.click(); });

btnSend2.onclick = () => {
  const t = chatText2.value.trim();
  if (!t) return;
  sendChat(t);
  chatText2.value = "";
};
chatText2.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSend2.click(); });

socket.on("connect", () => { myId = socket.id; });

socket.on("room:created", ({ roomId: rid }) => {
  roomId = rid;
  roomShow.textContent = roomId;
  history.replaceState(null, "", `/?room=${roomId}`);
  hide("join"); show("lobby"); hide("game"); hide("result");
});

socket.on("room:state", (s) => {
  roomId = s.roomId;
  roomShow.textContent = roomId;

  playersList.innerHTML = "";
  for (const p of s.players) {
    const li = document.createElement("li");
    const crown = (p.id === s.hostId) ? "👑 " : "";
    li.textContent = `${crown}${p.name}`;
    playersList.appendChild(li);
  }

  const isHost = (myId && s.hostId === myId);
  themeInput.disabled = !isHost || s.phase !== "lobby";
  winTypeSel.disabled = !isHost || s.phase !== "lobby";
  customSumInput.disabled = !isHost || s.phase !== "lobby";
  btnStart.disabled = !isHost || s.phase !== "lobby" || s.players.length !== 2;

  startHint.textContent =
    s.players.length !== 2 ? "※2人そろうと開始できます" :
    !isHost ? "※ホストが開始できます" : "";

  themeInput.value = s.settings.theme ?? "";
  winTypeSel.value = s.settings.winType ?? "both";
  if (winTypeSel.value === "custom") customWrap.classList.remove("hidden");
  else customWrap.classList.add("hidden");
  customSumInput.value = s.settings.customSum ?? 11;

  themeShow.textContent = s.settings.theme || "（未設定）";
  condShow.textContent = condLabel(s.settings);

  const lastId = s.redraw?.lastPlayerId ?? null;
  const streak = s.redraw?.streak ?? 0;
  const myStreak = (lastId === myId) ? streak : 0;
  redrawInfo.textContent = `あなたの連続引き直し：${myStreak} / 3`;
  btnRedraw.disabled = (s.phase !== "playing") || (lastId === myId && streak >= 3);

  if (s.phase === "playing") {
    myCard.textContent = (myPrivateCard == null) ? "?" : String(myPrivateCard);

    const me = s.players.find(p => p.id === myId);
    const locked = me?.wordLocked ?? false;
    btnWord.disabled = locked;
    wordInput.disabled = locked;
    if (locked) wordInput.value = me?.word || wordInput.value;

    wordStatus.innerHTML = "";
    for (const p of s.players) {
      const li = document.createElement("li");
      const status = p.wordLocked ? "✅ 送信済み" : "⌛ 未送信";
      const word = p.wordLocked ? `「${p.word}」` : "";
      li.textContent = `${p.name}：${status} ${word}`;
      wordStatus.appendChild(li);
    }
  }

  if (s.phase === "lobby") { show("lobby"); hide("join"); hide("game"); hide("result"); }
  if (s.phase === "playing") { show("game"); hide("join"); hide("lobby"); hide("result"); }
  if (s.phase === "result") { show("result"); hide("join"); hide("lobby"); hide("game"); }
});

socket.on("card:mine", ({ card }) => {
  myPrivateCard = card;
  myCard.textContent = (card == null) ? "?" : String(card);
});

socket.on("chat:msg", (m) => {
  appendChat(chatLog, m);
  appendChat(chatLog2, m);
});

socket.on("game:result", ({ success, theme, condition, cards, note }) => {
  resultText.textContent = success ? "✅ 成功！" : "❌ 失敗…";
  themeResult.textContent = theme;
  condResult.textContent = condition;
  noteResult.textContent = note || "";

  const lines = [
    `<div class="msg">結果：<b>${success ? "成功" : "失敗"}</b></div>`,
    `<hr style="border:0;border-top:1px solid #232431;margin:10px 0;">`,
    ...cards.map(c => `<div class="msg"><span class="who">${escapeHtml(c.name)}</span>：カード <b>${c.card}</b> ／ ワード <b>${escapeHtml(c.word || "（未送信）")}</b></div>`)
  ];
  cardsShow.innerHTML = lines.join("");
});

socket.on("error:msg", (msg) => toastMsg(msg));
