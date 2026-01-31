# ws — Web Sockets In Action

A compact demo showing WebSocket usage from the browser (client) and Node (server). This repository contains a minimal client UI and an example Node server so you can explore real‑time, full‑duplex browser ↔ server communication.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
  - [Serve the demo as static files](#serve-the-demo-as-static-files)
  - [Run the example Node server](#run-the-example-node-server)
  - [Test with wscat](#test-with-wscat)
- [Examples](#examples)
  - [Client (browser) — basic WebSocket usage](#client-browser---basic-websocket-usage)
  - [Server (Node) — basic echo server](#server-node---basic-echo-server)
- [WebSockets 101 — how they work](#websockets-101---how-they-work)
  - [Protocol and handshake](#protocol-and-handshake)
  - [Frames, masking, and opcodes](#frames-masking-and-opcodes)
  - [Full‑duplex and lifecycle](#full-duplex-and-lifecycle)
- [Architecture & scaling](#architecture--scaling-brief)

---

## Overview

This project is intended as a hands‑on demonstration of WebSockets:
- Opening and managing a WebSocket connection from the browser (HTML/JS).
- Running a Node server that accepts WebSocket connections using the `ws` package.
- A minimal echo/chat-style demo to experiment with messages and connection lifecycle.

## Features

- Minimal HTML + JavaScript client that connects to a WebSocket server.
- Example Node server (using `ws`) that echoes messages or broadcasts them to connected clients.
- Quick instructions for running locally and testing with CLI tools.

## Repository layout

- `index.html` — demo client UI and client-side JavaScript
- `server/` — Node server example (if present)
- `README.md` — this file

## Requirements

- A modern browser (Chrome, Firefox, Edge, Safari)
- Node.js (for running the example server; optional if you only open the HTML)
- npm (for installing packages and dev types)

## Quick start

### Serve the demo as static files (no server code required)

You can serve the client files with a simple static server:

```bash
# Install http-server once (optional)
npm install -g http-server

# From repo root
http-server -c-1 . -p 8080

# Open http://localhost:8080 in your browser
```

Note: Browsers may block some behaviors when opening files with `file://`. Prefer serving over HTTP for the best developer experience.

### Run the example Node server

Install and run the example server:

```bash
# Initialize project (optional)
npm init -y

# Install ws
npm install ws

# Install development type definitions (recommended for TypeScript / editor support)
npm install --save-dev @types/node @types/ws

# Run the example server (create server/index.js in the repo if not present)
node server/index.js
```

### Test with wscat

Use `wscat` to quickly test a running websocket endpoint:

```bash
# Install wscat if you don't have it
npm install -g wscat

# Connect to a WebSocket server running on port 8080
wscat -c ws://localhost:8080
```

(Once connected you can type messages and see server replies.)

## Examples

### Client (browser) — basic WebSocket usage

A minimal client snippet (put in `index.html` or adapt as needed):

```html
<!-- Example client code (index.html) -->
<script>
  const wsUrl = 'ws://localhost:8080'; // adjust to match your server
  const ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    console.log('Connected to', wsUrl);
    ws.send(JSON.stringify({ type: 'greeting', text: 'Hello from client' }));
  });

  ws.addEventListener('message', (event) => {
    console.log('Message from server:', event.data);
    // update UI or process message
  });

  ws.addEventListener('close', () => {
    console.log('Connection closed');
  });

  ws.addEventListener('error', (err) => {
    console.error('WebSocket error', err);
  });
</script>
```

### Server (Node) — basic echo server

Create `server/index.js` with this example:

```js
// server/index.js
const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws, req) => {
  console.log('Client connected:', req.socket.remoteAddress);

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    // Echo back the message to the same client:
    ws.send(`Echo: ${message}`);
    // Or broadcast to all clients:
    // wss.clients.forEach((client) => {
    //   if (client.readyState === WebSocket.OPEN) client.send(message);
    // });
  });

  ws.on('close', (code, reason) => {
    console.log('Client disconnected', code, reason && reason.toString());
  });

  ws.on('error', (err) => {
    console.error('WebSocket error', err);
  });
});
```

Run with:

```bash
node server/index.js
```

Update your client to connect to `ws://localhost:8080`.

---

## WebSockets 101 — how they work

This section explains the protocol, how a connection is established, how full‑duplex communication actually happens, and the basic lifecycle.

### Protocol and handshake

- WebSockets are defined in RFC 6455. They begin with an HTTP/1.1-based handshake:
  - The client sends an HTTP GET request that includes headers requesting an "upgrade" to the WebSocket protocol:
    - `Connection: Upgrade`
    - `Upgrade: websocket`
    - `Sec-WebSocket-Key: <random-base64>` — a client-generated key
    - `Sec-WebSocket-Version: 13`
    - Optionally: `Sec-WebSocket-Protocol` (to negotiate a subprotocol) and `Sec-WebSocket-Extensions` (e.g., permessage-deflate)
  - Example (client handshake request, simplified):
    ```
    GET /chat HTTP/1.1
    Host: example.com
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
    Sec-WebSocket-Version: 13
    ```
  - The server validates the request and responds with status `101 Switching Protocols` and computes `Sec-WebSocket-Accept` by taking the client's Sec-WebSocket-Key, appending the magic GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, SHA1-hashing it, and base64-encoding the result. This proves the server understood the handshake.
  - Example server response (simplified):
    ```
    HTTP/1.1 101 Switching Protocols
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
    ```

- After the successful 101 response, the HTTP connection is "upgraded" and both endpoints start communicating with the WebSocket framing format over the same TCP connection. If TLS is used, the endpoint uses `wss://` instead of `ws://`.

### Frames, masking, and opcodes

- WebSocket data is exchanged in frames. Each frame contains:
  - FIN bit (marks end of message)
  - Opcode (text, binary, ping, pong, close, continuation)
  - Mask bit and masking key
  - Payload length (with extended lengths when needed)
  - Payload data

- Important details:
  - Clients MUST mask payloads sent to servers (XOR with a 4-byte masking key). Servers MUST NOT mask frames sent to clients. Masking prevents certain intermediaries from caching/interpreting frames maliciously.
  - Common opcodes:
    - 0x1 — text frame
    - 0x2 — binary frame
    - 0x8 — connection close
    - 0x9 — ping
    - 0xA — pong
  - Messages can be fragmented across multiple frames (continuation frames). The FIN bit marks the final frame of a message.
  - Ping/pong frames provide liveness checks and keepalive semantics; servers/clients should respond to pings with pongs.

### Full‑duplex and lifecycle

- WebSockets provide full‑duplex communication: both client and server can send frames independently once the connection is established. This is possible because the underlying transport is a single TCP connection maintained open for the session; either peer may write frames at any time.
- Typical lifecycle:
  1. TCP connection established (and TLS handshake if using wss).
  2. HTTP upgrade handshake exchanges Sec-WebSocket-Key / Sec-WebSocket-Accept.
  3. Switch to WebSocket framing and start sending/receiving frames.
  4. Exchange application messages (text/binary) as frames; ping/pong for liveness.
  5. Close handshake: one side sends a Close frame (opcode 0x8) optionally with a status code and reason. The other side should respond with a Close frame and then close the TCP connection.
- Flow control & backpressure: WebSocket implementations and the underlying TCP stack manage flow; servers should be careful with unbounded message queues per client to avoid memory issues and should implement backpressure or drop strategies for overloaded clients.

---

## Architecture & scaling

When moving beyond a single server or simple demo, consider:

- Reverse proxies / load balancers:
  - Proxies must support the HTTP Upgrade mechanism and forward `Upgrade` and `Connection` headers. For TLS termination, use `wss://` between client and proxy and plain `ws://` from proxy to backend if desired.
  - Example: nginx requires special configuration for upgrade headers and long-lived connections.

- Scaling and horizontal/clustered deployments:
  - WebSockets are stateful (long-lived TCP connections). When you scale to multiple backend servers you must either:
    - Use sticky sessions (route the same client connection to the same backend server).
    - Or use a central messaging layer (Redis pub/sub, Kafka, NATS) so any backend can broadcast messages to all interested clients—backends subscribe to the broker and forward messages over their own connected sockets.
  - For broadcasts, a common architecture: backend processes handle connections and publish inbound messages to a message bus; other backends subscribed to the bus forward messages to their clients.

- Authentication & authorization:
  - Authenticate either before/after the handshake. Common patterns:
    - Send a token (e.g., JWT) as a query parameter or `Sec-WebSocket-Protocol` during handshake, or
    - Authenticate via cookies and perform authentication on the server side after the connection is established.
  - Be mindful of exposing sensitive tokens in URLs vs headers.

- Reliability and reconnection:
  - Clients should implement reconnection/backoff strategies if the connection drops.
  - Use ping/pong and heartbeats to detect dead connections.

- Message formats and contract:
  - Use a small, well-documented message envelope (e.g., JSON with `type` and `payload`) so you can evolve clients and servers independently.
  - Consider using binary formats (MessagePack, protobuf) for high-throughput scenarios.
