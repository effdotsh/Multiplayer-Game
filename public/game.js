var players_list = [];
var bullets_list = [];

var dashing_players = new Map();
var moving_players = new Map();

var this_player = 0;

let vertical_vel;
let horizontal_vel;
let last_vertical_vel;
let last_horizontal_vel;

let mouse_down = false;

let last_fire = Date.now();
let last_dash = 0;
let size_scaler = 1;

let canvasX = 2144;
let canvasY = 1047;

let aviera_sans;
let name_box;
let ws;

let death_time = p3_respawn;

let default_names = ["Bob", "Steve", "Tim", "Jim", "Bob", "BillNye", "Kevin"];
let default_name =
  default_names[Math.floor(Math.random() * default_names.length)];

let spectating = false;
function preload() {
  aviera_sans = loadFont("AveriaSansLibre-Regular.ttf");
  name_box = loadImage("name_box.png");
}
function get_scale() {
  return min(windowWidth / canvasX, windowHeight / canvasY);
}
function setup() {
  fill(255);
  textAlign(CENTER, CENTER);
  ellipseMode(CENTER);
  textSize(16);

  //scale window
  size_scaler = get_scale();
  let cnv = createCanvas(canvasX * size_scaler, canvasY * size_scaler);
  cnv.position(windowWidth / 2 - (canvasX * size_scaler) / 2, 0, "fixed");
  scale(size_scaler);
}

function windowResized() {
  //scale window
  size_scaler = get_scale();
  let cnv = createCanvas(canvasX * size_scaler, canvasY * size_scaler);
  cnv.position(windowWidth / 2 - (canvasX * size_scaler) / 2, 0, "fixed");

  scale(size_scaler);
}
function draw() {
  textFont(aviera_sans);

  textSize(20);

  scale(size_scaler);

  if (socket_ready && name_selected) {
    background(0);

    show_players();

    show_bullets();

    check_fire();

    respawn_timer();

    draw_leaderboard(JSON.parse(JSON.stringify(players_list)));
    get_keys();
  } else if (!name_selected && socket_ready) {
    send_signal(`name${(name != "" ? name : default_name)}`);
    name_selected = true;
  }
  if (!name_selected) {
    namescreen();
  }
}
function respawn_timer() {
  if (!players_list[this_player].living) {
    let respawn_time = players_list.length <= 2 ? p2_respawn : p3_respawn;
    death_time = death_time == 0 ? Date.now() : death_time;
    let shade = 100;
    let transparancy = 155;
    fill(shade, shade, shade, transparancy);
    rect(0, 0, canvasX, canvasY);

    fill(255);
    textSize(40);
    let timer = respawn_time - (Date.now() - death_time);
    timer = timer == respawn_time ? timer : timer + 0.1;
    timer = float(Math.round(timer / 100) / 10);
    timer = timer == int(timer) ? `${timer}.0` : timer;
    text(`${timer} Seconds`, canvasX / 2, canvasY / 2);
  } else {
    death_time = 0;
  }
}
function check_fire() {
  if (Date.now() - last_fire > fire_rate && mouse_down) {
    let net_x = mouseX - players_list[this_player].x * size_scaler;
    let net_y = mouseY - players_list[this_player].y * size_scaler;

    let fire_vel = bindVector(net_x, net_y);
    send_signal(`fire${(fire_vel[0])}, ${(fire_vel[1])}`);
  }
}
function show_bullets() {
  //iterate spawning bullets
  fill(252, 186, 3);
  bullets_list = move_bullets(bullets_list);
  for (b of bullets_list) {
    circle(b.x, b.y, 25, 25);
  }
}
function show_players() {
  //itterate spawning players
  let player_counter = 0;
  for (p of players_list) {
    fill(200, 0, 0);
    if (player_counter == this_player) {
      fill(41, 167, 240);
    }
    player_counter++;
    if (p.living && !p.spectating) {
      draw_player(p);
    }
  }
}
function namescreen() {
  fill(255);
  background(0);
  imageMode(CENTER);
  textFont(aviera_sans);
  textSize(title_size);

  text(game_title, canvasX / 2, canvasY / 2 - 200);

  textSize(75);

  text("Enter Your Name", canvasX / 2, canvasY / 2);

  //name box
  if (name == "") {
    fill(100);
  }
  let name_x_offset = 200;
  let displayname = name == "" ? default_name : name;
  image(name_box, canvasX / 2, canvasY / 2 + name_x_offset, 500, 175);
  textAlign(CENTER, CENTER);
  text(displayname, canvasX / 2, canvasY / 2 + name_x_offset - 20);

  //spectate
  fill(255);
  textSize(45);
  imageMode(CENTER, CENTER);

  image(name_box, 100, -162 + name_x_offset, 200, 75);

  text("Spectate", 100, 25);
  if (mouse_down && 0 < mouseX && mouseX < 200 && mouseY < 75) {
    if (ws == undefined) {
      spectating = true;

      init_socket();
    }
  }
}
function cooldown_bar(x, y) {
  //draw dash_cooldown bar
  let bar_width = 50;
  let bar_height = 10;
  fill(200);
  fill(41, 167, 240);

  let cooldown = (Date.now() - last_dash) / dash_cooldown;
  cooldown = cooldown > 1 ? cooldown = 1 : cooldown = cooldown;

  let player = players_list[this_player];
  if (cooldown != 1) {
    rect(
      x - bar_width / 2,
      y - 50,
      cooldown * bar_width,
      bar_height,
    );
  }
}
function get_keys() {
  vertical_vel = 0;
  horizontal_vel = 0;
  if (keyIsDown(87)) { // W
    vertical_vel -= 1;
  }
  if (keyIsDown(83)) { // S
    vertical_vel += 1;
  }
  if (keyIsDown(65)) { // A
    horizontal_vel -= 1;
  }
  if (keyIsDown(68)) { // D
    horizontal_vel += 1;
  }
  send_pos();

  if (keyIsDown(32)) {
    dash();
  }

  if (keyIsDown(81) || keyIsDown(16) || keyIsDown(69)) {
    player = players_list[this_player];
    dash(mouseX - player.x * size_scaler, mouseY - player.y * size_scaler);
  }
}

