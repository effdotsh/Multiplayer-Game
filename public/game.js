var players_list = [];
var bullets_list = [];

var dashing_players = new Map();

var this_player = 0;

let vertical_vel = 0;
let horizontal_vel = 0;

let mouse_down = false;

let last_fire = Date.now();
let last_dash = 0;
let size_scaler = 1;

let canvasX = 2290;
let canvasY = 950;

let aviera_sans;
let name_box;
let ws;
function preload() {
  aviera_sans = loadFont("AveriaSansLibre-Regular.ttf");
  name_box = loadImage("name_box.png");
}

function setup() {
  fill(255);
  textAlign(CENTER, CENTER);
  ellipseMode(CENTER);
  textSize(16);

  //scale window
  size_scaler = windowWidth / 2304;
  createCanvas(2290 * size_scaler, 950 * size_scaler);
  scale(size_scaler);
}

function draw() {
  textFont(aviera_sans);

  textSize(20);

  scale(size_scaler);

  if (socket_ready && name_selected) {
    background(0);

    //itterate spawning players
    let player_counter = 0;
    for (p of players_list) {
      fill(200, 0, 0);
      if (player_counter == this_player) {
        fill(41, 167, 240);
      }
      player_counter++;
      if (p.living) {
        if (dashing_players.get(p.id) == undefined) {
          dashing_players.set(
            p.id,
            { client: 0, server: p.last_dash },
          );
        }
        let last_recorded_dash = dashing_players.get(p.id)?.server ?? 0;

        if (
          last_recorded_dash == p.last_dash &&
          Date.now() - dashing_players.get(p.id).client > dash_time
        ) {
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
        }
      }
    }

    //iterate spawning bullets
    fill(252, 186, 3);
    bullets_list = move_bullets(bullets_list);
    for (b of bullets_list) {
      circle(b.x, b.y, 25, 25);
    }

    send_signal(`pos${horizontal_vel * 100},${vertical_vel * 100}`);
    if (Date.now() - last_fire > fire_rate && mouse_down) {
      let net_x = mouseX - players_list[this_player].x * size_scaler;
      let net_y = mouseY - players_list[this_player].y * size_scaler;

      let fire_vel = bindVector(net_x, net_y);
      send_signal(`fire${(fire_vel[0])}, ${(fire_vel[1])}`);
    }
    draw_leaderboard(JSON.parse(JSON.stringify(players_list)));
  } else if (!name_selected && socket_ready) {
    send_signal(`name${name}`);
    name_selected = true;
  }
  get_keys();
  if (!name_selected) {
    fill(255);
    textSize(100);
    namescreen();
  }
}
function namescreen() {
  background(0);
  imageMode(CENTER);
  textFont(aviera_sans);
  text("Enter Your Name", canvasX / 2, canvasY / 2 - 200);
  image(name_box, canvasX / 2, canvasY / 2 + 100, 1000, 200);
  textAlign(CENTER, CENTER);

  text(name, canvasX / 2, canvasY / 2 + 87);
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
}

function mousePressed() {
  mouse_down = true;
}
function mouseReleased() {
  mouse_down = false;
}

function keyPressed() {
  if (keyCode === 16 || keyCode === 32) {
    dash();
  }
  if (keyCode === 13) {
    if (ws == undefined) {
      init_socket();
    }
  }
}
function keyTyped() {
  if (!name_selected) {
    let name_chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let char = key.toLowerCase();
    if (name_chars.includes(char) && name.length <= 7) {
      name += char;
    }
  }
}
function dash() {
  let cooldown = (Date.now() - last_dash) / dash_cooldown;
  cooldown = cooldown > 1 ? cooldown = 1 : cooldown = cooldown;
  if (cooldown == 1 && (horizontal_vel != 0 || vertical_vel != 0)) {
    last_dash = Date.now();

    send_signal(`dash${horizontal_vel * 100},${vertical_vel * 100}`);
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
    send_signal("wake");
    send_signal(`pos0,0`);
  };
  ws.addEventListener("message", ({ data }) => {
    const parsed = JSON.parse(data);
    const { type } = parsed;
    const { info } = parsed;
    const all = false;
    if (type === "players" || all) {
      let players = info;
      players_list = players;
      let template = `
            <p>Connections: ${players.length}</p>`;
      connectionDisplay.innerHTML = template;
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
  players.forEach((player, rank) => {
    fill(255);
    if (player.id === players_list[this_player].id) {
      fill(0, 162, 255);
      console.log(this_player);
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
  });
}
