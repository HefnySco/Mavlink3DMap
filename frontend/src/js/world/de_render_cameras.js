/* ********************************************************************************
 *  de_render_cameras.js - DroneEngage rendered-camera farm (P5-15)
 *
 *  ?world=ws://...&render=cameras turns the world scene into a headless
 *  camera farm instead of a viewer: for every hello.units[*].camera a
 *  THREE.PerspectiveCamera rig renders the scene from the unit's live
 *  MAVLink pose through the world's lens and mount (de_frame_meta mount
 *  matrix - same rays as the harness geo model), the frame goes out as
 *  [32-byte header][JPEG] on the render sink socket, and every
 *  ID_PASS_EVERY frames a quarter-res ID pass recolours truth entities
 *  to unique flats on occluding black so "was it actually visible" is
 *  measured on pixels, not on the probability model.
 *
 *  The strip (16 cells, bottom 8 px) echoes frame_no inside the image -
 *  the latency probe decodes it off the V4L2 device and pairs it with
 *  the frame_meta events this client posts on the world stream.
 ********************************************************************************** */

import * as THREE from 'three';
import {
    packFrameHeader, drawStrip, mountThreeMatrix, expectedHfovDeg,
    STREAM_COLOR, STREAM_ID_PASS, FRAME_HEADER_BYTES,
} from './de_frame_meta.js';

const ID_PASS_EVERY = 5;              // every Kth colour frame (D5)
const ID_PASS_SCALE = 4;              // 1/4 resolution
const JPEG_QUALITY = 0.8;
const DEFAULT_SINK_PORT = 8090;

/* unique flat colour per entity index for the ID pass - never black */
function idColor(i) {
    const h = (i * 2654435761) >>> 0;
    return new THREE.Color(0x202020 | ((h & 0x7f7f7f) << 1) >>> 0);
}

export class DeRenderCameras {
    constructor(worldInstance, worldScene, streamClient, sinkUrl) {
        this.world = worldInstance;
        this.scene = worldScene;
        this.client = streamClient;
        this.m_sinkUrl = sinkUrl;
        this.m_sink = null;
        this.m_rigs = [];               // one per hello camera unit
        this.m_timer = null;
        this.m_blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.m_tidMats = new Map();     // tid -> flat-colour material
        this.m_stats = { sent: 0, idpass: 0, lastFps: 0 };
    }

    fn_start(hello) {
        const camUnits = [];
        (hello.units || []).forEach((u, i) => {
            if (u.camera) camUnits.push({ unit_idx: i, spec: u });
        });
        if (camUnits.length === 0) {
            console.warn('[render] hello carries no camera units');
            return;
        }
        for (const cu of camUnits) this.m_rigs.push(this._makeRig(cu));
        this._connectSink();
        const fps = camUnits[0].spec.camera.fps || 10;
        // every rig renders each interval - the spec's fps is per camera
        this.m_timer = setInterval(() => this._renderAll(),
                                   Math.max(20, Math.round(1000 / fps)));
        console.log(`[render] ${this.m_rigs.length} camera rig(s) @${fps}fps ` +
                    `sink ${this.m_sinkUrl}`);
    }