function mousePressed() {
  mouse_down = true;
}
function mouseReleased() {
  mouse_down = false;
}

function keyPressed() {
  if (keyCode === 13) {
    if (ws == undefined) {
      init_socket();
    }
  }
}
function keyTyped() {
  if (!name_selected) {
    let name_chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    if (name_chars.includes(key.toLowerCase()) && name.length <= 7) {
      name += key;
    }
  }
}
function dash(x = horizontal_vel, y = vertical_vel) {
  let cooldown = (Date.now() - last_dash) / dash_cooldown;
  cooldown = cooldown > 1 ? cooldown = 1 : cooldown = cooldown;
  if (cooldown == 1 && (x != 0 || y != 0)) {
    last_dash = Date.now();
    send_signal(`vel${x * 100},${y * 100}`);
    send_signal(`dash`);
    send_signal(`vel${horizontal_vel * 100},${vertical_vel * 100}`);
  }
}

function draw_dashing(player) {
  let percent_dashed = (Date.now() - dashing_players.get(player.id).client) /
    dash_time;
  percent_dashed = easeInOutSine(percent_dashed);

  let moved_x = player.x - player.dash_from_x;
  let moved_y = player.y - player.dash_from_y;
  let new_x = player.dash_from_x + (moved_x * percent_dashed);
  let new_y = player.dash_from_y + (moved_y * percent_dashed);

  circle(new_x, new_y, 50, 50);

  rectMode(CORNER);
  fill(0, 200, 0);
  rect(new_x - 25, new_y - 40, player.health / 100 * 50, 10);
  fill(255);
  textAlign(CENTER, CENTER);

  text(Math.floor(player.score), new_x, new_y - 3);
  text(player.name, new_x, new_y + 40);

  if (player.id == players_list[this_player].id) {
    cooldown_bar(new_x, new_y);
  }
}

