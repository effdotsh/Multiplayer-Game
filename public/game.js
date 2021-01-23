var players_list = []
var bullets_list = []
var this_player = 0;
var socket_ready = false;

let vertical_vel = 0
let horizontal_vel = 0

// let ws = new WebSocket('wss://aispawn.herokuapp.com/ws')
let ws = new WebSocket('ws://localhost:3000/ws')

function setup() {
    fill(255)

    ws.onopen = function (event) {
        socket_ready = true;
        ws.send('wake')
    };
    const connectionDisplay = document.querySelector('.connections')


    createCanvas(1000, 1000)
    ws.addEventListener('message', ({data}) => {
        const parsed = JSON.parse(data)
        const {type} = parsed
        const all = type == 'all'
        if (type === 'players' || all) {
            const {players} = parsed
            players_list = players
            let template = `
            <p>Connections: ${players.length}</p>`;
            connectionDisplay.innerHTML = template
        }
        if(type === 'bullets' || all){
            const {bullets} = parsed
            bullets_list = bullets
        }
        const {you_are} = JSON.parse(data)


        this_player = you_are
    })

}

function draw() {
    if (socket_ready) {
        background(0)

        //itterate spawning players
        let player_counter = 0
        for (p of players_list) {
            fill(200, 0, 0)
            if (player_counter == this_player) {
                fill(41, 167, 240)
            }
            player_counter++
            circle(p.x, p.y, 50, 50)
        }

        //iterate spawning bullets
        for (b of bullets_list){
            fill(0, 200, 0)
            circle(b.x, b.y, 25, 25)
        }
        ws.send(`pos${horizontal_vel*100},${vertical_vel*100}`)
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

function mousePressed(){
    ws.send(`fire${int(mouseX)}, ${int(mouseY)}`)
}