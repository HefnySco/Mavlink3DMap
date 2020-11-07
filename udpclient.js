"use strict";
var dgram = require('dgram');



var HOST = '0.0.0.0';
var BroadCastTo = '0.0.0.0';
var server = undefined;
var BroadcastPort;
var remoteSocket = null;
var Me = this;
exports.startServer = function (host, port)
{
    BroadcastPort = port;
    _udp_server (host, port);
    
}

exports.onMessageReceived = undefined;


exports.sendMessage = function (message)
{
    _udp_client (message);
}


var _udp_server = function (host,port)
{
      
    server = dgram.createSocket('udp4');

    server.on('listening', function () {
            var address = host;
            console.log('UDP Listener Active');
     });

     server.on('message', function (message, remote) {
            /*try
            {
                var mavmsg = MAV.decode(message);
                if (mavmsg.name == 'HEARTBEAT')
                {
                    return
                }
            }
            catch (ex)
            {
                console.log ("error: %s",ex.message);
            }*/
            
            remoteSocket = remote;
            if (Me.onMessageReceived!= undefined)
            {
                Me.onMessageReceived (message);
            }
        });

    server.bind(port, host);
    // console.log ("UDP Listener at " + host + ":" + port);
}


var _udp_client = function (msg)
{
    //if (remoteSocket == null) return;
    //server.send(message, 0, message.length, remoteSocket.port, remoteSocket.address, function(err, bytes) {
    //console.log(MAV.decode(message));
   /* MAV.on('message', function (e)
    {
        e.pack(MAV);
        console.log (e);
        var mm = e.msgbuf;
       
    }); */
    /*var beacon =  new mavlink.messages.beacon_pos(1000,1000,200,10);
    var b = beacon.pack(MAV);
    b[0] = 254;
    Me.onMessageReceived (b);
    */
/*
    var mavmsg = null
    try {
        mavmsg = MAV.decode(message);
    }
    catch (e)
    {

    }
    if (mavmsg == null) return ;
    //var enc = mavmsg.pack(MAV);
    var enc =  mavmsg.pack(MAV);//,mavmsg.crc_extra,mavmsg.payload);
    ///console.log(message);
    ///console.log(mavmsg);
    enc[0] = 254;
    var msg = new Buffer(enc);; //enc.join("");
    console.log("MSG IS" + msg);
    */
   if (Listener === True)
   {
       if (remoteSocket != null)
       {
            server.send(msg, 0, msg.length, remoteSocket.port, remoteSocket.address, function(err, bytes) {
                //if (err) throw err;
                //console.log('UDP message sent to ' + '0.0.0.0' +':'+ BroadcastPort);
                });
        }
   }
   else
   {
    server.setBroadcast(true);
    server.send(msg, 0, msg.length, BroadcastPort, Target_IP, function(err, bytes) {
        //if (err) throw err;
        //console.log('UDP message sent to ' + '0.0.0.0' +':'+ BroadcastPort);
        });
    }
}




