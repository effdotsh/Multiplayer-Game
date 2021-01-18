let ws = new WebSocket('wss://aispawn.herokuapp.com/ws')
// let ws = new WebSocket('ws://localhost:3000/ws')

const pressed = document.querySelector('.data')
const connections = document.querySelector('.connections')

const inc = document.getElementById('increase')
const dec = document.getElementById('decrease')



//update websocket
const updateData = ({data}) => {
    const {presses} = JSON.parse(data)
    const {connections} = JSON.parse(data)

    let template = `
            <h1>Num Presses: ${presses}</h1>
            <h1>Current Connections: ${connections}</h1>
               `;

    pressed.innerHTML = template
}

//tell server
const up = () => {
    ws.send('up')
}
const down = () => {
    ws.send('down')
}


function setup() {
    ws.addEventListener('message', updateData)
    inc.addEventListener('click', up)
    dec.addEventListener('click', down)

}
function draw(){

}