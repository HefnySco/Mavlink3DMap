/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   05 NOV 2020
*
*********************************************************************************** */
import { mavlink20, MAVLink20Processor } from './js_mavlink_v2.js'
import { c_ArduVehicles } from './js_arduVehicles.js'; // Placeholder: Ensure this file exists
 

/*jshint esversion: 6 */
class c_WebSocketComm 
{
	
    constructor (p_targetURL)
    {
        this.m_WebSocket  = null;
        this.m_isConnected = false;
        this.m_targetURL = p_targetURL;
        
        this.fn_onWebSocketOpened = function (e) {};
        this.fn_onWebSocketError = function (e) {};
        this.fn_onError = function (e) {};
        this.fn_onPacketReceived = function (e) {};
    }


    fn_init (callback)
    {
        var Me = this;
        if (this.m_WebSocket != null)
		{
			this.m_WebSocket.close()
		}
		
		this.m_WebSocket = new WebSocket(this.m_targetURL?this.m_targetURL:"ws://127.0.0.1:8811");
				

		this.m_WebSocket.onopen = function(p_data)
		{
			Me.m_isConnected = true;
			callback();
			Me.fn_onWebSocketOpened(p_data);
		};
					
		this.m_WebSocket.onmessage = function (p_evt) 
		{ 
			Me.fn_onPacketReceived (p_evt.data);
		};
					
		this.m_WebSocket.onclose = function(err)
		{ 
		    // websocket is closed.
			console.log("Connection is closed..."); 
			Me.m_isConnected = false;
			Me.fn_onWebSocketError(err);
		};
		
		this.m_WebSocket.onerror = function (err)
		{
		    //alert ("No Websockets Listener Found\r\n Please check https://www.npmjs.com/package/andruavwebplugin for details.");
			Me.m_isConnected = false;
			Me.fn_onWebSocketError(err);
		}
    }

    fn_send (p_data, p_isbinary)
    {
        try
        {
            if (this.m_WebSocket.readyState != 1) 
            {
                this.fn_onError (null);
                return;
            }
            this.m_WebSocket.send (p_data, {binary: p_isbinary});
        }
        catch (e)
        {	
            this.fn_onError(e);	
        }
    };
};

class c_CommandParser extends (c_WebSocketComm)
{
    constructor(p_url)
    {
        super (p_url);

        if (p_url == null)
        {
            this.m_targetURL = "ws://127.0.0.1:8811";
        }
        
    }

    fn_initWebsocket (p_world)
    {
        var v_droneInProgress = {};
        var c_world = p_world;
        var my_webcomm = this; //new c_WebSocketComm ();
        my_webcomm.fn_onWebSocketOpened = function ()
        {
            console.log ("Socket Connected");
        };

        my_webcomm.fn_init(
            function (e)
            {
                console.log (e);
            });

        my_webcomm.fn_onPacketReceived = function (e)
        {
            if (c_world == null ) return ;
            var msg = JSON.parse(e);
            switch (msg.id)
            {
                case  mavlink20.MAVLINK_MSG_ID_HEARTBEAT:
                {
                    // Racing condition here as time c_world.v_drone[msg.src] takes time to be filled.
                    if (c_world.v_drone[msg.src] != null) break;
                    if (v_droneInProgress.hasOwnProperty(msg.src) === true) break; // in progress
                    v_droneInProgress[msg.src] = true
                    
                    var v_vehicle = new c_ArduVehicles();
                    v_vehicle.fn_createVehicle(msg.type, true, null, 
                        function ()
                        {
                            v_vehicle.fn_setPosition (0,0,0);
                            v_vehicle.fn_castShadow(false);
                            
                            c_world.v_scene.add(v_vehicle.fn_getMesh());
                            c_world.v_drone[msg.src] = v_vehicle;
                            c_world.fn_registerCamerasOfObject (v_vehicle);

                                            
                            v_vehicle.fn_switchTriggerOn = function ()
                            {
                                v_vehicle.m_trigger.fn_trigger(null, 
                                    function (v_threeObj, v_physicsObj)
                                    {
                                        c_world.v_physicsWorld.addRigidBody( v_physicsObj );
                                        c_world.v_scene.add(v_threeObj);
                                        c_world.v_rigidBodies.push( v_threeObj);
                                    });
                            };
                        }, 
                        function(p_friendObject)
                        {
                            c_world.v_scene.add(p_friendObject);   
                        }
                        );
                                    
                                    
                }
                break;

                case mavlink20.MAVLINK_MSG_ID_RC_CHANNELS:
                {
                    const v_vehicle = c_world.v_drone[msg.src];
                    if (v_vehicle == null) return ;
                    v_vehicle.fn_setRCChannels (msg.startIndex, msg.channels);
                }
                break;
                                
                case mavlink20.MAVLINK_MSG_ID_SERVO_OUTPUT_RAW:
                {
                    const v_vehicle = c_world.v_drone[msg.src];
                    if (v_vehicle == null) return ;
                    v_vehicle.fn_setServosOutputs (msg.startIndex, msg.servos);
                }
                break;
                                
                case mavlink20.MAVLINK_MSG_ID_LOCAL_POSITION_NED:
                {
                    const v_vehicle = c_world.v_drone[msg.src];
                    if (v_vehicle == null) return ;
                    v_vehicle.fn_setPosition (msg.x , msg.y ,  c_world.v_height3D  - msg.z );
                }
                break;

                case mavlink20.MAVLINK_MSG_ID_ATTITUDE:
                {
                const v_vehicle = c_world.v_drone[msg.src];
                if (v_vehicle == null) return ;
                                    
                v_vehicle.fn_setRotation (msg.roll, msg.pitch, -msg.yaw);
                                    
                }
                break;

            };
        };

    };
};


export { c_WebSocketComm , c_CommandParser};