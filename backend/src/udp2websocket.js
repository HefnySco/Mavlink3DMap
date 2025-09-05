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
let webSocket = require ('./websocket.js');
let udp = require ('./udpclient.js');
const { program } = require('commander');
var pjson = require('../package.json');

var {mavlink20, MAVLink20Processor} = require('./mavlink');
var m_MAVLinkProcessor= new MAVLink20Processor();

program
  .version(pjson.version)
  //.option('-h --html_port <port>', 'port number that your html code will connect to',8811)
  //.option('-u --udp_ip <ip address>', 'IP of UDP Listener', '0.0.0.0')
  .option('-p --udp_target_port <port number>', 'Mission Planner UDP Port', 16450)
  .parse(process.argv);

  // Use program.opts() to reliably access the parsed options.
  const options = program.opts();

console.log ('Welcome to Mavlink3DMap Telemetry version ' + pjson.version );
console.log('Listen to MAVlink at :' + options.udp_target_port);
udp.startServer ("0.0.0.0",options.udp_target_port);
webSocket.connect("127.0.0.1",8811);

webSocket.onMessageReceived = function (message)
{
   // console.log ("from WS: " + message)

    udp.sendMessage (message);
};

/**
 * 'msgID': div value ... [0] means dont send
 */
var msgsDelay = {
      '36':4,
      '65':4,
};
var msgsCounter = {
      '36':0,
      '65':0,
};

udp.onMessageReceived = function (message)
{
    try
    {
      webSocket.sendMessageBinary (message);

      // var res = m_MAVLinkProcessor.decode(message);
      // var data = null;
      // const c_header = res.header ;
      // switch (c_header.msgId)
      // {
      //   case 65: //'MAVLINK_MSG_ID_RC_CHANNELS'
      //     msgsCounter['65'] +=1;
      //     if ((msgsCounter['65'] % msgsDelay['65']) != 0) return ;
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id    : 65,
      //       startIndex: 9,
      //       channels: [ 
      //                   res.chan9_raw,
      //                   res.chan10_raw,
      //                   res.chan11_raw,
      //                   res.chan12_raw,
      //                   res.chan13_raw,
      //                   res.chan14_raw,
      //                   res.chan15_raw,
      //                   res.chan16_raw
      //                 ]
      //     };
      //   break;

      //   case 36: //'MAVLINK_MSG_ID_SERVO_OUTPUT_RAW'
      //     //msgsCounter['36'] +=1;
      //     //if ((msgsCounter['36'] % msgsDelay['36']) != 0) return ;
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id    : 36,
      //       startIndex: 9,
      //       servos : [
      //                 res.servo9_raw, 
      //                 res.servo10_raw,
      //                 res.servo11_raw,
      //                 res.servo12_raw,
      //                 res.servo13_raw,
      //                 res.servo14_raw,
      //                 res.servo15_raw,
      //                 res.servo16_raw
      //               ]
      //     };
      //   break;

      //   case 30: //'ATTITUDE'
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id    : 30,
      //       roll  : res.roll,
      //       pitch : res.pitch,
      //       yaw   : res.yaw,
      //     };
      //   break;

      //   case 24: //'GPS RAW'
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id   : 24,
      //       lat  : res.lat,
      //       lng  : res.lng,
      //       alt  : res.alt,
      //     };
      //   break;

      //   case 0: //'HEARTBEAT'
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id   : 0,
      //       type : res.type,
      //     };
      //   break;

      //   case 32: //'MAVLINK_MSG_ID_LOCAL_POSITION_NED'
      //     data = 
      //     {
      //       src  : c_header.srcSystem,
      //       id   : 32,
      //       x : res.x,
      //       y : res.y,
      //       z : res.z
      //     };
      //   break;
      // }
     
      
      // if (data != null) 
      // {
      //   webSocket.sendMessage (JSON.stringify(data));
      //   //console.log (data);
      // }
      
    }
    catch (e)
    {
      console.log(e);
        return ;
    }

    
};


console.log ('UDP <------> WebSocket Adapter');

