var players_list = [];
var bullets_list = [];

var dashing_players = new Map();

var this_player = 0;
var socket_ready = false;

let vertical_vel = 0;
let horizontal_vel = 0;

let mouse_down = false;

let last_fire = Date.now();
let last_dash = 0;
let size_scaler = 1;

let canvasX = 2290;
let canvasY = 950;


function setup() {
  fill(255);
  textAlign(CENTER, CENTER);
  ellipseMode(CENTER);
  textSize(16);
  ws.onopen = function (event) {
    socket_ready = true;
    ws.send("wake");
    ws.send(`pos0,0`);
  };
  const connectionDisplay = document.querySelector(".connections");

  //scale window
  size_scaler = windowWidth / 2304;
  createCanvas(2290 * size_scaler, 950 * size_scaler);
  scale(size_scaler);
  console.log(size_scaler);
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

  window.onunload = function () {
    ws.close();
    return null;
  };
}

function draw() {
  scale(size_scaler);

  if (socket_ready && players_list != undefined) {
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
            { client: Date.now(), server: p.last_dash },
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


          text(p.score, p.x, p.y);
          rectMode(CORNER);
          fill(0, 200, 0);
          rect(p.x - 25, p.y - 40, p.health / 100 * 50, 10);
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

    ws.send(`pos${horizontal_vel * 100},${vertical_vel * 100}`);
    if (Date.now() - last_fire > fire_rate && mouse_down) {
      let net_x = mouseX - players_list[this_player].x * size_scaler;
      let net_y = mouseY - players_list[this_player].y * size_scaler;

      let fire_vel = bindVector(net_x, net_y);
      ws.send(`fire${(fire_vel[0])}, ${(fire_vel[1])}`);
    }
  }
  get_keys();

  //draw dash_cooldown bar
  let bar_width = 800;
  let bar_height = 30;

  fill(200);
  rect(
    canvasX / 2 - bar_width / 2,
    canvasY - 2 * bar_height,
    bar_width + 5,
    bar_height + 5,
  );
  fill(50, 50, 200);

  let cooldown = (Date.now() - last_dash) / dash_cooldown;
  cooldown = cooldown > 1 ? cooldown = 1 : cooldown = cooldown;
  if (cooldown == 1) {
    fill(41, 167, 240);
  }
  rect(
    canvasX / 2 - bar_width / 2 + 2.5,
    canvasY - 2 * bar_height + 2.5,
    cooldown * bar_width,
    bar_height,
  );
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
}
function dash() {
  let cooldown = (Date.now() - last_dash) / dash_cooldown;
  cooldown = cooldown > 1 ? cooldown = 1 : cooldown = cooldown;
  if (cooldown == 1 && (horizontal_vel != 0 || vertical_vel != 0)) {

    last_dash = Date.now();

    ws.send(`dash${horizontal_vel * 100},${vertical_vel * 100}`);
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
  fill(255);
  textAlign(CENTER, CENTER);

  text(player.score, new_x, new_y);
  rectMode(CORNER);
  fill(0, 200, 0);
  rect(new_x - 25, new_y - 40, player.health / 100 * 50, 10);

  fill(255);
  // circle(player.x, player.y, 50, 50);
  // circle(player.dash_from_x, player.dash_from_y, 50, 50);
}

function easeInOutSine(x) {
  return -(cos(PI * x) - 1) / 2;
}
