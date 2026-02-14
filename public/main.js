"use strict";

const socket = io();

const $ = id => document.getElementById(id);

const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

/* Elements */

const nameInput=$("name");
const roomIdInput=$("roomId");

const btnCreate=$("btnCreate");
const btnJoin=$("btnJoin");
const btnCopy=$("btnCopy");

const players=$("players");

const themeInput=$("theme");
const winType=$("winType");
const customSum=$("customSum");
const btnStart=$("btnStart");

const chatLog=$("chatLog");
const chatText=$("chatText");
const btnSend=$("btnSend");

const chatLog2=$("chatLog2");
const chatText2=$("chatText2");
const btnSend2=$("btnSend2");

const themeShow=$("themeShow");
const condShow=$("condShow");

const myCard=$("myCard");
const btnRedraw=$("btnRedraw");

const wordInput=$("wordInput");
const btnWord=$("btnWord");
const wordStatus=$("wordStatus");

const btnChallenge=$("btnChallenge");

const resultText=$("resultText");
const themeResult=$("themeResult");
const condResult=$("condResult");
const cardsShow=$("cardsShow");
const btnReset=$("btnReset");

let myId="";
let roomId="";

/* Utils */

function addChat(box,m){
 const d=document.createElement("div");
 d.className="msg";
 d.textContent=`[${m.name}] ${m.text}`;
 box.appendChild(d);
 box.scrollTop=box.scrollHeight;
}

function labelCond(s){
 if(s.winType==="sum11")return"合計11";
 if(s.winType==="same")return"同じ";
 if(s.winType==="both")return"合計11 or 同じ";
 if(s.winType==="custom")return"合計 "+s.customSum;
 return"";
}

/* Buttons */

btnCreate.onclick=()=>{

 if(!nameInput.value.trim()){
  alert("名前を入力して");
  return;
 }

 socket.emit("room:create",{
  name:nameInput.value
 });
};

btnJoin.onclick=()=>{

 if(!nameInput.value.trim()){
  alert("名前を入力して");
  return;
 }

 socket.emit("room:join",{
  roomId:roomIdInput.value,
  name:nameInput.value
 });
};

btnCopy.onclick=()=>{
 const url=location.origin+"/room/"+roomId;
 prompt("コピーして送ってね",url);
};

btnStart.onclick=()=>socket.emit("game:start");
btnRedraw.onclick=()=>socket.emit("card:redraw");

btnWord.onclick=()=>{
 socket.emit("word:submit",{word:wordInput.value});
};

btnChallenge.onclick=()=>socket.emit("game:challenge");
btnReset.onclick=()=>socket.emit("game:reset");

/* Chat */

btnSend.onclick=()=>{
 if(!chatText.value)return;
 socket.emit("chat:send",{text:chatText.value});
 chatText.value="";
};

btnSend2.onclick=()=>{
 if(!chatText2.value)return;
 socket.emit("chat:send",{text:chatText2.value});
 chatText2.value="";
};

/* Settings */

themeInput.oninput=
winType.onchange=
customSum.oninput=()=>{

 socket.emit("settings:update",{
  theme:themeInput.value,
  winType:winType.value,
  customSum:customSum.value
 });
};

/* Socket */

socket.on("connect",()=>{
 myId=socket.id;
});

socket.on("room:created",d=>{

 roomId=d.roomId;

 $("roomShow").textContent=roomId;

 hide("join");
 show("lobby");
});

socket.on("room:state",s=>{

 roomId=s.roomId;

 $("roomShow").textContent=roomId;

 players.innerHTML="";

 s.players.forEach(p=>{
  const li=document.createElement("li");
  li.textContent=
   (p.id===s.hostId?"👑 ":"")+p.name;
  players.appendChild(li);
 });

 themeInput.value=s.settings.theme||"";
 winType.value=s.settings.winType;
 customSum.value=s.settings.customSum;

 btnStart.disabled=
  s.players.length!==2||
  myId!==s.hostId||
  s.phase!=="lobby";

 themeShow.textContent=s.settings.theme;
 condShow.textContent=labelCond(s.settings);

 wordStatus.innerHTML="";

 s.players.forEach(p=>{
  const li=document.createElement("li");
  li.textContent=
   p.name+"："+(p.word?"済":"未");
  wordStatus.appendChild(li);
 });

 if(s.phase==="lobby"){
  show("lobby");hide("game");hide("result");
 }

 if(s.phase==="playing"){
  show("game");hide("lobby");hide("result");
 }

 if(s.phase==="result"){
  show("result");hide("lobby");hide("game");
 }
});

socket.on("card:mine",n=>{
 myCard.textContent=n;
});

socket.on("chat:msg",m=>{
 addChat(chatLog,m);
 addChat(chatLog2,m);
});

socket.on("game:result",r=>{

 resultText.textContent=
  r.success?"成功！":"失敗…";

 themeResult.textContent=r.theme;
 condResult.textContent=r.condition;

 cardsShow.innerHTML="";

 r.cards.forEach(c=>{
  const p=document.createElement("p");
  p.textContent=
   `${c.name}：${c.card}（${c.word}）`;
  cardsShow.appendChild(p);
 });
});

/* Auto Join */

window.onload=()=>{

 if(location.pathname.startsWith("/room/")){

  const r=location.pathname.split("/")[2];

  if(r){
   roomIdInput.value=r;
  }
 }
};
