/* ********************************************************************************
* M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
* * Author: Mohammad S. Hefny
*
* Date:   05 NOV 2020
*
*********************************************************************************** */
import { mavlink20, MAVLink20Processor } from './js_mavlink_v2.js';
import { c_ArduVehicles } from './js_arduVehicles.js';
import { EVENTS as js_event } from './js_eventList.js'
import { js_eventEmitter } from './js_eventEmitter.js';


/* jshint esversion: 6 */
class c_WebSocketComm {

    constructor(p_targetURL) {
        this.m_WebSocket = null;
        this.m_isConnected = false;
        this.m_targetURL = p_targetURL || "ws://127.0.0.1:8811";

        this.fn_onWebSocketOpened = () => { };
        this.fn_onWebSocketError = () => { };
        this.fn_onError = () => { };
        this.fn_onPacketReceived = () => { };
    }

    fn_init(callback) {
        if (this.m_WebSocket && this.m_WebSocket.readyState !== WebSocket.CLOSED) {
            this.m_WebSocket.close();
        }

        this.m_WebSocket = new WebSocket(this.m_targetURL);
        this.m_WebSocket.binaryType = 'arraybuffer';

        this.m_WebSocket.onopen = (p_data) => {
            this.m_isConnected = true;
            callback();
            this.fn_onWebSocketOpened(p_data);
        };

        this.m_WebSocket.onmessage = (p_evt) => {
            this.fn_onPacketReceived(p_evt.data);
        };

        this.m_WebSocket.onclose = (err) => {
            console.log("Connection is closed...");
            this.m_isConnected = false;
            this.fn_onWebSocketError(err);
        };

        this.m_WebSocket.onerror = (err) => {
            console.error("WebSocket Error:", err);
            this.m_isConnected = false;
            this.fn_onWebSocketError(err);
        };
    }

    fn_send(p_data, p_isbinary) {
        try {
            if (this.m_WebSocket && this.m_WebSocket.readyState === WebSocket.OPEN) {
                this.m_WebSocket.send(p_data, { binary: p_isbinary });
            } else {
                this.fn_onError(new Error("WebSocket is not open."));
            }
        } catch (e) {
            this.fn_onError(e);
        }
    }
}

//---

class c_CommandParser extends c_WebSocketComm {
    constructor(p_url) {
        super(p_url);
        this.mavlinkProcessor = new MAVLink20Processor(null, 0, 0);
    }

    fn_initWebsocket(p_world) {
        const v_droneInProgress = new Set();
        const c_world = p_world;

        this.fn_onWebSocketOpened = () => {
            console.log("Socket Connected");
        };

        this.fn_init(() => {
            console.log("WebSocket connection established.");
        });

        this.fn_onPacketReceived = (data) => {
            if (!c_world || !(data instanceof ArrayBuffer)) return;

            const messages = this.mavlinkProcessor.parseBuffer(new Int8Array(data));
            for (const c_mavlinkMessage of messages) {
                if (c_mavlinkMessage.id === -1) {
                    // Assuming js_common.fn_console_log is defined elsewhere
                    console.log("BAD MAVLINK");
                    continue;
                }

                const srcSystem = c_mavlinkMessage.header.srcSystem;
                const v_vehicle = c_world.v_drone[srcSystem];

                switch (c_mavlinkMessage.header.msgId) {
                    case mavlink20.MAVLINK_MSG_ID_HEARTBEAT:
                        if (v_vehicle || v_droneInProgress.has(srcSystem)) return;

                        this.handleHeartbeat(srcSystem, v_droneInProgress, c_world, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_RC_CHANNELS:
                        if (v_vehicle) this.handleRCChannels(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_SERVO_OUTPUT_RAW:
                        if (v_vehicle) this.handleServosOutputs(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_LOCAL_POSITION_NED:
                        if (v_vehicle) this.handleLocalPosition(v_vehicle, c_world, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_ATTITUDE:
                        if (v_vehicle) this.handleAttitude(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_HOME_POSITION:
                        if (v_vehicle) this.handleHomePosition(v_vehicle, c_mavlinkMessage);
                        break;
                }
            }
        };
    }

    handleHeartbeat(src, v_droneInProgress, c_world, c_mavlinkMessage) {

        v_droneInProgress.add(src);

        const v_vehicle_new = new c_ArduVehicles();
        v_vehicle_new.fn_createVehicle(c_mavlinkMessage.type, true, null,
            () => {
                v_vehicle_new.fn_setPosition(0, 0, 0);
                v_vehicle_new.fn_castShadow(false);

                c_world.v_scene.add(v_vehicle_new.fn_getMesh());
                c_world.v_drone[src] = v_vehicle_new;
                c_world.fn_registerCamerasOfObject(v_vehicle_new);
                v_droneInProgress.delete(src);

                v_vehicle_new.fn_switchTriggerOn = () => {
                    v_vehicle_new.m_trigger.fn_trigger(null, (v_threeObj, v_physicsObj) => {
                        c_world.v_physicsWorld.addRigidBody(v_physicsObj);
                        c_world.v_scene.add(v_threeObj);
                        c_world.v_rigidBodies.push(v_threeObj);
                    });
                };
            },
            (p_friendObject) => {
                c_world.v_scene.add(p_friendObject);
            }
        );
    }

    handleRCChannels(v_vehicle, c_mavlinkMessage) {
        const channels = [
            c_mavlinkMessage.chan9_raw, c_mavlinkMessage.chan10_raw,
            c_mavlinkMessage.chan11_raw, c_mavlinkMessage.chan12_raw,
            c_mavlinkMessage.chan13_raw, c_mavlinkMessage.chan14_raw,
            c_mavlinkMessage.chan15_raw, c_mavlinkMessage.chan16_raw
        ];
        v_vehicle.fn_setRCChannels(9, channels);
    }

    handleServosOutputs(v_vehicle, c_mavlinkMessage) {
        const servos = [
            c_mavlinkMessage.servo9_raw, c_mavlinkMessage.servo10_raw,
            c_mavlinkMessage.servo11_raw, c_mavlinkMessage.servo12_raw,
            c_mavlinkMessage.servo13_raw, c_mavlinkMessage.servo14_raw,
            c_mavlinkMessage.servo15_raw, c_mavlinkMessage.servo16_raw
        ];
        v_vehicle.fn_setServosOutputs(9, servos);
    }

    handleLocalPosition(v_vehicle, c_world, c_mavlinkMessage) {
        v_vehicle.fn_setPosition(
            c_mavlinkMessage.x,
            c_mavlinkMessage.y,
            c_world.v_height3D - c_mavlinkMessage.z
        );

        js_eventEmitter.fn_dispatch(js_event.EVT_VEHICLE_POS_CHANGED, v_vehicle);
    }

    handleAttitude(v_vehicle, c_mavlinkMessage) {
        v_vehicle.fn_setRotation(
            c_mavlinkMessage.roll,
            c_mavlinkMessage.pitch,
            -c_mavlinkMessage.yaw
        );
    }

    handleHomePosition(v_vehicle, c_mavlinkMessage) {
        js_eventEmitter.fn_dispatch(js_event.EVT_VEHICLE_HOME_CHANGED,
            {
                lat: c_mavlinkMessage.latitude,
                lng: c_mavlinkMessage.longitude
            });
    }
}

export { c_WebSocketComm, c_CommandParser };