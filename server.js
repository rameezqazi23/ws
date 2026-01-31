import { WebSocket, WebSocketServer } from 'ws';

// 0: CONNECTING
// 1: OPEN
// 2: CLOSING
// 3: CLOSED

const wss = new WebSocketServer({ port: 8080 })

wss.on("connection", (socket, request) => {
    const ip = request.socket.remoteAddress

    // when a client sends a message 
    socket.on("message", (rawData) => {
        const message = rawData.toString()

        console.log({ rawData })

        // broadcast the message to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`Server broadcasted: ${message}`)
            }
        })
    })

    // when a client sends an error
    socket.on("error", (error) => {
        console.log(`Error: ${error.message}: ${ip}`)
    })

    // when a client closes the connection
    socket.on("close", () => {
        console.log("Client disconnected!")
    })
})

console.log("WebSocket server is running on port 8080")