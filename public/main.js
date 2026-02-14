
const s=io();

let room=null;

function create(){
 s.emit("room:create",{name:document.getElementById("name").value});
}

function join(){
 s.emit("room:join",{
  roomId:document.getElementById("room").value,
  name:document.getElementById("name").value
 });
}

function start(){ s.emit("game:start"); }
function redraw(){ s.emit("redraw"); }

s.on("room:created",(d)=>{
 room=d.roomId;
 document.getElementById("join").style.display="none";
 document.getElementById("game").style.display="block";
 document.getElementById("info").innerText="ROOM:"+room;
});

s.on("room:state",(r)=>{
 document.getElementById("join").style.display="none";
 document.getElementById("game").style.display="block";
});

s.on("card",(c)=>{
 document.getElementById("card").innerText=c;
});
