import {
  acceptable,
  isWebSocketCloseEvent,
  WebSocket,
  WebSocketEvent,
} from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import "https://deno.land/x/dotenv/load.ts";

let canvasX: number = 2144;
let canvasY: number = 1047;

class Player {
  id = gen_id();
  name: string = "";
  x: number = Math.floor(Math.random() * canvasX);
  y: number = Math.floor(Math.random() * canvasY);
  vel_x: number = 0;
  vel_y: number = 0;
  failed_pings: number = 0;
  last_fired: number = Date.now();
  updateTime: number = Date.now();
  health: number = 100;
  score: number = 0;
  living: boolean = true;

  last_dash: number = 0;
  dash_from_x: number = 0;
  dash_from_y: number = 0;

  death_time: number = 0;

  spectating: boolean = false;

  color: string = "#" +
    ("000000" + Math.floor(Math.random() * 16777215).toString(16)).slice(-6);

  timeout_update: number = Date.now();
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
const respawn_time: number = parseInt(Deno.env.get("RESPAWN_TIME") ?? "3000");
const two_respawn: number = parseInt(
  Deno.env.get("2P_RESPAWN_TIME") ?? (respawn_time / 2).toString(),
);
const fire_rate: number = parseInt(Deno.env.get("FIRE_RATE") ?? "400");
const bullet_dmg: number = parseInt(Deno.env.get("BULLET_DMG") ?? "35");
const dash_cooldown: number = parseInt(Deno.env.get("DASH_COOLDOWN") ?? "1000");
const dash_distance: number = parseInt(Deno.env.get("DASH_DISTANCE") ?? "50");
const dash_time: number = parseInt(Deno.env.get("DASH_TIME") ?? "150");
const movement_speed: number = parseInt(Deno.env.get("PLAYER_SPEED") ?? "5");
const bullet_speed: number = parseInt(Deno.env.get("BULLET_SPEED") ?? "15");

const health_regen: number = parseInt(Deno.env.get("HEALTH_REGEN") ?? "0");

const timeout: number = parseInt(Deno.env.get("TIMEOUT") ?? "60000");

const bullet_despawn: number = parseInt(
  Deno.env.get("BULLET_DESPAWN") ?? "5000",
);

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
      Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
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
  sockets.forEach((connection) => {
    players.push(connection.player);
  });
  return players;
}
async function send_signal(ws: WebSocket, message: string) {
  if (!ws.isClosed) {
    try {
      await ws.send(message);
    } catch {
    }
  }
}

async function tellPlayers(message: Signal) {
  let player_counter = 0;
  // sockets.forEach((user, uid) => {
  for (const [uid, user] of sockets.entries()) {
    let socket = user.socket;
    if (!socket.isClosed) {
      message.you_are = player_counter;
      player_counter += 1;
      await send_signal(socket, JSON.stringify(message));
    } else {
      sockets.delete(uid);
      await updatePlayers();
    }
  }
}

function updatePositions(
  uid: string,
  ws: WebSocket,
  player: Player,
  dash: number = 0,
) {
  let velocity = [player.vel_x, player.vel_y];
  //move player
  let time_multiplier = (Date.now() - player.updateTime) / 20;

  //regen health
  player.health += (Date.now() - player.updateTime) / 1000 * health_regen;
  player.health = Math.min(player.health, 100);

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
}
async function updateVelocity(
  uid: string,
  ws: WebSocket,
  player: Player,
  ev: string,
  dash: number = 0,
) {
  // Scale player movement to fit spee
  let velocity_input: string[] = ev.split("vel")[1].split(",");
  let velocity: number[] = bindVector(
    +velocity_input[0],
    +velocity_input[1],
    movement_speed,
  );

  player.vel_x = velocity[0];
  player.vel_y = velocity[1];
  sockets.set(uid, { socket: ws, player: player });

  await updatePlayers();
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
    //  player = sockets.get(uid).player;
    bullet.x = player.x;
    bullet.y = player.y;
    bullet.angle = bindVector(
      locs[0],
      locs[1],
      bullet_speed,
    );
    bullet.fired_by = player.id;
    mssg.bullets.push(bullet);

    let bullet_mssg = new Signal();
    bullet_mssg.type = "bullets";
    bullet_mssg.info = [bullet];
    tellPlayers(bullet_mssg);
  }
}

