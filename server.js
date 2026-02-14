
// (Shortened: full version from chat)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const rooms = {};

function roll(){ return 1+Math.floor(Math.random()*10); }

io.on("connection",(s)=>{
  s.on("room:create",({name})=>{
    const id = Math.random().toString(36).slice(2,6).toUpperCase();
    rooms[id]={
      host:s.id,
      players:{[s.id]:{name,card:null}},
      phase:"lobby",
      redraw:{last:null,count:0}
    };
    s.join(id);
    s.room=id;
    s.emit("room:created",{roomId:id});
    io.to(id).emit("room:state",rooms[id]);
  });

  s.on("room:join",({roomId,name})=>{
    const r=rooms[roomId];
    if(!r||Object.keys(r.players).length>=2)return;
    r.players[s.id]={name,card:null};
    s.join(roomId);
    s.room=roomId;
    io.to(roomId).emit("room:state",r);
  });

  s.on("game:start",()=>{
    const r=rooms[s.room];
    if(!r||s.id!==r.host)return;
    r.phase="playing";
    for(const id in r.players){
      r.players[id].card=roll();
      io.to(id).emit("card",r.players[id].card);
    }
    io.to(s.room).emit("room:state",r);
  });

  s.on("redraw",()=>{
    const r=rooms[s.room];
    if(!r||r.phase!=="playing")return;

    if(r.redraw.last===s.id){
      if(r.redraw.count>=3)return;
      r.redraw.count++;
    }else{
      r.redraw.last=s.id;
      r.redraw.count=1;
    }

    r.players[s.id].card=roll();
    s.emit("card",r.players[s.id].card);
    io.to(s.room).emit("room:state",r);
  });

  s.on("disconnect",()=>{
    const r=rooms[s.room];
    if(!r)return;
    delete r.players[s.id];
    if(Object.keys(r.players).length===0)delete rooms[s.room];
    else io.to(s.room).emit("room:state",r);
  });
});

server.listen(PORT,()=>console.log("Running:",PORT));
