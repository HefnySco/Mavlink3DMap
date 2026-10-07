"use strict";
var dgram = require('dgram');
var { mavlink20, MAVLink20Processor } = require('./mavlink.js');



var HOST = '0.0.0.0';
var BroadCastTo = '0.0.0.0';
var server = undefined;
var BroadcastPort;
var remoteSocket = null;
var Me = this;

// identity stamped on messages the bridge originates itself (a GCS-style sender)
var BRIDGE_SYSTEM_ID = 255;
var BRIDGE_COMPONENT_ID = 190; // MAV_COMP_ID_MISSIONPLANNER

// each vehicle is asked for full-rate telemetry when first heard, then re-asked
// periodically because SITL forgets the requested rates when it reboots
var STREAM_REQUEST_RATE_HZ = 10;
var STREAM_REQUEST_INTERVAL_MS = 30000;
var PEER_TIMEOUT_MS = 90000;

// UDP peers keyed by MAVLink source system id, so replies reach the vehicle they
// were addressed to instead of whichever one spoke last
// udpPeers[sysid] = { sysid, address, port, last_seen }
var udpPeers = {};
var streamRequestTimer = null;

// packs the REQUEST_DATA_STREAM frames the bridge originates
var bridgeMavlink = new MAVLink20Processor(null, BRIDGE_SYSTEM_ID, BRIDGE_COMPONENT_ID);
// decodes browser->vehicle frames so they can be routed by target_system
var outboundMavlinkParser = new MAVLink20Processor();

exports.startServer = function (host, port) {
    BroadcastPort = port;
    _udp_server(host, port);
    streamRequestTimer = setInterval(_requestStreamsFromLivePeers, STREAM_REQUEST_INTERVAL_MS);
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

        // remember which vehicle each MAVLink sysid is reachable at
        var source_systems = _extractSourceSystems(message);
        for (var i = 0; i < source_systems.length; i++) {
            _registerPeer(source_systems[i], remote);
        }

        if (Me.onMessageReceived != undefined) {
            Me.onMessageReceived(message);
        }
    });

    server.bind(port, host);
    // console.log ("UDP Listener at " + host + ":" + port);
}


// walk a datagram and collect the sysid of every MAVLink frame inside it
var _extractSourceSystems = function (message) {
    var source_systems = [];
    var index = 0;

    while (index < message.length) {
        var marker = message[index];
        var header_length;
        var sysid_offset;

        if (marker === mavlink20.PROTOCOL_MARKER_V2) {
            header_length = mavlink20.HEADER_LEN_V2;
            sysid_offset = 5; // magic, len, incompat, compat, seq, sysid, ...
        }
        else if (marker === mavlink20.PROTOCOL_MARKER_V1) {
            header_length = mavlink20.HEADER_LEN_V1;
            sysid_offset = 3; // magic, len, seq, sysid, ...
        }
        else {
            // not a frame boundary, resync on the next byte
            index += 1;
            continue;
        }

        if (index + header_length > message.length) break;

        var frame_length = header_length + message[index + 1] + 2;
        if (marker === mavlink20.PROTOCOL_MARKER_V2 &&
            (message[index + 2] & mavlink20.MAVLINK_IFLAG_SIGNED) !== 0) {
            frame_length += mavlink20.MAVLINK_SIGNATURE_BLOCK_LEN;
        }

        var source_system = message[index + sysid_offset];
        if (source_systems.indexOf(source_system) === -1) {
            source_systems.push(source_system);
        }

        index += frame_length;
    }

    return source_systems;
}


var _registerPeer = function (source_system, remote) {
    var peer = udpPeers[source_system];
    if (peer != undefined) {
        // the same vehicle may come back on a different address/port after a reboot
        peer.address = remote.address;
        peer.port = remote.port;
        peer.last_seen = Date.now();
        return;
    }

    peer = {
        sysid: source_system,
        address: remote.address,
        port: remote.port,
        last_seen: Date.now()
    };
    udpPeers[source_system] = peer;
    console.log('New MAVLink peer sysid ' + source_system + ' at ' + remote.address + ':' + remote.port);

    // SITL only streams slow defaults until asked; request full telemetry right away
    _requestDataStream(peer);
}


// ask a vehicle to start streaming all of its data streams
var _requestDataStream = function (peer) {
    if (server === undefined || peer == undefined) return;

    var request = new mavlink20.messages.request_data_stream(
        peer.sysid,                 // target_system
        0,                          // target_component: all components
        0,                          // req_stream_id: MAV_DATA_STREAM_ALL
        STREAM_REQUEST_RATE_HZ,     // req_message_rate
        1);                         // start_stop: 1 = start sending
    var packet = Buffer.from(request.pack(bridgeMavlink));
    bridgeMavlink.seq = (bridgeMavlink.seq + 1) % 256;

    _sendToPeer(peer, packet);
}


// periodic stream re-request for every vehicle still talking to us
var _requestStreamsFromLivePeers = function () {
    var now = Date.now();
    for (var sysid in udpPeers) {
        var peer = udpPeers[sysid];
        if (now - peer.last_seen > PEER_TIMEOUT_MS) {
            // vehicle went silent; do not keep replying to it
            delete udpPeers[sysid];
            continue;
        }
        _requestDataStream(peer);
    }
}


// pull target_system out of a browser->vehicle frame; 0 means the message is not
// addressed to a specific system and should be broadcast to every peer
var _decodeTargetSystem = function (message) {
    var target_system = 0;
    var decoded_messages = null;

    try {
        decoded_messages = outboundMavlinkParser.parseBuffer(message);
    }
    catch (e) {
        return 0;
    }

    if (decoded_messages == null) return 0;

    for (var i = 0; i < decoded_messages.length; i++) {
        var decoded = decoded_messages[i];
        if (decoded != null && decoded.target_system != undefined && decoded.target_system > 0) {
            target_system = decoded.target_system;
        }
    }

    return target_system;
}


var _sendToPeer = function (peer, msg) {
    server.send(msg, 0, msg.length, peer.port, peer.address, function (err, bytes) {
        //if (err) throw err;
        //console.log('UDP message sent to ' + peer.address +':'+ peer.port);
    });
}


var _udp_client = function (msg) {

    // nothing to send to before the server is up
    if (server === undefined) return;

    var target_system = _decodeTargetSystem(msg);

    // message addressed to a specific vehicle we already heard from
    if (target_system > 0 && udpPeers[target_system] != undefined) {
        _sendToPeer(udpPeers[target_system], msg);
        return;
    }

    // untargeted message, or aimed at a vehicle we have not heard yet: broadcast
    var peer_count = 0;
    for (var sysid in udpPeers) {
        _sendToPeer(udpPeers[sysid], msg);
        peer_count += 1;
    }

    // no MAVLink peer identified yet; fall back to whoever spoke last
    if (peer_count === 0 && remoteSocket != null) {
        server.send(msg, 0, msg.length, remoteSocket.port, remoteSocket.address, function (err, bytes) {
            //if (err) throw err;
            //console.log('UDP message sent to ' + '0.0.0.0' +':'+ BroadcastPort);
        });
    }
}
