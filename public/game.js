var players_list = []
var this_player = 0;
var socket_ready = false;

let vertical_vel = 0
let horizontal_vel = 0
// let ws = new WebSocket('ws://localhost:3000/ws')

let ws = new WebSocket('wss://aispawn.herokuapp.com/ws')

function setup() {
    fill(255)

    ws.onopen = function (event) {
        socket_ready = true;
        ws.send('ping')
    };
    const connectionDisplay = document.querySelector('.connections')


    createCanvas(1000, 1000)
    ws.addEventListener('message', ({data}) => {
        const {players} = JSON.parse(data)
        const {you_are} = JSON.parse(data)
        let template = `
            <p>Connections: ${players.length}</p>`;
        connectionDisplay.innerHTML = template
        players_list = players
        this_player = you_are
    })

}

function draw() {
    if (socket_ready) {
        background(0)

        let player_counter = 0
        for (p of players_list) {
            fill(200, 0, 0)
            if (player_counter == this_player) {
                fill(41, 167, 240)
            }
            player_counter++
            circle(p.x, p.y, 50, 50)
        }
        ws.send(`pos${horizontal_vel},${vertical_vel}`)
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