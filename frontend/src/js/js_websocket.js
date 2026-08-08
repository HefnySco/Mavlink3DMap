/* ********************************************************************************
* M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
* * Author: Mohammad S. Hefny
*
* Date:   05 NOV 2020
*
*********************************************************************************** */
import { mavlink20, MAVLink20Processor } from './js_mavlink_v2.js';
import { js_mavlinkHandler } from './js_mavlinkHandler.js';
import { js_statusOverlay } from './js_statusOverlay.js';


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

        this.m_reconnectTimer = null;
        this.m_reconnectDelayMs = 3000;
        this.m_shouldReconnect = false;
        this.m_initCallback = null;
    }

    fn_init(callback) {
        if (this.m_WebSocket && this.m_WebSocket.readyState !== WebSocket.CLOSED) {
            this.m_WebSocket.close();
        }

        this.m_shouldReconnect = true;
        this.m_initCallback = callback;
        this.#fn_connect();
    }

    #fn_connect() {
        this.m_WebSocket = new WebSocket(this.m_targetURL);
        this.m_WebSocket.binaryType = 'arraybuffer';

        this.m_WebSocket.onopen = (p_data) => {
            this.m_isConnected = true;
            if (this.m_initCallback) {
                this.m_initCallback();
                this.m_initCallback = null;
            }
            this.fn_onWebSocketOpened(p_data);
        };

        this.m_WebSocket.onmessage = (p_evt) => {
            this.fn_onPacketReceived(p_evt.data);
        };

        this.m_WebSocket.onclose = (err) => {
            this.m_isConnected = false;
            this.fn_onWebSocketError(err);
            this.#fn_scheduleReconnect();
        };

        this.m_WebSocket.onerror = (err) => {
            this.m_isConnected = false;
            this.fn_onWebSocketError(err);
        };
    }

    #fn_scheduleReconnect() {
        if (!this.m_shouldReconnect) return;
        if (this.m_reconnectTimer !== null) return;
        this.m_reconnectTimer = setTimeout(() => {
            this.m_reconnectTimer = null;
            if (this.m_shouldReconnect) {
                this.#fn_connect();
            }
        }, this.m_reconnectDelayMs);
    }

    fn_disconnect() {
        this.m_shouldReconnect = false;
        if (this.m_reconnectTimer !== null) {
            clearTimeout(this.m_reconnectTimer);
            this.m_reconnectTimer = null;
        }
        if (this.m_WebSocket) {
            this.m_WebSocket.close();
            this.m_WebSocket = null;
        }
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
            js_statusOverlay.fn_setConnected();
        };

        this.fn_init(() => {
            console.log("WebSocket connection established.");
            js_statusOverlay.fn_setConnected();
        });

        this.fn_onWebSocketError = (err) => {
            // Reconnect handled by base class; suppress noise
            js_statusOverlay.fn_setError();
        };

        this.fn_onPacketReceived = (data) => {

            if (!c_world || !(data instanceof ArrayBuffer)) return;
            js_statusOverlay.fn_onPacket();

            const messages = this.mavlinkProcessor.parseBuffer(new Int8Array(data));
            for (const c_mavlinkMessage of messages) {
                if (c_mavlinkMessage.id === -1) {
                    console.log("BAD MAVLINK");
                    continue;
                }

                const srcSystem = c_mavlinkMessage.header.srcSystem;
                let v_vehicle = c_world.v_drone[srcSystem];

                // Auto-create vehicle on first message from unknown srcSystem.
                // The Andruav system intercepts MAVLink heartbeats and sends Andruav ID
                // messages instead, so the 3D map may never see a MAVLINK_MSG_ID_HEARTBEAT.
                // Treat the first message from any new srcSystem as a heartbeat.
                // Use FRAME_TYPE_X (2) as default for non-heartbeat messages, since
                // c_mavlinkMessage.type is only present on HEARTBEAT messages.
                if (!v_vehicle && !v_droneInProgress.has(srcSystem)) {
                    const fakeHeartbeat = c_mavlinkMessage.header.msgId === mavlink20.MAVLINK_MSG_ID_HEARTBEAT
                        ? c_mavlinkMessage
                        : { type: 2 }; // FRAME_TYPE_X (quadcopter)
                    js_mavlinkHandler.handleHeartbeatNewID(srcSystem, v_droneInProgress, c_world, fakeHeartbeat);
                    v_vehicle = c_world.v_drone[srcSystem];
                }

                switch (c_mavlinkMessage.header.msgId) {
                    case mavlink20.MAVLINK_MSG_ID_HEARTBEAT:
                        // Vehicle already auto-created above if needed
                        break;
                    case mavlink20.MAVLINK_MSG_ID_RC_CHANNELS:
                        if (v_vehicle) js_mavlinkHandler.handleRCChannels(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_SERVO_OUTPUT_RAW:
                        if (v_vehicle) js_mavlinkHandler.handleServosOutputs(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
                        if (v_vehicle) js_mavlinkHandler.handleGlobalPosition(v_vehicle, c_world, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_ATTITUDE:
                        if (v_vehicle) js_mavlinkHandler.handleAttitude(v_vehicle, c_mavlinkMessage);
                        break;
                    case mavlink20.MAVLINK_MSG_ID_HOME_POSITION:
                        if (v_vehicle) js_mavlinkHandler.handleHomePosition(v_vehicle, c_mavlinkMessage);
                        break;
                }
            }
        };
    }
}

export { c_WebSocketComm, c_CommandParser };