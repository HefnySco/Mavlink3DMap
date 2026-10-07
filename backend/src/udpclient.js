"use strict";
var dgram = require('dgram');



var HOST = '0.0.0.0';
var BroadCastTo = '0.0.0.0';
var server = undefined;
var BroadcastPort;
var remoteSocket = null;
var Me = this;
exports.startServer = function (host, port) {
    BroadcastPort = port;
    _udp_server(host, port);
}

exports.onMessageReceived = undefined;


exports.sendMessage = function (message) {
    _udp_client(message);
}


var _udp_server = function (host, port) {
    server = dgram.createSocket('udp4');

    server.on('listening', function () {
        var address = host;
        console.log('UDP Listener Active');
    });

    server.on('message', function (message, remote) {


        remoteSocket = remote;
        if (Me.onMessageReceived != undefined) {
            Me.onMessageReceived(message);
        }
    });

    server.bind(port, host);
    // console.log ("UDP Listener at " + host + ":" + port);
}


var _udp_client = function (msg) {

    // reply to the last UDP peer heard; nothing to send to before that
    if (server === undefined || remoteSocket == null) return;
    server.send(msg, 0, msg.length, remoteSocket.port, remoteSocket.address, function (err, bytes) {
        //if (err) throw err;
        //console.log('UDP message sent to ' + '0.0.0.0' +':'+ BroadcastPort);
    });
}




