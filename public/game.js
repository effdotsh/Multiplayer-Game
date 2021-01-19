let speed = 1
var players_list = []

function setup() {
    createCanvas(1000, 1000)
    background(0)
    ws.addEventListener('message', ({data}) => {
        const {players} = JSON.parse(data)

        let template = `
            <p>Connections: ${players.length}</p>`;
        connectionDisplay.innerHTML = template
        players_list = players
    })
    ws.send('ping')

}

function draw() {
    console.log(players_list)
    frameRate(1)
}