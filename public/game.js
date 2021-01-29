var players_list = [];
var bullets_list = [];
var this_player = 0;
var socket_ready = false;

let vertical_vel = 0;
let horizontal_vel = 0;

let mouse_down = false;
let last_fire = Date.now();

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

  createCanvas(1000, 1000);
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
        circle(p.x, p.y, 50, 50);
        fill(255);
        textAlign(CENTER, CENTER);

        text(p.score, p.x, p.y);
        rectMode(CORNER);
        fill(0, 200, 0);
        rect(p.x - 25, p.y - 40, p.health / 100 * 50, 10);
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
      ws.send(`fire${int(mouseX)}, ${int(mouseY)}`);
    }
  }
  get_keys();
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
  ws.send(`dash${horizontal_vel * 100},${vertical_vel * 100}`);
}
