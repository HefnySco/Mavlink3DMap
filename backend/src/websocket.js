"use strict";

var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

var wsS;
var Me = this;

// every browser tab currently connected; telemetry is broadcast to all of them
var connectedClients = new Set();

exports.connect = function (host, port) {
    wsS = new WebSocketServer(
        {
            host: host,
            port: port
        }); // start websocket server
    console.log("WebSocket Listener at " + host + ":" + port);
    wsS.on('connection', onConnect_Handler);

}



exports.onMessageReceived = undefined;


var _sendToAllClients = function (message, binary) {
    connectedClients.forEach(function (client) {

        // drop sockets that already went away without a clean close
        if (client.readyState !== WebSocket.OPEN) {
            connectedClients.delete(client);
            return;
        }
        try {

            client.send(message, { binary: binary });
        }
        catch (e) {
            connectedClients.delete(client);
        }
    });

}

exports.sendMessageBinary = function (message) {
    _sendToAllClients(message, true);
}

exports.sendMessage = function (message) {
    _sendToAllClients(message, false);
}

function onConnect_Handler(ws) {
    connectedClients.add(ws);

    console.log("WebSocket Listener Active (" + connectedClients.size + " client(s))");
    function onWsMessage(message, flags) {

        if (Me.onMessageReceived != undefined) {
            Me.onMessageReceived(message);
        }
    }

    function onWsClose(code) {
        console.log("closing %s", code);

        connectedClients.delete(ws);
    }

    function onWsError(err) {
        console.error('onWsError: client error: %s', JSON.stringify(err));

        connectedClients.delete(ws);
    }


    ws.on('message', onWsMessage);
    ws.on('close', onWsClose);
    ws.on('error', onWsError);
}

