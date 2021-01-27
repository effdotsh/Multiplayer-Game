import {
  acceptable,
  isWebSocketCloseEvent,
  WebSocket,
  WebSocketEvent,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.83.0/uuid/mod.ts";

//todo interface

class Player {
  x: number = 0;
  y: number = 0;
  failed_pings: number = 0;
  last_fired: number = Date.now();
  updateTime: number = Date.now();
  living: boolean = true;
}

class Bullet {
  x: number = 0;
  y: number = 0;
  angle: number[] = [0, 0];
  spawn_time: number = Date.now();
  update_time: number = Date.now();
  fired_by: string = "";
}

class GameData {
  type: string = "all";
  players: Player[] = new Array();
  bullets: Bullet[] = new Array();
  you_are: number = 0;
}

class Signal {
  type: string = "all";
  info: any[] = new Array();
  you_are: number = 0;
}

//@ts-ignore
let fire_rate: number = +Deno.env.get("FIRE_RATE") || 200;

let movement_speed: number = 5;
let bullet_speed: number = 15;
let bullet_despawn: number = 3000;

let canvasX: number = 1000;
let canvasY: number = 1000;

let mssg: GameData = new GameData();

let sockets = new Map<string, { socket: WebSocket; player: Player }>();

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

function updateMssg() {
  let players: Player[] = [];
  sockets.forEach((connection: { socket: WebSocket; player: Player }) => {
    players.push(connection.player);
  });
  return players;
}

function tellPlayers(mesage: Signal) {
  let player_counter = 0;
  sockets.forEach((user, uid) => {
    let socket = user.socket;
    try {
      if (!socket.isClosed) {
        mesage.you_are = player_counter;
        player_counter += 1;
        socket.send(JSON.stringify(mesage));
      } else {
        sockets.delete(uid);
      }
    } catch {
      user.player.failed_pings++;
      if (user.player.failed_pings > 100) {
        sockets.delete(uid);
      }
    }
  });
}

function updatePositions(
  uid: string,
  ws: WebSocket,
  player: Player,
  ev: string,
) {
  // Scale player movement to fit spee
  let velocity_input: string[] = ev.split("pos")[1].split(",");
  let velocity: number[] = bindVector(
    +velocity_input[0],
    +velocity_input[1],
    movement_speed,
  );

  //move player
  let time_multiplier = (Date.now() - player.updateTime) / 20;
  player.updateTime = Date.now();
  velocity[0] *= time_multiplier;
  velocity[1] *= time_multiplier;
  player.x += velocity[0];
  player.y += velocity[1];
  player.x = player.x > 1000
    ? player.x = 1000
    : player.x < 0
    ? player.x = 0
    : player.x = player.x;

  player.y = player.y > 1000
    ? player.y = 1000
    : player.y < 0
    ? player.y = 0
    : player.y = player.y;

  sockets.set(uid, { socket: ws, player: player });

  //tell players about the movement
  mssg.players = updateMssg();
  let small_mssg = new Signal();
  small_mssg.info = mssg.players;
  small_mssg.type = "players";
  tellPlayers(small_mssg);
}

function fire_bullet(
  uid: string,
  ws: WebSocket,
  player: Player,
  ev: string,
) {
  if (Date.now() - player.last_fired > fire_rate) {
    //@ts-ignore
    sockets.get(uid).player.last_fired = Date.now();
    let locs_str: string[] = ev.split("fire")[1].split(", ");
    let locs: number[] = [+locs_str[0], +locs_str[1]];
    let bullet: Bullet = new Bullet();
    // @ts-ignore
    let player = sockets.get(uid).player;
    bullet.x = player.x;
    bullet.y = player.y;
    bullet.angle = bindVector(
      locs[0] - bullet.x,
      locs[1] - bullet.y,
      bullet_speed,
    );
    bullet.fired_by = uid;
    mssg.bullets.push(bullet);

    let bullet_mssg = new Signal();
    bullet_mssg.type = "bullets";
    bullet_mssg.info = [bullet];
    tellPlayers(bullet_mssg);
  }
}

function check_collisions(
  users: Map<string, { socket: WebSocket; player: Player }>,
  bullets: Bullet[],
) {
  let kill_list: string[] = new Array();

  bullets.forEach((bullet) => {
    users.forEach((user, uid) => {
      let player = user.player;
      if (
        bullet.fired_by != uid && Math.abs(bullet.x - player.x) < 50 &&
        Math.abs(bullet.y - player.y) < 50 &&
        player.living
      ) {
        kill_list.push(uid);
      }
    });
  });
  kill_list.forEach((target) => {
    let bob = users.get(target);
    if (bob != undefined) {
      bob.player.living = false;
    }
  });

  return users;
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
    // @ts-ignore
    let player = sockets.get(uid).player;

    //delete socket if connection closed
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    } else if (typeof ev === "string") {
      if (ev.includes("pos")) { //Handle player movement
        updatePositions(uid, ws, player, ev);
      } else if (ev.includes("fire") && player.living) {
        fire_bullet(uid, ws, player, ev);
      } else if (ev.includes("wake")) {
        if (!ws.isClosed) {
          try {
            let dummy_mssg = new Signal();
            dummy_mssg.type = "players";
            dummy_mssg.info.push(mssg.players);
            ws.send(JSON.stringify(dummy_mssg));
            dummy_mssg.type = "bullets";
            dummy_mssg.info.push(mssg.bullets);
            ws.send(JSON.stringify(mssg));
          } catch {}
        } else {
          sockets.delete(uid);
        }
      }

      //move bullets and despawn old ones
      let bullet_counter: number = 0;
      for (const bullet of mssg.bullets) {
        if (Date.now() - bullet.spawn_time > bullet_despawn) {
          if (mssg.bullets.length > 1) {
            mssg.bullets.splice(bullet_counter, bullet_counter);
          } else {
            mssg.bullets.pop();
          }
        } else {
          bullet.x += bullet.angle[0] *
            ((Date.now() - bullet.update_time) / 20);
          bullet.y += bullet.angle[1] *
            ((Date.now() - bullet.update_time) / 20);
          bullet.update_time = Date.now();
        }
        bullet_counter += 1;
      }

      sockets = check_collisions(sockets, mssg.bullets);
    }
  }
};

export { wsManager };
