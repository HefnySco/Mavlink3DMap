/* ********************************************************************************
*   
*   A N D R U A V - W E B S O C K E T  C O M M        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   10 Sep 2020
*
*********************************************************************************** */

"use strict";

/*jshint esversion: 6 */


function fn_websocketComm (p_targetURL)
{
    var Me = this;
	this.m_WebSocket  = null;
	this.m_isConnected = false;

    this.fn_onWebSocketOpened = function (e) {};
    this.fn_onWebSocketError = function (e) {};
    this.fn_onError = function (e) {};
    this.fn_onPacketReceived = function (e) {};
	
	
    this.fn_init =  function init (callback)
    {
		if (Me.m_WebSocket != null)
		{
			Me.m_WebSocket.close()
		}
		
		Me.m_WebSocket = new WebSocket(p_targetURL?p_targetURL:"ws://127.0.0.1:8811");
				

		Me.m_WebSocket.onopen = function(p_data)
		{
			Me.m_isConnected = true;
			callback();
			Me.fn_onWebSocketOpened(p_data);
		};
					
		Me.m_WebSocket.onmessage = function (p_evt) 
		{ 
			Me.fn_onPacketReceived (p_evt.data);
		};
					
		Me.m_WebSocket.onclose = function(err)
		{ 
		    // websocket is closed.
			console.log("Connection is closed..."); 
			Me.m_isConnected = false;
			Me.fn_onWebSocketError(err);
		};
		
		Me.m_WebSocket.onerror = function (err)
		{
			Me.m_isConnected = false;
			Me.fn_onWebSocketError(err);
		}
    };

    
    this.fn_send = function (p_data, p_isbinary)
    {
        try
        {
            if (Me.m_WebSocket.readyState != 1) 
            {
                Me.fn_onError (null);
                return;
            }
            Me.m_WebSocket.send (p_data, {binary: p_isbinary});
        }
        catch (e)
        {	
            Me.fn_onError(e);	
        }
    };

}

