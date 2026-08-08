/* ********************************************************************************
* M A V L I N K 3 D - M A P        STATUS OVERLAY
*
* A small fixed top-left blinking pill that reports live connection status:
*   loading -> connecting -> waiting for MAVLink -> ready (hidden)
*   reappears on disconnect / error.
*
* Vanilla JS (no framework). Driven by:
*   - direct calls from js_websocket.js (onOpen / onError / onPacket)
*   - EVT_VEHICLE_ADDED via js_eventEmitter (first real traffic)
*
* On init it removes the pre-React inline splash (#mav3d_pre_splash) from the HTML.
* Author: Mohammad S. Hefny
*********************************************************************************** */

import { EVENTS as js_event } from './js_eventList.js';
import { js_eventEmitter } from './js_eventEmitter.js';

const PHASE = Object.freeze({
    LOADING: 'loading',
    CONNECTING: 'connecting',
    WAITING: 'waiting',
    READY: 'ready',
    ERROR: 'error',
});

const PHASE_LABEL = Object.freeze({
    [PHASE.LOADING]: 'Mavlink3D loading...',
    [PHASE.CONNECTING]: 'Connecting to ws://127.0.0.1:8811...',
    [PHASE.WAITING]: 'Waiting for MAVLink traffic...',
    [PHASE.READY]: 'Ready',
    [PHASE.ERROR]: 'Connection error - reconnecting...',
});

class CStatusOverlay {
    constructor() {
        this.m_el = null;
        this.m_dotEl = null;
        this.m_textEl = null;
        this.m_phase = PHASE.LOADING;
        this.m_detail = '';
        this.m_unitCount = 0;
        this.m_visible = true;
        this.m_hideTimer = null;
        this.m_mounted = false;
        this.m_listenerKey = Math.random().toString();
    }

    /**
     * Creates the DOM pill and subscribes to EVT_VEHICLE_ADDED.
     * Call once after DOMContentLoaded.
     */
    fn_mount() {
        if (this.m_mounted) return;
        this.m_mounted = true;

        // Remove the inline pre-React splash; this pill takes over.
        const splash = document.getElementById('mav3d_pre_splash');
        if (splash && splash.parentNode) {
            splash.parentNode.removeChild(splash);
        }

        const el = document.createElement('div');
        el.className = 'mav3d_status_overlay mav3d_status_loading';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        const dot = document.createElement('span');
        dot.className = 'mav3d_status_dot';

        const text = document.createElement('span');
        text.className = 'mav3d_status_text';

        el.appendChild(dot);
        el.appendChild(text);
        document.body.appendChild(el);

        this.m_el = el;
        this.m_dotEl = dot;
        this.m_textEl = text;

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_ADDED, this, this.onVehicleAdded);

        this.fn_render();
    }

    fn_unmount() {
        if (!this.m_mounted) return;
        this.m_mounted = false;

        js_eventEmitter.fn_unsubscribe(js_event.EVT_VEHICLE_ADDED, this);

        if (this.m_hideTimer) {
            clearTimeout(this.m_hideTimer);
            this.m_hideTimer = null;
        }
        if (this.m_el && this.m_el.parentNode) {
            this.m_el.parentNode.removeChild(this.m_el);
        }
        this.m_el = null;
        this.m_dotEl = null;
        this.m_textEl = null;
    }

    // --- Public API (called from js_websocket.js) --------------------------

    fn_setConnecting(detail = '') {
        this.fn_show(PHASE.CONNECTING, detail);
    }

    fn_setConnected() {
        // Connected to WS but no vehicles yet -> waiting for MAVLink traffic.
        this.fn_show(PHASE.WAITING, '');
    }

    fn_setError(detail = '') {
        this.fn_show(PHASE.ERROR, detail);
    }

    fn_onPacket() {
        // Packets arriving but if no vehicle yet, keep "waiting".
        // Vehicle creation will trigger the ready hide.
        if (this.m_phase === PHASE.CONNECTING) {
            this.fn_show(PHASE.WAITING, '');
        }
    }

    // --- Internal -----------------------------------------------------------

    onVehicleAdded = () => {
        this.m_unitCount++;
        this.fn_hideSoon();
    }

    fn_show(phase, detail = '') {
        if (this.m_hideTimer) {
            clearTimeout(this.m_hideTimer);
            this.m_hideTimer = null;
        }
        this.m_phase = phase;
        this.m_detail = detail;
        this.m_visible = true;
        this.fn_render();
    }

    fn_hideSoon() {
        if (this.m_hideTimer) clearTimeout(this.m_hideTimer);
        this.m_phase = PHASE.READY;
        this.fn_render();
        this.m_hideTimer = setTimeout(() => {
            this.m_hideTimer = null;
            this.m_visible = false;
            this.fn_render();
        }, 1200);
    }

    fn_render() {
        if (!this.m_el) return;

        // Phase class
        const phaseCls = `mav3d_status_${this.m_phase}`;
        this.m_el.className = `mav3d_status_overlay ${phaseCls}`;

        // Visibility
        this.m_el.style.display = this.m_visible ? 'flex' : 'none';

        // Text
        const label = PHASE_LABEL[this.m_phase] || '...';
        const detail = this.m_detail ? ` — ${this.m_detail}` : '';
        const units = this.m_unitCount > 0 ? ` · ${this.m_unitCount} vehicle(s)` : '';
        if (this.m_textEl) {
            this.m_textEl.textContent = `${label}${detail}${units}`;
        }
    }
}

// Singleton instance
const js_statusOverlay = new CStatusOverlay();
export { js_statusOverlay, CStatusOverlay };
export default js_statusOverlay;
