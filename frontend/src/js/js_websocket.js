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
class c_WebSocketComm {

    constructor(p_targetURL) {
        this.m_WebSocket = null;
        this.m_isConnected = false;
        this.m_targetURL = p_targetURL;

        this.fn_onWebSocketOpened = function (e) { };
        this.fn_onWebSocketError = function (e) { };
        this.fn_onError = function (e) { };
        this.fn_onPacketReceived = function (e) { };
    }


    fn_init(callback) {
        var Me = this;
        if (this.m_WebSocket != null) {
            this.m_WebSocket.close()
        }

        this.m_WebSocket = new WebSocket(this.m_targetURL ? this.m_targetURL : "ws://127.0.0.1:8811");
        this.m_WebSocket.binaryType = 'arraybuffer';


        this.m_WebSocket.onopen = function (p_data) {
            Me.m_isConnected = true;
            callback();
            Me.fn_onWebSocketOpened(p_data);
        };

        this.m_WebSocket.onmessage = function (p_evt) {
            Me.fn_onPacketReceived(p_evt.data);
        };

        this.m_WebSocket.onclose = function (err) {
            // websocket is closed.
            console.log("Connection is closed...");
            Me.m_isConnected = false;
            Me.fn_onWebSocketError(err);
        };

        this.m_WebSocket.onerror = function (err) {
            //alert ("No Websockets Listener Found\r\n Please check https://www.npmjs.com/package/andruavwebplugin for details.");
            Me.m_isConnected = false;
            Me.fn_onWebSocketError(err);
        }
    }

    fn_send(p_data, p_isbinary) {
        try {
            if (this.m_WebSocket.readyState != 1) {
                this.fn_onError(null);
                return;
            }
            this.m_WebSocket.send(p_data, { binary: p_isbinary });
        }
        catch (e) {
            this.fn_onError(e);
        }
    };
};

class c_CommandParser extends (c_WebSocketComm)
{
    constructor(p_url) {
        super(p_url);

        if (p_url == null) {
            this.m_targetURL = "ws://127.0.0.1:8811";
        }

        this.mavlinkProcessor = new MAVLink20Processor(null, 0, 0);

    }

    fn_initWebsocket(p_world) {
        var v_droneInProgress = {};
        var c_world = p_world;
        var my_webcomm = this; //new c_WebSocketComm ();

        my_webcomm.fn_onWebSocketOpened = function () {
            console.log("Socket Connected");
        };

        my_webcomm.fn_init(
            function (e) {
                console.log(e);
            });

        my_webcomm.fn_onPacketReceived = function (data) {
            if (c_world == null) return;
            if (!(data instanceof ArrayBuffer)) return;
            const messages = this.mavlinkProcessor.parseBuffer(new Int8Array(data));
            for (const c_mavlinkMessage of messages) {
                if (c_mavlinkMessage.id === -1) {
                    js_common.fn_console_log("BAD MAVLINK");
                    continue;
                }
                switch (c_mavlinkMessage.header.msgId) {
                    case mavlink20.MAVLINK_MSG_ID_HEARTBEAT:
                        {
                            const src = c_mavlinkMessage.header.srcSystem;
                            // Racing condition here as time c_world.v_drone[src] takes time to be filled.
                            if (c_world.v_drone[src] != null) break;
                            if (v_droneInProgress.hasOwnProperty(src) === true) break; // in progress
                            v_droneInProgress[src] = true

                            var v_vehicle = new c_ArduVehicles();
                            v_vehicle.fn_createVehicle(c_mavlinkMessage.type, true, null,
                                function () {
                                    v_vehicle.fn_setPosition(0, 0, 0);
                                    v_vehicle.fn_castShadow(false);

                                    c_world.v_scene.add(v_vehicle.fn_getMesh());
                                    c_world.v_drone[src] = v_vehicle;
                                    c_world.fn_registerCamerasOfObject(v_vehicle);


                                    v_vehicle.fn_switchTriggerOn = function () {
                                        v_vehicle.m_trigger.fn_trigger(null,
                                            function (v_threeObj, v_physicsObj) {
                                                c_world.v_physicsWorld.addRigidBody(v_physicsObj);
                                                c_world.v_scene.add(v_threeObj);
                                                c_world.v_rigidBodies.push(v_threeObj);
                                            });
                                    };
                                },
                                function (p_friendObject) {
                                    c_world.v_scene.add(p_friendObject);
                                }
                            );


                        }
                        break;

                    case mavlink20.MAVLINK_MSG_ID_RC_CHANNELS:
                        {
                            const v_vehicle = c_world.v_drone[c_mavlinkMessage.header.srcSystem];
                            if (v_vehicle == null) return;
                            const channels = [
                                c_mavlinkMessage.chan9_raw,
                                c_mavlinkMessage.chan10_raw,
                                c_mavlinkMessage.chan11_raw,
                                c_mavlinkMessage.chan12_raw,
                                c_mavlinkMessage.chan13_raw,
                                c_mavlinkMessage.chan14_raw,
                                c_mavlinkMessage.chan15_raw,
                                c_mavlinkMessage.chan16_raw
                            ]
                            v_vehicle.fn_setRCChannels(9, channels);
                        }
                        break;

                    case mavlink20.MAVLINK_MSG_ID_SERVO_OUTPUT_RAW:
                        {
                            const v_vehicle = c_world.v_drone[c_mavlinkMessage.header.srcSystem];
                            if (v_vehicle == null) return;
                            const servos = [
                                c_mavlinkMessage.servo9_raw,
                                c_mavlinkMessage.servo10_raw,
                                c_mavlinkMessage.servo11_raw,
                                c_mavlinkMessage.servo12_raw,
                                c_mavlinkMessage.servo13_raw,
                                c_mavlinkMessage.servo14_raw,
                                c_mavlinkMessage.servo15_raw,
                                c_mavlinkMessage.servo16_raw
                            ];

                            v_vehicle.fn_setServosOutputs(9, servos);
                        }
                        break;

                    case mavlink20.MAVLINK_MSG_ID_LOCAL_POSITION_NED:
                        {
                            const v_vehicle = c_world.v_drone[c_mavlinkMessage.header.srcSystem];
                            if (v_vehicle == null) return;
                            v_vehicle.fn_setPosition(c_mavlinkMessage.x, c_mavlinkMessage.y, c_world.v_height3D - c_mavlinkMessage.z);
                        }
                        break;

                    case mavlink20.MAVLINK_MSG_ID_ATTITUDE:
                        {
                            const v_vehicle = c_world.v_drone[c_mavlinkMessage.header.srcSystem];
                            if (v_vehicle == null) return;

                            v_vehicle.fn_setRotation(c_mavlinkMessage.roll, c_mavlinkMessage.pitch, -c_mavlinkMessage.yaw);

                        }
                        break;

                };
            };
        };

    };
};


export { c_WebSocketComm, c_CommandParser };