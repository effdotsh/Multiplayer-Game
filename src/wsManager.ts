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

let mssg = new Signal();

let sockets = new Map<string, { socket: WebSocket; player: Player }>();
let press_count: number = 0;

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
    console.log(mssg.players.length);
  }
  for await (const ev of ws) {
    console.log("reeee");
    //delete socket if connection closed
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    }

    mssg.players = updateMssg();
    sockets.forEach((user) => {
      let socket = user.socket;
      socket.send(JSON.stringify(mssg));
    });
  }
};

export { wsManager };
