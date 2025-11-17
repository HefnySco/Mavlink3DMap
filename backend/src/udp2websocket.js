#!/usr/bin/env node

/************************************************************************
 * 
 * Author: Mohammad Said Hefny (mohammad.hefny@gmail.com)
 * Date:   Sep 2020
 * 
 * This tool enables you to connect your webpage with a udp connection. 
 * Hence UDP has not been directly supported from javascript yet, 
 * this tool creates a bi-directional channel between weboscket & udp.
 * 
 */

'use strict';
let webSocket = require('./websocket.js');
let udp = require('./udpclient.js');
const { program } = require('commander');
var pjson = require('../package.json');

var { mavlink20, MAVLink20Processor } = require('./mavlink');
var m_MAVLinkProcessor = new MAVLink20Processor();

program
  .version(pjson.version)
  .option('-p --udp_target_port <port number>', 'Mission Planner UDP Port', 16450)
  .parse(process.argv);

// Use program.opts() to reliably access the parsed options.
const options = program.opts();

console.log('Welcome to Mavlink3DMap Telemetry version ' + pjson.version);
console.log('Listen to MAVlink at :' + options.udp_target_port);
udp.startServer("0.0.0.0", options.udp_target_port);
webSocket.connect("127.0.0.1", 8811);

webSocket.onMessageReceived = function (message) {
  udp.sendMessage(message);
};



udp.onMessageReceived = function (message) {
  try {
    webSocket.sendMessageBinary(message);
  }
  catch (e) {
    console.log(e);
    return;
  }


};


console.log('UDP <------> WebSocket Adapter');

