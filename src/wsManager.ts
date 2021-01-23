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
  type: string = "all";
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
function tellPlayers(mesage: Signal) {
  let player_counter = 0;
  sockets.forEach((user) => {
    let socket = user.socket;
    mesage.you_are = player_counter;
    player_counter += 1;
    socket.send(JSON.stringify(mesage));
  });
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
    try {
      if (typeof ev === "string") {
        if (ev.includes("pos")) { //Handle player movement
          // Scale player movement to fit spee
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

          //tell players about the movement
          mssg.players = updateMssg();
          let small_mssg = new Signal();
          small_mssg.players = mssg.players;
          small_mssg.type = "players";
          tellPlayers(small_mssg);
        } else if (ev.includes("fire")) {
          let locs_str: string[] = ev.split("fire")[1].split(", ");
          let locs: number[] = [+locs_str[0], +locs_str[1]];
          let bullet: Bullet = new Bullet();
          bullet.x = locs[0];
          bullet.y = locs[1];
          mssg.bullets.push(bullet);

          //tell players bullets
          let small_mssg = new Signal();
          small_mssg.type = "bullets";
          small_mssg.bullets = mssg.bullets;
          tellPlayers(small_mssg);
        } else if (ev.includes("wake")) {
          mssg.type = "all";
          ws.send(JSON.stringify(mssg));
          console.log("wake");
        }
      }

      //delete socket if connection closed
      if (isWebSocketCloseEvent(ev)) {
        sockets.delete(uid);
      }
    } catch {}
  }
};

export { wsManager };
