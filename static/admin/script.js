document.addEventListener('DOMContentLoaded', () => {
    connect()
})

/**
 * @param {HTMLDivElement} container 
 */
function ValuesManager(container) {
    /** @type {{ [name: string]: ValueDisplay }} */
    this.currentValues = {}
    this.container = container
}

ValuesManager.prototype = {
    setCurrentValues: function(values) {
        const currentValuesKeys = Object.keys(this.currentValues)
        const newValuesKeys = Object.keys(values)
        for (let i = 0; i < currentValuesKeys.length; i++) {
            if (newValuesKeys.indexOf(currentValuesKeys[i]) === -1) {
                this.currentValues[currentValuesKeys[i]].remove()
                delete this.currentValues[currentValuesKeys[i]]
            }
        }

        for (let i = 0; i < newValuesKeys.length; i++) {
            const key = newValuesKeys[i]
            this._updateValue(key, values[key])
        }
        this.updatePositions()
    },

    updateValue: function(key, value) {
        this._updateValue(key, value)
        this.updatePositions()
    },

    _updateValue: function(key, value) {
        if (!this.currentValues[key]) {
            this.currentValues[key] = new ValueDisplay()
        }

        this.currentValues[key].display(this.container, key, value)
    },

    updatePositions: function() {
        const sortedKeys = Object.keys(this.currentValues)
        sortedKeys.sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()))

        let currentPos = 0
        for (let i = 0; i < sortedKeys.length; i++) {
            this.currentValues[sortedKeys[i]].domElement.style.top = currentPos + 'px'
            currentPos += this.currentValues[sortedKeys[i]].domElement.offsetHeight
        }
    }
}

function ValueDisplay() {
    /** @type {HTMLElement} */
    this.domElement

    this.currentValue
}
ValueDisplay.prototype = {
    /**
     * 
     * @param {HTMLElement} container 
     * @param {string[]} newValue 
     */
    display: function (container, name, newValue) {
        if (!this.domElement) {
            this.domElement = document.createElement('div')
            this.domElement.classList.add('value-display')
            this.domElement.innerHTML = `<div class="name"></div>
            <div class="value"></div>
            <div class="increment-container">
                <div class="increment-value"></div>
                <button class="btn btn-minus">-</button>
                <button class="btn btn-plus">+</button>
                <button class="btn btn-reset">Reset</button>
            </div>`
            this.domElement.querySelector('.btn-minus').addEventListener('click', () => {
                let xhr = new XMLHttpRequest()
                xhr.open('GET', `/counter/${encodeURIComponent(name)}/-1`)
                xhr.send()
            })
            this.domElement.querySelector('.btn-plus').addEventListener('click', () => {
                let xhr = new XMLHttpRequest()
                xhr.open('GET', `/counter/${encodeURIComponent(name)}/1`)
                xhr.send()
            })
            this.domElement.querySelector('.btn-reset').addEventListener('click', () => {
                let xhr = new XMLHttpRequest()
                xhr.open('GET', `/counters/reset-counter/${encodeURIComponent(name)}`)
                xhr.send()
            })
        }
        if (!this.domElement.parentNode !== container) {
            container.appendChild(this.domElement)
        }

        this.domElement.querySelector('.name').innerText = `${name}:`
        const value = newValue.length

        this.currentValue = value
        this.domElement.querySelector('.value').innerText = this.currentValue
    },

    remove: function() {
        if (this.domElement) {
            if (this.domElement.parentNode) {
                this.domElement.parentNode.removeChild(this.domElement)
            }
            this.domElement = null
        }
    }
}

let pingInterval = null
let valuesManager = new ValuesManager(document.getElementById('content'))

function connect() {
    document.body.classList.add('loading')
    const ws = new WebSocket(`${location.protocol.endsWith('s') ? 'wss' : 'ws'}://${location.host}/ws`)
    ws.addEventListener('message', (event) => {
        try {
            processMessage(JSON.parse(event.data))
        } catch (e) { console.error(e) }
    })

    ws.addEventListener('open', () => {
        document.body.classList.remove('loading')
        if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
        }
        pingInterval = setInterval(() => {
            ws.send(JSON.stringify({ type: 'ping' }))
        }, 5000)
    })

    ws.addEventListener('error', () => {
        ws.close()
        setTimeout(connect, 5000)
    })

    ws.addEventListener('close', () => {
        setTimeout(connect, 5000)
    })
}

function processMessage(message) {
    switch (message.type) {
        case 'current-values':
            valuesManager.setCurrentValues(message.counters)
            break
        case 'counter-update':
            valuesManager.updateValue(message.counter, message.currentValue)
            break
    }
}