function easeInOutSine(x) {
  return -(cos(PI * x) - 1) / 2;
}
function init_socket() {
  ws = new WebSocket(socket_url);
  window.onunload = function () {
    ws.close();
    return null;
  };
  ws.onopen = function (event) {
    socket_ready = true;
    if (spectating) {
      ws.send("spectate");
    } else {
      send_signal("wake");
      send_signal(`vel0,0`);
    }
  };
  ws.addEventListener("message", ({ data }) => {
    const parsed = JSON.parse(data);
    const { type } = parsed;
    const { info } = parsed;
    const all = false;
    if (type === "players" || all) {
      let players = info;
      players_list = players;
    }
    if (type === "bullets" || all) {
      const bullets = info;
      bullets[0].update_time = Date.now();
      bullets[0].spawn_time = Date.now();

      bullets_list.push(bullets[0]);
    }
    if (type === "despawn") {
      for (let b = 0; b < bullets_list.length; b++) {
        for (let d = 0; d < info.length; d++) {
          if (bullets_list[b].id == info[d]) {
            bullets_list.splice(b, 1);
          }
        }
      }
    }
    const { you_are } = JSON.parse(data);

    this_player = you_are;
  });
}

function send_signal(signal) {
  if (ws != undefined) {
    ws.send(signal);
  }
}

function draw_leaderboard(players) {
  textAlign(LEFT);
  textSize(30);
  players.sort((a, b) =>
    (a.score > b.score) ? 1 : ((b.score > a.score) ? -1 : 0)
  ).reverse();
  rank = -1;
  players.forEach((player) => {
    if (!player.spectating) {
      rank++;
      fill(255);
      if (player.id === players_list[this_player].id) {
        fill(0, 162, 255);
      }
      text(
        `${rank + 1}. ${player.name}`,
        50,
        50 + 40 * rank,
      );
      text(
        `${int(player.score)}`,
        220,
        50 + 40 * rank,
      );
    }
  });
}

function send_pos() {
  if (
    horizontal_vel != last_horizontal_vel || vertical_vel != last_vertical_vel
  ) {
    send_signal(`vel${horizontal_vel * 100},${vertical_vel * 100}`);
    last_vertical_vel = vertical_vel;
    last_horizontal_vel = horizontal_vel;
  } else {
    send_signal(0);
  }
}
function draw_player(p) {
  if (dashing_players.get(p.id) == undefined) {
    dashing_players.set(
      p.id,
      { client: 0, server: p.last_dash },
    );
  }
  if (moving_players.get(p.id) == undefined) {
    moving_players.set(
      p.id,
      { client_update: Date.now(), x: p.vel_x, y: p.vel_y },
    );
  }
  let last_recorded_dash = dashing_players.get(p.id)?.server ?? 0;

  if (
    last_recorded_dash == p.last_dash &&
    Date.now() - dashing_players.get(p.id).client > dash_time
  ) {
    move_player(p);

    circle(p.x, p.y, 50, 50);
    fill(255);
    textAlign(CENTER, CENTER);
    text(Math.floor(p.score), p.x, p.y - 3);
    text(p.name, p.x, p.y + 40);
    rectMode(CORNER);
    fill(0, 200, 0);
    rect(p.x - 25, p.y - 40, p.health / 100 * 50, 10);
    if (p.id == players_list[this_player].id) {
      cooldown_bar(p.x, p.y);
    }
  } else {
    if (last_recorded_dash != p.last_dash) {
      dashing_players.set(
        p.id,
        { client: Date.now(), server: p.last_dash },
      );
    }
    dashing_players.get(p.id).server = p.last_dash;

    draw_dashing(p);
    moving_players.get(p.id).client_update = Date.now();
  }
}
function move_player(p) {
  if (moving_players.get(p.id) == undefined) {
    moving_players.set(
      p.id,
      { client_update: Date.now() },
    );
  }
  let new_update = Date.now();
  let time_multiplier = (new_update - moving_players.get(p.id).client_update) /
    20;
  p.health += (Date.now() - moving_players.get(p.id).client_update) / 1000 *
    health_regen;
  p.health = Math.min(p.health, 100);

  moving_players.get(p.id).client_update = new_update;
  p.x += p.vel_x * time_multiplier;
  p.y += p.vel_y * time_multiplier;

  p.x = p.x > canvasX ? p.x = canvasX : p.x < 0 ? p.x = 0 : p.x = p.x;

  p.y = p.y > canvasY ? p.y = canvasY : p.y < 0 ? p.y = 0 : p.y = p.y;
}