async function check_collisions(
  users: Map<string, { socket: WebSocket; player: Player }>,
  bullets: Bullet[],
) {
  let hit_list: string[] = new Array();
  let bullet_trash: string[] = new Array();

  for (const bullet of bullets) {
    for (const [uid, user] of users.entries()) {
      let player = user.player;
      if (
        bullet.fired_by != player.id && Math.abs(bullet.x - player.x) < 37.5 &&
        Math.abs(bullet.y - player.y) < 37.5 &&
        player.living && !player.spectating
      ) {
        hit_list.push(uid);
        bullet_trash.push(bullet.id);

        if (
          player != undefined && Date.now() - player.last_dash > dash_time
        ) {
          dealDamage(player);
          let shooter = new Player();
          users.forEach((player) => {
            if (player.player.id == bullet.fired_by) {
              shooter = player.player;
            }
          });
          // let shooter = users.get(bullet.fired_by)?.player;
          if (shooter != undefined) {
            shooter.score += 0.5;
            if (!player.living) {
              shooter.score++;
            }
          }
          await updatePlayers();
        }
      }
    }
  }
  for (let b = 0; b < bullets.length; b++) {
    for (let d = 0; d < bullet_trash.length; d++) {
      if (bullets[b].id == bullet_trash[d]) {
        bullets.splice(b, 1);
      }
    }
  }
  return { users: users, bullets: bullets, bullet_trash: bullet_trash };
}
function dealDamage(player: Player) {
  let killed = false;
  player.health -= bullet_dmg;
  if (player.health <= 0) {
    killed = true;
    player.health = 100;
    player.x = Math.floor(Math.random() * canvasX);
    player.y = Math.floor(Math.random() * canvasY);
    player.score = Math.max(0, player.score - 1);
    player.living = false;
    player.death_time = Date.now();
  }
}
const wsManager = async (ws: WebSocket) => {
  const uid = v4.generate();
  if (!sockets.has(uid)) {
    sockets.set(uid, { socket: ws, player: new Player() });
    await updatePlayers();
  }
  for await (const ev of ws) {
    try {
      let active_action = false; //1 = idle, 2 = active
      //@ts-ignore
      let player: Player = sockets.get(uid).player;

      if (isWebSocketCloseEvent(ev)) {
        sockets.delete(uid);
        await updatePlayers();
      } else if (
        player != undefined &&
        !ws.isClosed && !player.spectating
      ) {
        //delete socket if connection closed
        if (typeof ev === "string" && (player.living || ev.includes("vel"))) {
          if (ev.slice(0, 5).includes("name")) {
            if (ev.length <= 12) {
              let wordList = await fetch(
                "https://raw.githubusercontent.com/words/cuss/master/index.json",
              );
              player.name = ev.slice(4);
            }
          } else if (ev.includes("vel")) { //Handle player movement
            active_action = true;
            await updateVelocity(uid, ws, player, ev);
          } else if (ev.includes("fire") && player.living) {
            active_action = true;
            if (Date.now() - player.last_dash > dash_time) {
              await fire_bullet(uid, ws, player, ev);
            }
          } else if (ev.includes("wake")) {
            if (!ws.isClosed) {
              let dummy_mssg = new Signal();
              dummy_mssg.type = "players";
              dummy_mssg.info.push(mssg.players);
              await send_signal(ws, JSON.stringify(dummy_mssg));
              dummy_mssg.type = "bullets";
              dummy_mssg.info.push(mssg.bullets);
              await send_signal(ws, JSON.stringify(mssg));
              await updatePlayers();
            } else {
              sockets.delete(uid);
              await updatePlayers();
            }
          } else if (ev.includes("dash")) {
            active_action = true;
            if (Date.now() - player.last_dash >= dash_cooldown) {
              player.dash_from_x = player.x;

              player.dash_from_y = player.y;
              player.last_dash = Date.now();

              await updatePositions(uid, ws, player, dash_distance);
              player.updateTime = Date.now() + dash_time;

              await updatePlayers();
            }
          } else if (ev.includes("sync")) {
            if (!ws.isClosed) {
              let you_are: number = 0;
              let player_counter: number = 0;
              sockets.forEach((user, uuid) => {
                if (uid == uuid) {
                  you_are = player_counter;
                }
                player_counter++;
              });
              let dummy_mssg = new Signal();
              dummy_mssg.you_are = you_are;
              dummy_mssg.type = "sync_player";
              dummy_mssg.info.push(mssg.players);
              await send_signal(ws, JSON.stringify(dummy_mssg));
              dummy_mssg = new Signal();
              dummy_mssg.type = "sync_bullet";
              dummy_mssg.info.push(mssg.bullets);
              await send_signal(ws, JSON.stringify(dummy_mssg));
            } else {
              sockets.delete(uid);
              await updatePlayers();
            }
          } else if (ev.includes("spectate")) {
            player.spectating = true;
            await updatePlayers();
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
          let collisions = await check_collisions(sockets, mssg.bullets);
          sockets = collisions.users;
          mssg.bullets = collisions.bullets;
          if (collisions.bullet_trash.length > 0) {
            let despawn_mmsg: Signal = new Signal();
            despawn_mmsg.type = "despawn";
            despawn_mmsg.info = collisions.bullet_trash;
            await tellPlayers(despawn_mmsg);
          }

          //update playyer timeouts
          if (active_action) {
            player.timeout_update = Date.now();
          }
        }

        await game_background();
      }
    } catch {
    }
  }
};
async function game_background() {
  let respawn = sockets.size <= 2 ? two_respawn : respawn_time;

  for (const [uid, user] of sockets.entries()) {
    if (Date.now() - user.player.last_dash > dash_time) {
      await updatePositions(uid, user.socket, user.player);
    }
    let player = user.player;

    //respawn dead players.
    if (
      Date.now() - player.death_time >= respawn - 100 &&
      Date.now() - player.death_time <= respawn + 100 &&
      !player.spectating
    ) {
      player.living = true;
      await updatePlayers();
    }

    //kick disconnected/ inactive players
    if (Date.now() - player.timeout_update >= timeout) {
      player.spectating = true;
      await updatePlayers();
    }
  }
}
async function updatePlayers() {
  //tell players about the movement
  mssg.players = updateMssg();
  let small_mssg = new Signal();
  small_mssg.info = mssg.players;
  small_mssg.type = "players";
  await tellPlayers(small_mssg);
}

function get_game_info() {
  return sockets;
}
export { game_background, get_game_info, wsManager };
