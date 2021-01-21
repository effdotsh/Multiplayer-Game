import {
  isWebSocketCloseEvent,
  WebSocket,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";
//todo interface

class Player {
  x: number = 0;
  y: number = 0;
}

class Bullet {
  x: number = 0;
  y: number = 0;
  slope: number = 0;
}
class Signal {
  players: Player[] = new Array();
  bullets: Bullet[] = new Array();
  you_are: number = 0;
}

function bindVector(x: number, y: number, magnitude: number = 1): number[] {
  //scale x and y to values < 1
  if (x != 0 && y != 0) {
    let scaler: number = magnitude /
      Math.sqrt(Math.pow(Math.abs(x), 2) + Math.pow(Math.abs(y), 2));
    x *= scaler;
    y *= scaler;
  } else {
    x = x <= -magnitude ? -magnitude : x >= magnitude ? magnitude : x;
    y = y <= -magnitude ? -magnitude : y >= magnitude ? magnitude : y;
  }

  return [x, y];
}

let speed: number = 10;
let canvasX: number = 1000;
let canvasY: number = 1000;

let mssg: Signal = new Signal();

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
    let newPlayer = new Player();
    newPlayer.x = Math.floor(Math.random() * canvasX);
    newPlayer.y = Math.floor(Math.random() * canvasY);

    sockets.set(uid, { socket: ws, player: newPlayer });
  }
  for await (const ev of ws) {
    if (typeof ev === "string") {
      if (ev.includes("pos")) { //Handle player movement
        // Scale player movement to fit speed
        let velocity_input: string[] = ev.split("pos")[1].split(",");
        let velocity: number[] = bindVector(
          +velocity_input[0],
          +velocity_input[1],
          speed,
        );

        //move player
        // @ts-ignore
        let player = sockets.get(uid).player;
        player.x += velocity[0];
        player.y += velocity[1];
        sockets.set(uid, { socket: ws, player: player });
      }
    }

    //delete socket if connection closed
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    }

    mssg.players = updateMssg();
    let player_counter = 0;
    sockets.forEach((user) => {
      let socket = user.socket;
      try {
        mssg.you_are = player_counter;
        player_counter += 1;
        socket.send(JSON.stringify(mssg));
      } catch {}
    });
  }
};

export { wsManager };
