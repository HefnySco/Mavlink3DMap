/* ********************************************************************************
*   de.worldstream/1 client (simulation harness world stream, P5-13/14)
*
*   Connects to the runner's world WebSocket, keeps the latest hello,
*   entity states and overlay, reconnects on drop (the stream dies with
*   the scenario; a reconnect is how a viewer rejoins a fresh run).
*   Unknown frame `t` values are ignored - additive protocol evolution.
*********************************************************************************** */

export class DeWorldClient {

    constructor(p_url) {
        this.m_url = p_url;
        this.m_ws = null;
        this.m_shouldReconnect = true;
        this.m_reconnectTimer = null;
        this.m_reconnectDelayMs = 2000;

        // latest stream state
        this.m_hello = null;
        this.m_entities = new Map();   // id -> last tick row
        this.m_clutter = new Map();    // id -> last tick row
        this.m_overlay = null;         // last overlay block
        this.m_t_s = 0;
        this.m_t_unix_ms = 0;
        this.m_connected = false;

        // callbacks the scene fills in
        this.fn_onHello = null;
        this.fn_onTick = null;
        this.fn_onCmd = null;
        this.fn_onConnectionChange = null;
    }

    fn_connect() {
        this.m_shouldReconnect = true;
        this.#fn_open();
    }

    fn_disconnect() {
        this.m_shouldReconnect = false;
        if (this.m_reconnectTimer !== null) {
            clearTimeout(this.m_reconnectTimer);
            this.m_reconnectTimer = null;
        }
        if (this.m_ws) {
            this.m_ws.close();
            this.m_ws = null;
        }
    }

    /* client -> runner: {t:"event", kind:"...", ...} lands in truth.jsonl
       with src: render */
    fn_sendEvent(p_fields) {
        if (!this.m_ws || this.m_ws.readyState !== WebSocket.OPEN) return false;
        try {
            this.m_ws.send(JSON.stringify({ t: 'event', ...p_fields }));
            return true;
        } catch (e) {
            return false;
        }
    }

    #fn_open() {
        try {
            this.m_ws = new WebSocket(this.m_url);
        } catch (e) {
            this.#fn_scheduleReconnect();
            return;
        }

        this.m_ws.onopen = () => {
            this.m_connected = true;
            this.fn_onConnectionChange?.(true);
        };

        this.m_ws.onmessage = (evt) => {
            let msg;
            try { msg = JSON.parse(evt.data); } catch (_) { return; }
            switch (msg.t) {
                case 'hello':
                    this.m_hello = msg;
                    this.fn_onHello?.(msg);
                    break;
                case 'tick':
                    this.m_t_s = msg.t_s;
                    this.m_t_unix_ms = msg.t_unix_ms;
                    for (const e of (msg.entities || [])) {
                        this.m_entities.set(e.id, e);
                    }
                    for (const c of (msg.clutter || [])) {
                        this.m_clutter.set(c.id, c);
                    }
                    if (msg.overlay) this.m_overlay = msg.overlay;
                    this.fn_onTick?.(msg);
                    break;
                case 'cmd':
                    this.fn_onCmd?.(msg);
                    break;
                default:
                    break;   // unknown frames are forward-compatible
            }
        };

        this.m_ws.onclose = () => {
            this.m_connected = false;
            this.fn_onConnectionChange?.(false);
            this.#fn_scheduleReconnect();
        };

        this.m_ws.onerror = () => {
            // onclose follows and handles the reconnect
        };
    }

    #fn_scheduleReconnect() {
        if (!this.m_shouldReconnect || this.m_reconnectTimer !== null) return;
        this.m_reconnectTimer = setTimeout(() => {
            this.m_reconnectTimer = null;
            if (this.m_shouldReconnect) this.#fn_open();
        }, this.m_reconnectDelayMs);
    }
}
