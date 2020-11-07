"use strict";

var WebSocketServer = require('ws').Server;

var wsS;
var Me = this;

exports.connect = function (host,port)
{
    wsS = new WebSocketServer(
    {
        host: host,
        port: port
    }); // start websocket server
    console.log ("WebSocket Listener at " + host + ":" + port);
    wsS.on('connection', onConnect_Handler);

}



exports.onMessageReceived = undefined;
exports.sendMessage = function (message)
{
    if (Me.ws != null)
    {
        try
        {
            
            Me.ws.send (message , {binary: false});
        }
        catch (e)
        {
            Me.ws = undefined;
        }
    }

}

function onConnect_Handler(ws)
{
     Me.ws = ws;

     console.log("WebSocket Listener Active"); 
     function onWsMessage(message, flags)
     {
           //console.log(message);

           if (Me.onMessageReceived!= undefined)
           {
               Me.onMessageReceived (message);
           }
      }

      function onWsClose(code)
      {  
           // code: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent

            console.log("closing %s", code);

            ws = undefined;
       }

       function onWsError(ws, err)
       {
            console.error('onWsError: Client #%d error: %s', ws.id, JSON.stringify(err));

            //_dumpError.dumperror(err);
        }


        ws.on('message', onWsMessage);
        ws.on('close', onWsClose);
        ws.on('error', onWsError);
}

