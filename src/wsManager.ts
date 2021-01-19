import {
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";
//todo interface
class Signal {
  players = new Array();
}

class Player {
  x = 0;
  y = 0;
}

let speed = 5;

let mssg = new Signal();

let sockets = new Map<string, { socket: WebSocket; player: Player }>();

function updateMssg() {
  let players: Player[] = [];
  sockets.forEach((connection) => {
    players.push(connection.player);
  });
  return players;
}

const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();
  if (!sockets.has(uid)) {
    sockets.set(uid, { socket: ws, player: new Player() });
  }
  for await (const ev of ws) {
    if (typeof ev === "string") {
      if (ev.includes("pos")) { //Handle player movement
        // Scale player movement to fit speed
        let velocity = ev.split("pos")[1].split(",");
        let opX = Math.abs(+velocity[0]);
        let opY = Math.abs(+velocity[1]);
        let scaler = 1;
        if (opX + opY != 0) {
          scaler = (speed / (opX + opY));
        }
        let velX = +velocity[0] * scaler;
        let velY = +velocity[1] * scaler;

        //move player
        // @ts-ignore
        let player = sockets.get(uid).player;
        player.x += velX;
        player.y += velY;
        sockets.set(uid, { socket: ws, player: player });
      }
    }

    //delete socket if connection closed
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    }

    mssg.players = updateMssg();
    sockets.forEach((user) => {
      let socket = user.socket;
      try {
        socket.send(JSON.stringify(mssg));
      } catch {}
    });
  }
};

export { wsManager };
