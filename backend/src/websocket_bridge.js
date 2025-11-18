// backend/src/ws_bridge_8811_8812.js
const WebSocket = require('ws');
const { program } = require('commander');
const pjson = require('../package.json');

program
  .version(pjson.version)
  .option('-a --port_a <port number>', 'WebSocket server A port', 8811)
  .option('-b --port_b <port number>', 'WebSocket server B port', 8812)
  .parse(process.argv);

const options = program.opts();

const PORT_A = options.port_a;
const PORT_B = options.port_b;

// Track clients of each server
const clientsA = new Set();
const clientsB = new Set();

// Create first WebSocket server on 8811
const wssA = new WebSocket.Server({ port: PORT_A }, () => {
  console.log(`WebSocket server A listening on port ${PORT_A}`);
});

// Create second WebSocket server on 8812
const wssB = new WebSocket.Server({ port: PORT_B }, () => {
  console.log(`WebSocket server B listening on port ${PORT_B}`);
});

// Helper to broadcast to all clients in a Set, except optionally one
function broadcast(clients, data, exclude) {
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: true });
    }
  }
}

// Handle connections for server A (port 8811)
wssA.on('connection', (socket) => {
  clientsA.add(socket);
  console.log(`Client connected to A (${PORT_A}). Total A clients:`, clientsA.size);

  socket.on('message', (data) => {
    // Forward to all clients of server B
    broadcast(clientsB, data);
  });

  socket.on('close', () => {
    clientsA.delete(socket);
    console.log(`Client disconnected from A (${PORT_A}). Total A clients:`, clientsA.size);
  });

  socket.on('error', (err) => {
    console.error('WebSocket error on A:', err);
  });
});

// Handle connections for server B (port 8812)
wssB.on('connection', (socket) => {
  clientsB.add(socket);
  console.log(`Client connected to B (${PORT_B}). Total B clients:`, clientsB.size);

  socket.on('message', (data) => {
    // Forward to all clients of server A
    broadcast(clientsA, data);
  });

  socket.on('close', () => {
    clientsB.delete(socket);
    console.log(`Client disconnected from B (${PORT_B}). Total B clients:`, clientsB.size);
  });

  socket.on('error', (err) => {
    console.error('WebSocket error on B:', err);
  });
});

// If you want to require() this file from another script, you can export something,
// but just requiring it will start the servers due to side effects.
module.exports = { wssA, wssB };