    _makeRig(cu) {
        const cam = cu.spec.camera;
        const w = cam.img_w || 640, h = cam.img_h || 480;
        const three = new THREE.PerspectiveCamera(cam.vfov_deg, w / h, 0.1, 5000);
        // D2 sanity: vfov+aspect must reproduce the world hfov
        const hfov = expectedHfovDeg(cam.vfov_deg, w, h);
        if (cam.hfov_deg && Math.abs(hfov - cam.hfov_deg) > 0.5)
            console.warn(`[render] ${cu.spec.name}: hfov ${cam.hfov_deg} vs ` +
                         `vfov+aspect ${hfov.toFixed(2)} (>0.5 deg)`);
        // mount euler (CV convention) as a three-space rotation
        const m = mountThreeMatrix({
            roll_deg: cam.mount_roll_deg || 0,
            pitch_deg: cam.mount_pitch_deg,
            yaw_deg: cam.mount_yaw_deg || 0 });
        three.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().set(
                m[0], m[1], m[2], 0, m[3], m[4], m[5], 0,
                m[6], m[7], m[8], 0, 0, 0, 0, 1));
        const rt = new THREE.WebGLRenderTarget(w, h);
        const rtId = new THREE.WebGLRenderTarget(
            Math.ceil(w / ID_PASS_SCALE), Math.ceil(h / ID_PASS_SCALE));
        const rig = {
            unit_idx: cu.unit_idx, name: cu.spec.name,
            sysid: cu.spec.sysid, cam_spec: cam,
            threeCam: three, mountQuat: three.quaternion.clone(),
            rt, rtId, w, h, frame_no: 0, vehicle: null,
            pixels: new Uint8Array(w * h * 4),
            canvas: new OffscreenCanvas(w, h),
        };
        rig.ctx = rig.canvas.getContext('2d');
        return rig;
    }

    _connectSink() {
        const url = this.m_sinkUrl ||
            `ws://127.0.0.1:${DEFAULT_SINK_PORT}`;
        const open = () => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            ws.onopen = () => { this.m_sink = ws; };
            ws.onclose = () => { this.m_sink = null; setTimeout(open, 1000); };
            ws.onerror = () => { try { ws.close(); } catch (e) {} };
        };
        open();
    }

    _vehicleFor(rig) {
        if (rig.vehicle) return rig.vehicle;
        const v = this.world.v_drone && this.world.v_drone[rig.sysid];
        if (v && v.fn_getMesh()) { rig.vehicle = v; return v; }
        return null;
    }

    _renderAll() {
        for (const rig of this.m_rigs) this._renderRig(rig);
    }

    _renderRig(rig) {
        const v = this._vehicleFor(rig);
        const renderer = this.world.renderer;
        if (!v || !renderer || !this.m_sink) return;
        const mesh = v.fn_getMesh();
        const poseTms = Date.now();     // pose sample = latest MAVLink pose

        // camera world transform = mesh pose * mount (three-space)
        mesh.updateMatrixWorld(true);
        rig.threeCam.quaternion.copy(mesh.quaternion).multiply(rig.mountQuat);
        rig.threeCam.position.copy(mesh.position);
        rig.threeCam.updateMatrixWorld(true);

        renderer.setRenderTarget(rig.rt);
        renderer.render(this.world.v_scene, rig.threeCam);
        renderer.readRenderTargetPixels(rig.rt, 0, 0, rig.w, rig.h,
                                        rig.pixels);
        renderer.setRenderTarget(null);
        // GL rows are bottom-up - flip into image order, then strip
        const img = this._flipRows(rig.pixels, rig.w, rig.h);
        drawStrip(img, rig.w, rig.h, rig.frame_no & 0xFFFF);
        rig.ctx.putImageData(new ImageData(new Uint8ClampedArray(img.buffer),
                                           rig.w, rig.h), 0, 0);
        rig.canvas.convertToBlob({ type: 'image/jpeg',
                                   quality: JPEG_QUALITY }).then((blob) => {
            blob.arrayBuffer().then((jpeg) => {
                const meta = packFrameHeader(
                    rig.unit_idx, STREAM_COLOR, rig.frame_no,
                    rig.w, rig.h, jpeg.byteLength,
                    poseTms, Date.now());
                const out = new Uint8Array(FRAME_HEADER_BYTES + jpeg.byteLength);
                out.set(new Uint8Array(meta), 0);
                out.set(new Uint8Array(jpeg), FRAME_HEADER_BYTES);
                if (this.m_sink) this.m_sink.send(out);
                // frame_meta on the world stream -> truth rows; the
                // probe joins on (unit, frame_no) for the latency assert
                this.client.fn_sendEvent({
                    src: 'render', kind: 'frame_meta',
                    unit: rig.name, frame_no: rig.frame_no,
                    t_unix_ms: poseTms, render_t_ms: Date.now() });
                this.m_stats.sent++;
            });
        });

        if (rig.frame_no % ID_PASS_EVERY === 0) this._idPass(rig);
        rig.frame_no++;
    }

    _flipRows(pixels, w, h) {
        const out = new Uint8Array(pixels.length);
        const row = w * 4;
        for (let y = 0; y < h; ++y)
            out.set(pixels.subarray((h - 1 - y) * row, (h - y) * row),
                    y * row);
        return out;
    }

    /* D5 visibility truth: quarter-res pass with entities recoloured to
     * unique flats and every other mesh in occluding black. */
    _idPass(rig) {
        const renderer = this.world.renderer;
        const scene = this.world.v_scene;
        const saved = new Map();
        const black = this.m_blackMat;
        const entityMeshes = this._entityMeshSet();

        scene.traverse((o) => {
            if (!o.isMesh && !o.isSprite && !o.isCSS2DObject) return;
            saved.set(o, { mat: o.material, vis: o.visible });
            const rec = entityMeshes.get(o);
            if (rec) {
                let mat = this.m_tidMats.get(rec.tid);
                if (!mat) {
                    mat = new THREE.MeshBasicMaterial(
                        { color: idColor(this.m_tidMats.size) });
                    this.m_tidMats.set(rec.tid, mat);
                }
                o.material = mat; o.visible = true;
            } else if (o.isMesh) {
                o.material = black;
            } else {
                o.visible = false;      // labels/sprites off the ID frame
            }
        });

        renderer.setRenderTarget(rig.rtId);
        renderer.render(scene, rig.threeCam);

        const w = rig.rtId.width, h = rig.rtId.height;
        const px = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rig.rtId, 0, 0, w, h, px);

        // restore
        saved.forEach((s, o) => { o.material = s.mat; o.visible = s.vis; });
        renderer.setRenderTarget(null);

        // per-entity: count exact-colour pixels, bbox
        const now = Date.now();
        this.m_tidMats.forEach((mat, tid) => {
            const want = mat.color;
            const r = Math.round(want.r * 255), g = Math.round(want.g * 255),
                  b = Math.round(want.b * 255);
            let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (let y = 0; y < h; ++y) {
                let p = y * w * 4;
                for (let x = 0; x < w; ++x, p += 4) {
                    if (px[p] === r && px[p + 1] === g && px[p + 2] === b) {
                        n++;
                        if (x < x0) x0 = x; if (x > x1) x1 = x;
                        if (y < y0) y0 = y; if (y > y1) y1 = y;
                    }
                }
            }
            if (n === 0) {
                this.client.fn_sendEvent({
                    src: 'render_vis', kind: 'visibility',
                    unit: rig.name, frame_no: rig.frame_no, tid,
                    px: 0, t_unix_ms: now });
            } else {
                this.client.fn_sendEvent({
                    src: 'render_vis', kind: 'visibility',
                    unit: rig.name, frame_no: rig.frame_no, tid,
                    px: n,
                    box: { x: x0 / w, y: (h - 1 - y1) / h,
                           w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h },
                    t_unix_ms: now });
            }
        });
        this.m_stats.idpass++;
    }

    /* The scene keeps truth entity visuals in m_entities (id -> rec with
     * .mesh Group) - collect every descendant mesh into a lookup. */
    _entityMeshSet() {
        const set = new Map();
        if (!this.scene.m_entities) return set;
        this.scene.m_entities.forEach((rec, tid) => {
            const root = rec.mesh;
            if (!root) return;
            root.traverse((o) => {
                if (o.isMesh) set.set(o, { tid });
            });
            if (root.isMesh) set.set(root, { tid });
        });
        return set;
    }

    fn_stop() {
        if (this.m_timer) clearInterval(this.m_timer);
        if (this.m_sink) try { this.m_sink.close(); } catch (e) {}
    }
}
