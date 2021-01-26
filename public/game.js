var players_list = [];
var bullets_list = [];
var this_player = 0;
var socket_ready = false;

let vertical_vel = 0;
let horizontal_vel = 0;

function setup() {
  fill(255);

  ws.onopen = function (event) {
    socket_ready = true;
    ws.send("wake");
    ws.send(`pos0,0`);

  };
  const connectionDisplay = document.querySelector(".connections");

  createCanvas(1000, 1000);
  ws.addEventListener("message", ({ data }) => {
    try {
      const parsed = JSON.parse(data);
      const { type } = parsed;
      const { info } = parsed;
      const all = type == "all";
      if (type === "players" || all) {
        let players = info;
        players_list = players;
        let template = `
            <p>Connections: ${players.length}</p>`;
        connectionDisplay.innerHTML = template;
      }
      if (type === "bullets" || all) {
        const bullets = info;
        bullets[0].update_time = Date.now()
        bullets[0].spawn_time = Date.now()

        bullets_list.push(bullets[0]);
      }
      const { you_are } = JSON.parse(data);

      this_player = you_are;
    } catch {
      console.log(data);
    }
  });
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
      circle(p.x, p.y, 50, 50);
    }

    //iterate spawning bullets
    bullets_list = move_bullets(bullets_list);
    for (b of bullets_list) {
      fill(0, 200, 0);
      circle(b.x, b.y, 25, 25);
    }

      ws.send(`pos${horizontal_vel * 100},${vertical_vel * 100}`);
    
  }
}

function keyPressed() {
  if (keyCode == 87) {
    vertical_vel -= 1;
  }
  if (keyCode == 83) {
    vertical_vel += 1;
  }
  if (keyCode == 65) {
    horizontal_vel -= 1;
  }
  if (keyCode == 68) {
    horizontal_vel += 1;
  }
}

function keyReleased() {
  if (keyCode == 87) {
    vertical_vel += 1;
  }
  if (keyCode == 83) {
    vertical_vel -= 1;
  }
  if (keyCode == 65) {
    horizontal_vel += 1;
  }
  if (keyCode == 68) {
    horizontal_vel -= 1;
  }
}

function mousePressed() {
  ws.send(`fire${int(mouseX)}, ${int(mouseY)}`);
}
