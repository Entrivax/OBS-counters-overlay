const express = require('express')
const app = express()
const fsPromise = require('fs/promises')
require('express-ws')(app)

const countersFile = './counters.json'
const listenPort = 12222

/** @type {{[name: string]: string[]}} */
let counters = {}

/** @type {WebSocket[]} */
const sockets = []

app.use(express.static('static'))

app.get('/counter/:counter/:count?', async (req, res) => {
    if (!req.params.counter) {
        res.status(400).send('No counter to increment')
    }
    if (!counters[req.params.counter]) {
        counters[req.params.counter] = []
    }
    const toIncrement = req.params.count ? +req.params.count : 1
    const date = new Date().toISOString()
    if (toIncrement > 0) {
        for (let i = 0; i < toIncrement; i++) {
            counters[req.params.counter].push(date)
        }
        console.log(`Counter ${req.params.counter} incremented by ${toIncrement}`)
        res.send(`Counter ${req.params.counter} incremented by ${toIncrement}`)
    }
    else if (toIncrement < 0) {
        counters[req.params.counter].length -= Math.min(-toIncrement, counters[req.params.counter].length)
        console.log(`Counter ${req.params.counter} decremented by ${-toIncrement}`)
        res.send(`Counter ${req.params.counter} decremented by ${-toIncrement}`)
    }
    await save()
    onUpdateCounter(req.params.counter)
})

app.get('/counters/reset-counter/:counter', async (req, res) => {
    if (!req.params.counter) {
        console.log('No counter to reset')
        res.status(400).send('No counter to reset')
        return
    }
    counters[req.params.counter] = []
    await save()
    console.log(`Counter ${req.params.counter} reset`)
    res.send(`Counter ${req.params.counter} reset`)
    onUpdateCounter(req.params.counter)
})

app.get('/counters/reset', async (req, res) => {
    const keys = Object.keys(counters)
    for (let i = 0; i < keys.length; i++) {
        counters[keys[i]] = []
        onUpdateCounter(keys[i])
    }
    await save()
    console.log('All counters reset')
    res.send('All counters reset')
})


app.ws('/ws', /** @param {WebSocket} ws */ (ws, req) => {
    sockets.push(ws)

    ws.on('close', () => {
        const index = sockets.indexOf(ws)
        if (index !== -1) {
            sockets.splice(index, 1)
        }
    })

    ws.on('error', () => {
        ws.close()
    })

    ws.on('message', (event) => {
        try {
            const message = JSON.parse(event)
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }))
            }
        } catch (e) {}
    })

    ws.send(JSON.stringify({ type: 'current-values', counters }))
})

function onUpdateCounter(counter) {
    for (let i = 0; i < sockets.length; i++) {
        try {
            sockets[i].send(JSON.stringify({
                type: 'counter-update',
                counter,
                currentValue: counters[counter]
            }))
        } catch (e) {
            console.error(e)
        }
    }
}

async function save() {
    await fsPromise.writeFile(countersFile, JSON.stringify(counters), 'utf8')
}

async function load() {
    try {
        const fileContent = await fsPromise.readFile(countersFile, {
            encoding: 'utf8'
        })
        counters = JSON.parse(fileContent) || counters
    } catch (ex) {
        console.error(`Failed to load ${countersFile} counters file`, ex)
        console.log('If the file didn\'t exist, it is normal and will be automatically created.')
    }
}

async function main() {
    await load()
    app.listen(listenPort, '127.0.0.1', () => {
        console.log(`Server listening on port ${listenPort}`)
        console.log(`Webpage available at http://localhost:${listenPort}/`)
        console.log(`Admin page available at http://localhost:${listenPort}/admin`)
    })
}

main()