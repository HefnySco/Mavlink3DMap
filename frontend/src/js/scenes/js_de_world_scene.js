/* ********************************************************************************
*   DroneEngage world scene (TASK-P5-14)
*
*   Selected by ?world=ws://127.0.0.1:<stream_port> - connects to the
*   simulation harness de.worldstream/1 feed and draws the world the
*   fleet is playing in: obstacles (buildings opaque, canopies a
*   translucent crown), truth entities with their latest look state
*   (seen / miss / occluded - occluded shows as an outline), bot
*   world-model targets with uncertainty rings, reported detections,
*   and ground-anchored clutter - all in the harness reference frame
*   (hello.origin, M_PER_DEG_LAT = 111320 flat earth), the same frame
*   the MAVLink vehicles are placed in once the stream's hello arrives.
*   Fully offline: no tiles, no CDN, no external fetches.
*********************************************************************************** */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CBaseScene } from './js_base_scene.js';
import SimObject from '../js_object.js';
import { DeWorldClient } from '../world/de_world_client.js';
import { DeRenderCameras } from '../world/de_render_cameras.js';
import { fn_makeWorldConverter } from '../world/de_geo.js';
import { EVENTS as js_event } from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';

const PI_div_2 = Math.PI / 2;
const TICK_MS = 100;                    // stream ticks arrive at 10 Hz
const DETECTION_MARKER_MAX = 40;
const TARGET_RING_RADIUS_M = 5.0;

// per-cls display colors (entity truth layer)
const CLS_COLORS = {
    person: 0xe8873a,
    phone: 0x3ad2e8,
    clutter: 0x888888,
};

export class CDeWorldScene extends CBaseScene {
    constructor(worldInstance, streamUrl, renderMode, sinkUrl) {
        super(worldInstance, { tileRange: 0 });
        this.m_client = new DeWorldClient(streamUrl);
        // P5-15: 'cameras' turns this scene into the headless render
        // farm (frames to the v4l2 sink) instead of a viewer
        this.m_renderMode = renderMode || null;
        this.m_sinkUrl = sinkUrl || null;
        this.m_renderFarm = null;
        this.m_converter = null;          // built on hello.origin
        this.m_hello = null;
        this.m_entities = new Map();      // id -> visual record
        this.m_clutterMeshes = new Map();
        this.m_targetMarkers = new Map();
        this.m_detectionMarkers = [];
        this.m_overlay = null;
        this.m_obstacleGroup = null;
        this.m_hudEl = null;
        this.m_hudRows = new Map();       // tid -> div
        this.m_hudStatus = null;
        this.m_hudClock = null;
        this.m_hudRefreshAt = 0;
        this.m_connState = false;

        // vehicles' altitude reference: first reported vehicle home in
        // raw MAVLink mm - same convention as CBaseScene.refAlt. refLat
        // is set from hello.origin earlier, which makes the base
        // scene's own home handler a no-op, so alt lands here instead
        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_HOME_CHANGED,
            this, (p_me, { alt }) => {
                if (p_me.refAlt === null) p_me.refAlt = alt;
            });

