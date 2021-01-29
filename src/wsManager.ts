import {
  acceptable,
  isWebSocketCloseEvent,
  WebSocket,
  WebSocketEvent,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";

//todo interface
let canvasX: number = 1000;
let canvasY: number = 1000;

class Player {
  x: number = Math.floor(Math.random() * canvasX);
  y: number = Math.floor(Math.random() * canvasY);
  failed_pings: number = 0;
  last_fired: number = Date.now();
  updateTime: number = Date.now();
  health = 100;
  score = 0;
  living: boolean = true;

  last_dash: number = 0;
  dash_from_x: number = 0;
  dash_from_y: number = 0;
}

class Bullet {
  x: number = 0;
  y: number = 0;
  angle: number[] = [0, 0];
  spawn_time: number = Date.now();
  update_time: number = Date.now();
  fired_by: string = "";
  id = gen_id();
}

class GameData {
  type: string = "pos";
  players: Player[] = new Array();
  bullets: Bullet[] = new Array();
  you_are: number = 0;
}

class Signal {
  type: string = "pos";
  info: any[] = new Array();
  you_are: number = 0;
}

const fire_rate: number = parseInt(Deno.env.get("FIRE_RATE") ?? "200");
const bullet_dmg: number = parseInt(Deno.env.get("BULLET_DMG") ?? "35");
const dash_cooldown: number = parseInt(Deno.env.get("DASH_COOLDOWN") ?? "1500");
const dash_distance: number = parseInt(Deno.env.get("DASH_DISTANCE") ?? "50");
const dash_time: number = parseInt(Deno.env.get("DASH_TIME") ?? "100");

let movement_speed: number = 5;
let bullet_speed: number = 15;
let bullet_despawn: number = 3000;

let mssg: GameData = new GameData();

let sockets = new Map<string, { socket: WebSocket; player: Player }>();

function gen_id(length: number = 10) {
  var randomChars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var result = "";
  for (var i = 0; i < length; i++) {
    result += randomChars.charAt(
      Math.floor(Math.random() * randomChars.length),
    );
  }
  return result;
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
    if (!socket.isClosed) {
      mesage.you_are = player_counter;
      player_counter += 1;
      try {
        socket.send(JSON.stringify(mesage));
      } catch {}
    } else {
      sockets.delete(uid);
    }
  });
}

function updatePositions(
  uid: string,
  ws: WebSocket,
  player: Player,
  ev: string,
  dash: number = 0,
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
  //dash
  player.x += dash * velocity[0];
  player.y += dash * velocity[1];

  velocity[0] *= time_multiplier;
  velocity[1] *= time_multiplier;
  player.x += velocity[0];
  player.y += velocity[1];
  player.x = player.x > canvasX
    ? player.x = canvasX
    : player.x < 0
    ? player.x = 0
    : player.x = player.x;

  player.y = player.y > canvasY
    ? player.y = canvasY
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
  let hit_list: string[] = new Array();
  let bullet_trash: string[] = new Array();
  bullets.forEach((bullet) => {
    users.forEach((user, uid) => {
      let player = user.player;
      if (
        bullet.fired_by != uid && Math.abs(bullet.x - player.x) < 37.5 &&
        Math.abs(bullet.y - player.y) < 37.5 &&
        player.living
      ) {
        hit_list.push(uid);
        bullet_trash.push(bullet.id);

        let hit = users.get(uid);
        if (hit != undefined && Date.now() - hit.player.last_dash > dash_time) {
          let dmg = dealDamage(hit.player);
          hit.player = dmg.player;
          if (dmg.killed) {
            let shooter = users.get(bullet.fired_by)?.player;
            if (shooter != undefined) {
              //@ts-ignore
              users.get(bullet.fired_by).player.score++;
            }
          }
        }
      }
    });
  });
  for (let b = 0; b < bullets.length; b++) {
    for (let d = 0; d < bullet_trash.length; d++) {
      if (bullets[b].id == bullet_trash[d]) {
        bullets.splice(b, 1);
      }
    }
  }
  return { users: users, bullets: bullets, bullet_trash: bullet_trash };
}
function dealDamage(player: Player): { player: Player; killed: boolean } {
  let killed = false;
  player.health -= bullet_dmg;
  if (player.health <= 0) {
    killed = true;
    player.health = 100;
    player.x = Math.floor(Math.random() * canvasX);
    player.y = Math.floor(Math.random() * canvasY);
    player.score = Math.round(player.score - player.score / 5);
  }
  return { player: player, killed: killed };
}
const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();
  if (!sockets.has(uid)) {
    sockets.set(uid, { socket: ws, player: new Player() });
  }
  for await (const ev of ws) {
    //@ts-ignore
    let player: Player = sockets.get(uid).player;
    if (isWebSocketCloseEvent(ev)) {
      sockets.delete(uid);
    } else if (player != undefined && !ws.isClosed) {
      //delete socket if connection closed
      if (typeof ev === "string") {
        if (ev.includes("pos")) { //Handle player movement
          if (Date.now() - player.last_dash > dash_time) {
            updatePositions(uid, ws, player, ev);
          }
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
            } catch (err) {
              console.log(err);
            }
          } else {
            sockets.delete(uid);
          }
        } else if (ev.includes("dash")) {
          let dash_vel = ev.replace("dash", "pos");
          if (Date.now() - player.last_dash >= dash_cooldown) {
            player.dash_from_x = player.x;

            player.dash_from_y = player.y;
            player.last_dash = Date.now();

            //@ts-ignore
            sockets.get(uid).player = player;
            updatePositions(uid, ws, player, dash_vel, dash_distance);
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

        //check collisions, despawn bullets
        let collisions = check_collisions(sockets, mssg.bullets);
        sockets = collisions.users;
        mssg.bullets = collisions.bullets;
        if (collisions.bullet_trash.length > 0) {
          let despawn_mmsg: Signal = new Signal();
          despawn_mmsg.type = "despawn";
          despawn_mmsg.info = collisions.bullet_trash;
          tellPlayers(despawn_mmsg);
        }
      }
    }
  }
};

export { wsManager };