        this.m_client.fn_onHello = (m) => this._onHello(m);
        this.m_client.fn_onTick = (m) => this._onTick(m);
        this.m_client.fn_onConnectionChange = (c) => {
            this.m_connState = c;
            this._hudUpdateStatus();
        };
    }

    // -------------------------------------------------- scene hooks

    init(p_XZero, p_YZero) {
        this._addLights();
        this._buildGround();
        this._buildHud();
        // a robot-registered driver object gives the scene a per-frame
        // hook (10 Hz ticks -> render-rate interpolation)
        const driver = new SimObject('de_world_driver');
        driver.fn_addMesh(new THREE.Group());
        driver.fn_setAnimate(() => this._onFrame());
        this.world.fn_addRobot('de_world_driver', driver);
        this.world.v_scene.add(driver.fn_getMesh());
        this.m_client.fn_connect();
    }

    // the world scene has no tile system - one ground plane, no reloads
    updateTiles(_x, _y) { }
    async loadMapFromHome(_lat, _lng) { }
    fn_onNewTileCreated(_x, _y) { }

    _addLights() {
        this.world.v_scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(200, 400, 100);
        this.world.v_scene.add(sun);
    }

    /* Vehicle frame hook: c_ArduVehicles delegates its lat/lng -> xyz
       conversion here when the world scene is active, so vehicles use
       the harness formula and hello.origin - cm-level parity (D2).
       Before hello, vehicles hold at the scene origin (gated). */
    fn_vehicleLocalXYZ(lat, lng, altAbsM, fallbackAltM) {
        if (!this.m_converter) return { x: 0, y: 0, z: 0 };
        const { x, z } = this.m_converter.fn_latLngToXZ(lat, lng);
        const refAltM = (this.refAlt !== null && this.refAlt !== undefined)
            ? this.refAlt / 1000.0 : (fallbackAltM || 0);
        return { x, y: altAbsM - refAltM, z };
    }

    // ------------------------------------------------- stream events

    _onHello(msg) {
        this.m_hello = msg;
        const [originLat, originLng] = msg.origin;
        this.m_converter = fn_makeWorldConverter(originLat, originLng);
        // base-scene reference in degrees - vehicles align to it through
        // fn_vehicleLocalXYZ; home events no longer move the frame
        this.refLat = originLat;
        this.refLng = originLng;
        this.homeLat = originLat;
        this.homeLng = originLng;

        this._buildObstacles(msg.obstacles || []);
        this._buildAreas(msg.areas || {});
        for (const e of (msg.entities || [])) {
            this._hudAddEntity(e.id, e.cls);
        }
        // 'cameras' is headless-farm only; 'full' renders the cameras
        // AND keeps the viewer chrome on
        if ((this.m_renderMode === 'cameras' || this.m_renderMode === 'full')
                && !this.m_renderFarm) {
            this.m_renderFarm = new DeRenderCameras(
                this.world, this, this.m_client, this.m_sinkUrl);
            this.m_renderFarm.fn_start(msg);
        }
        this._frameCameraOnWorld();
        this._hudUpdateStatus();
    }

    _onTick(msg) {
        if (!this.m_converter) return;
        const now = performance.now();
        for (const e of (msg.entities || [])) {
            this._updateEntity(e, now);
        }
        this._updateClutter(msg.clutter || []);
        if (msg.overlay) {
            this.m_overlay = msg.overlay;
            this._updateTargets(msg.overlay.targets || {});
            this._updateDetections(msg.overlay.detections || []);
            this._applyEntityStates(msg.overlay.states || {});
        }
        if (now >= this.m_hudRefreshAt) {
            this.m_hudRefreshAt = now + 500;
            this._hudRefresh(msg);
        }
    }

    _onFrame() {
        if (!this.m_converter) return;
        const now = performance.now();
        for (const rec of this.m_entities.values()) {
            if (!rec.hasPos) continue;
            const a = Math.min(1.0, (now - rec.t0) / TICK_MS);
            rec.mesh.position.set(
                rec.prev.x + (rec.next.x - rec.prev.x) * a,
                rec.prev.y + (rec.next.y - rec.prev.y) * a,
                rec.prev.z + (rec.next.z - rec.prev.z) * a);
            rec.mesh.rotation.y = -rec.heading * Math.PI / 180.0;
        }
    }

    // --------------------------------------------------- world build

    _buildGround() {
        const geometry = new THREE.PlaneGeometry(4000, 4000);
        const material = new THREE.MeshLambertMaterial({ color: 0x4a7c3a });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -PI_div_2;
        ground.position.y = -0.05;
        this.world.v_scene.add(ground);
        // local forest texture tiles when present - cosmetic only;
        // the color above is the offline fallback
        this.textureLoader.load(
            '/models/images/forest/forest_0_0.png',
            (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(160, 160);
                material.map = tex;
                material.color.set(0xffffff);
                material.needsUpdate = true;
            },
            undefined,
            () => { /* offline fallback: plain green plane */ });
    }

    /* footprint ring (lat/lng) -> THREE.Shape in the (north, -east)
       plane; extruded along +z then rotated -PI/2 about x so shape.y
       becomes world z = east and the extrusion becomes +y up */
    _footprintShape(poly) {
        const shape = new THREE.Shape();
        poly.forEach(([lat, lng], i) => {
            const { x, z } = this.m_converter.fn_latLngToXZ(lat, lng);
            if (i === 0) shape.moveTo(x, -z);
            else shape.lineTo(x, -z);
        });
        shape.closePath();
        return shape;
    }

    _buildObstacles(obstacles) {
        if (this.m_obstacleGroup) {
            this.world.v_scene.remove(this.m_obstacleGroup);
        }
        const group = new THREE.Group();
        for (const obs of obstacles) {
            if (!obs.poly || obs.poly.length < 3) continue;
            const depth = Math.max(0.1, obs.height_m - (obs.base_m || 0));
            const geometry = new THREE.ExtrudeGeometry(
                this._footprintShape(obs.poly),
                { depth, bevelEnabled: false });
            if (obs.kind === 'building') {
                const mesh = new THREE.Mesh(geometry,
                    new THREE.MeshLambertMaterial({ color: 0x6b655e }));
                mesh.rotation.x = -PI_div_2;
                mesh.position.y = obs.base_m || 0;
                group.add(mesh);
            } else {
                // canopy: a translucent crown band; opacity loosely
                // follows gap_fraction (cosmetic - occlusion truth is
                // the world model's, not this mesh's)
                const opacity = Math.max(0.25, Math.min(0.85,
                    1.0 - (obs.gap_fraction ?? 0.5)));
                const mesh = new THREE.Mesh(geometry,
                    new THREE.MeshLambertMaterial({
                        color: 0x2e6b2e, transparent: true,
                        opacity, depthWrite: false
                    }));
                mesh.rotation.x = -PI_div_2;
                mesh.position.y = obs.base_m || 0;
                group.add(mesh);
                // sparse deterministic tree cones for readability
                this._scatterTrees(group, obs);
            }
        }
        this.m_obstacleGroup = group;
        this.world.v_scene.add(group);
    }

    _scatterTrees(group, obs) {
        const pts = obs.poly.map(([lat, lng]) =>
            this.m_converter.fn_latLngToXZ(lat, lng));
        const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const area = (maxX - minX) * (maxZ - minZ);
        const count = Math.min(60, Math.max(6, Math.floor(area / 400)));
        const coneGeo = new THREE.ConeGeometry(1.2, 4.0, 5);
        const treeMat = new THREE.MeshLambertMaterial({ color: 0x3f5d33 });
        let placed = 0;
        for (let i = 0; placed < count && i < count * 20; ++i) {
            // deterministic scatter inside the footprint
            const rx = _hash01(`${obs.id}:${i}`);
            const rz = _hash01(`${obs.id}:${i}:z`);
            const px = minX + rx * (maxX - minX);
            const pz = minZ + rz * (maxZ - minZ);
            if (!_pointInPolyXZ(px, pz, pts)) continue;
            const cone = new THREE.Mesh(coneGeo, treeMat);
            cone.position.set(px, (obs.height_m || 10) - 2.0, pz);
            group.add(cone);
            placed++;
        }
    }

    _buildAreas(areas) {
        const group = new THREE.Group();
        const material = new THREE.LineBasicMaterial({ color: 0x34e0ff });
        for (const [name, spec] of Object.entries(areas)) {
            const poly = spec && (spec.poly || spec.polygon);
            if (!Array.isArray(poly) || poly.length < 3) continue;
            const pts = poly.map(([lat, lng]) => {
                const { x, z } = this.m_converter.fn_latLngToXZ(lat, lng);
                return new THREE.Vector3(x, 0.08, z);
            });
            const geo = new THREE.BufferGeometry().setFromPoints(
                [...pts, pts[0]]);
            const line = new THREE.Line(geo, material);
            group.add(line);
            const center = pts.reduce((a, p) => a.add(p), new THREE.Vector3())
                .multiplyScalar(1 / pts.length);
            const label = this._makeLabel(name, '#34e0ff');
            label.position.copy(center);
            label.position.y = 2.0;
            group.add(label);
        }
        this.world.v_scene.add(group);
    }

    _frameCameraOnWorld() {
        // give every view a sane starting pose over the world origin
        for (const view of (this.world.v_views || [])) {
            const cam = view.m_main_camera;
            if (!cam) continue;
            cam.position.set(60, 60, 60);
            cam.lookAt(new THREE.Vector3(0, 0, 0));
            if (cam.m_controls) {
                cam.m_controls.target.set(0, 0, 0);
                cam.m_controls.update();
            }
        }
    }

    // ----------------------------------------------------- entities

    _updateEntity(e, now) {
        const { x, z } = this.m_converter.fn_latLngToXZ(e.lat, e.lng);
        const y = e.alt_m || 0;
        let rec = this.m_entities.get(e.id);
        if (!rec) {
            rec = this._spawnEntity(e);
            this.m_entities.set(e.id, rec);
        }
        const cur = rec.hasPos ? rec.mesh.position : { x, y, z };
        rec.prev = { x: cur.x, y: cur.y, z: cur.z };
        rec.next = { x, y, z };
        rec.t0 = now;
        rec.hasPos = true;
        rec.heading = e.heading_deg || 0;
        rec.moving = !!e.moving;
    }

    _spawnEntity(e) {
        const cls = e.cls || 'object';
        const group = new THREE.Group();
        const color = CLS_COLORS[cls] ?? 0xccbbaa;
        const mat = new THREE.MeshLambertMaterial({ color });
        let outlineGeo;
        if (cls === 'phone') {
            const geo = new THREE.BoxGeometry(0.2, 0.35, 0.06);
            const m = new THREE.Mesh(geo, mat);
            m.position.y = 0.2;
            group.add(m);
            outlineGeo = geo;
        } else {
            // person / clutter / default: low-poly humanoid
            const body = new THREE.CylinderGeometry(0.14, 0.18, 0.9, 8);
            const head = new THREE.SphereGeometry(0.14, 8, 6);
            const bm = new THREE.Mesh(body, mat);
            bm.position.y = 0.55;
            const hm = new THREE.Mesh(head, mat);
            hm.position.y = 1.15;
            group.add(bm);
            group.add(hm);
            outlineGeo = body;
        }
        // occluded outline (D4): wireframe shell toggled by state
        const outline = new THREE.Mesh(
            outlineGeo,
            new THREE.MeshBasicMaterial({
                color: 0xff4444, wireframe: true,
                transparent: true, opacity: 0.9
            }));
        outline.scale.setScalar(1.12);
        outline.visible = false;
        // match the body's position inside the group
        outline.position.y = cls === 'phone' ? 0.2 : 0.55;
        group.add(outline);
        const label = this._makeLabel(e.id, '#ffffff');
        label.position.y = 1.6;
        group.add(label);
        // status ring under the entity: grey unseen / green seen /
        // orange miss / red occluded
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.7, 24),
            new THREE.MeshBasicMaterial({
                color: 0x666666, side: THREE.DoubleSide,
                transparent: true, opacity: 0.8
            }));
        ring.rotation.x = -PI_div_2;
        ring.position.y = 0.03;
        group.add(ring);
        this.world.v_scene.add(group);
        return {
            id: e.id, cls, mesh: group, label, ring, outline,
            solidMat: mat, prev: { x: 0, y: 0, z: 0 },
            next: { x: 0, y: 0, z: 0 }, t0: 0, hasPos: false,
            heading: 0, state: 'unseen'
        };
    }

    _applyEntityStates(states) {
        for (const rec of this.m_entities.values()) {
            const state = states[rec.id] || 'unseen';
            if (state === rec.state) continue;
            rec.state = state;
            rec.outline.visible = state === 'occluded';
            rec.solidMat.transparent = state === 'occluded';
            rec.solidMat.opacity = state === 'occluded' ? 0.35 : 1.0;
            rec.solidMat.needsUpdate = true;
            rec.ring.material.color.set({
                seen: 0x33cc66, miss: 0xddaa33,
                occluded: 0xdd4444, unseen: 0x666666
            }[state] || 0x666666);
        }
    }

    _updateClutter(points) {
        const seen = new Set();
        for (const c of points) {
            seen.add(c.id);
            let mesh = this.m_clutterMeshes.get(c.id);
            const { x, z } = this.m_converter.fn_latLngToXZ(c.lat, c.lng);
            if (!mesh) {
                const mat = new THREE.MeshLambertMaterial({
                    color: CLS_COLORS.clutter });
                const body = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 6);
                mesh = new THREE.Mesh(body, mat);
                mesh.position.y = 0.4;
                this.m_clutterMeshes.set(c.id, mesh);
                this.world.v_scene.add(mesh);
            }
            mesh.position.x = x;
            mesh.position.z = z;
        }
        for (const [id, mesh] of this.m_clutterMeshes) {
            if (!seen.has(id)) {
                this.world.v_scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.m_clutterMeshes.delete(id);
            }
        }
    }

    // ------------------------------------------------------ overlays

    _updateTargets(targets) {
        const seen = new Set();
        for (const [tid, t] of Object.entries(targets)) {
            const pos = t && t.pos;
            const lat = pos && (pos.lat ?? pos[0]);
            const lng = pos && (pos.lng ?? pos[1]);
            if (lat === undefined || lng === undefined) continue;
            seen.add(tid);
            let marker = this.m_targetMarkers.get(tid);
            const { x, z } = this.m_converter.fn_latLngToXZ(lat, lng);
            if (!marker) {
                marker = new THREE.Group();
                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(
                        TARGET_RING_RADIUS_M * 0.9, TARGET_RING_RADIUS_M, 32),
                    new THREE.MeshBasicMaterial({
                        color: 0xffff55, side: THREE.DoubleSide,
                        transparent: true, opacity: 0.85
                    }));
                ring.rotation.x = -PI_div_2;
                ring.position.y = 0.06;
                marker.add(ring);
                const pin = new THREE.Mesh(
                    new THREE.ConeGeometry(0.5, 1.4, 8),
                    new THREE.MeshLambertMaterial({ color: 0xffe14d }));
                pin.position.y = 1.2;
                marker.add(pin);
                const label = this._makeLabel(
                    `${t.cls || 'target'}:${tid}`, '#ffe14d');
                label.position.y = 2.4;
                marker.add(label);
                this.m_targetMarkers.set(tid, marker);
                this.world.v_scene.add(marker);
            }
            marker.position.x = x;
            marker.position.z = z;
            marker.position.y = pos.alt_m ?? pos[2] ?? 0;
        }
        for (const [tid, marker] of this.m_targetMarkers) {
            if (!seen.has(tid)) {
                this.world.v_scene.remove(marker);
                this.m_targetMarkers.delete(tid);
            }
        }
    }

    _updateDetections(detections) {
        // one marker per reported detection position, pooled and
        // capped - newest at the tail
        while (this.m_detectionMarkers.length <
               Math.min(detections.length, DETECTION_MARKER_MAX)) {
            const m = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.4),
                new THREE.MeshBasicMaterial({ color: 0x4dff9e }));
            this.world.v_scene.add(m);
            this.m_detectionMarkers.push(m);
        }
        const tail = detections.slice(-DETECTION_MARKER_MAX);
        for (let i = 0; i < this.m_detectionMarkers.length; ++i) {
            const m = this.m_detectionMarkers[i];
            const d = tail[i];
            if (!d || d.lat === undefined) {
                m.visible = false;
                continue;
            }
            const { x, z } = this.m_converter.fn_latLngToXZ(d.lat, d.lng);
            m.visible = true;
            m.position.set(x, (d.alt_m || 0) + 0.6, z);
        }
    }

    // ----------------------------------------------------------- HUD

    _makeLabel(text, color) {
        const div = document.createElement('div');
        div.className = 'drone-sid-label';
        div.textContent = text;
        div.style.color = color || 'white';
        const label = new CSS2DObject(div);
        return label;
    }

    _buildHud() {
        const host = document.getElementById('mav3dmap') || document.body;
        const hud = document.createElement('div');
        hud.className = 'de-world-hud';
        hud.innerHTML =
            `<div class="de-world-hud-head">` +
            `<span class="de-world-hud-title">world</span>` +
            `<span class="de-world-hud-status" data-v="off">offline</span>` +
            `<span class="de-world-hud-clock">t 0.0</span></div>` +
            `<div class="de-world-hud-list"></div>`;
        host.appendChild(hud);
        this.m_hudEl = hud;
        this.m_hudStatus = hud.querySelector('.de-world-hud-status');
        this.m_hudClock = hud.querySelector('.de-world-hud-clock');
        this.m_hudList = hud.querySelector('.de-world-hud-list');
    }

    _hudAddEntity(id, cls) {
        if (this.m_hudRows.has(id)) return;
        const row = document.createElement('div');
        row.className = 'de-world-hud-row';
        row.innerHTML =
            `<span class="de-world-hud-dot"></span>` +
            `<span class="de-world-hud-id">${id}</span>` +
            `<span class="de-world-hud-cls">${cls || ''}</span>` +
            `<span class="de-world-hud-state">unseen</span>`;
        this.m_hudList.appendChild(row);
        this.m_hudRows.set(id, row);
    }

    _hudUpdateStatus() {
        if (!this.m_hudStatus) return;
        const on = this.m_connState;
        this.m_hudStatus.dataset.v = on ? 'on' : 'off';
        this.m_hudStatus.textContent = on
            ? (this.m_hello ? `stream ${this.m_hello.sim}` : 'connected')
            : 'offline';
    }

    _hudRefresh(tick) {
        if (this.m_hudClock && tick) {
            this.m_hudClock.textContent = `t ${(tick.t_s ?? 0).toFixed(1)}`;
        }
        const states = (this.m_overlay && this.m_overlay.states) || {};
        for (const [id, row] of this.m_hudRows) {
            const state = states[id] || 'unseen';
            const el = row.querySelector('.de-world-hud-state');
            el.textContent = state;
            row.dataset.state = state;
        }
    }
}

function _hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; ++i) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
}

/* point-in-polygon on scene (x, z) coords - even-odd ray cast; poly is
   [{x: north, z: east}] as produced by the world converter */
function _pointInPolyXZ(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, zi = poly[i].z;
        const xj = poly[j].x, zj = poly[j].z;
        if (((zi > pz) !== (zj > pz)) &&
            (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}
