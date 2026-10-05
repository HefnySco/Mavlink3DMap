// de_frame_meta helpers - node --test. The mount-matrix check ports the
// harness geo_ray_body/geo_ray_ned formulas and proves the browser rig
// renders the same rays (the P5-15 premise: pixels see exactly what the
// world model's lens describes).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    packFrameHeader, unpackFrameHeader, drawStrip, readStrip,
    rot3, mountBodyMatrix, mountThreeMatrix, expectedHfovDeg,
    FRAME_HEADER_BYTES, STRIP_CELLS, STRIP_ROWS,
} from '../src/js/world/de_frame_meta.js';

const rad = (d) => d * Math.PI / 180;
const mul3 = (a, b) => {
    const o = new Array(9);
    for (let r = 0; r < 3; ++r)
        for (let c = 0; c < 3; ++c)
            o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] +
                           a[r * 3 + 2] * b[6 + c];
    return o;
};
const apply3 = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const Rx = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const Ry = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const Rz = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const C_NED2THREE = [1, 0, 0, 0, 0, -1, 0, 1, 0];
const ned2three = (v) => apply3(C_NED2THREE, v);

// harness geo_ray_cam + geo_ray_body + geo_ray_ned (geo_projection.py)
const rayCam = (u, v, hfov, vfov) =>
    [Math.tan(u * rad(hfov)), Math.tan(v * rad(vfov)), 1];
const rayBodyHarness = (ray, m) =>
    apply3(rot3(rad(m.roll_deg), rad(m.pitch_deg), rad(m.yaw_deg)),
           [ray[2], ray[0], ray[1]]);
const rayNedHarness = (ray, att) => apply3(rot3(att.r, att.p, att.y), ray);

test('frame header round-trip', () => {
    const h = { unit_idx: 3, stream_id: 1, frame_no: 0xABCD,
                width: 640, height: 480, jpeg_len: 41234,
                pose_t_ms: 1728000000123.5, render_t_ms: 1728000000140.25 };
    const back = unpackFrameHeader(packFrameHeader(
        h.unit_idx, h.stream_id, h.frame_no, h.width, h.height,
        h.jpeg_len, h.pose_t_ms, h.render_t_ms));
    assert.deepEqual(back, h);
});

test('header is exactly 32 bytes', () => {
    assert.equal(packFrameHeader(0, 0, 0, 1, 1, 0, 0, 0).byteLength,
                 FRAME_HEADER_BYTES);
});

test('strip draw/read round-trip on luma', () => {
    const w = 640, h = 480;
    for (const f of [0, 1, 0x55AA, 0xFFFF, 4242]) {
        const rgba = new Uint8Array(w * h * 4).fill(128);
        drawStrip(rgba, w, h, f);
        const luma = new Uint8Array(w * h);
        for (let i = 0; i < w * h; ++i) luma[i] = rgba[i * 4];
        const back = readStrip(luma, w, h);
        assert.equal(back, f & 0xFFFF, `frame ${f}`);
    }
});

test('strip only touches the bottom rows', () => {
    const w = 160, h = 120;
    const rgba = new Uint8Array(w * h * 4).fill(7);
    drawStrip(rgba, w, h, 0xFFFF);
    for (let y = 0; y < h - STRIP_ROWS; ++y)
        for (let x = 0; x < w; ++x)
            assert.equal(rgba[(y * w + x) * 4], 7);
    assert.equal(STRIP_CELLS, 16);
});

test('mount nadir: cam forward hits body down', () => {
    const M = mountBodyMatrix({ roll_deg: 0, pitch_deg: -90, yaw_deg: 0 });
    const fwd = apply3(M, [0, 0, 1]);
    assert.ok(Math.abs(fwd[0]) < 1e-12 && Math.abs(fwd[1]) < 1e-12 &&
              Math.abs(fwd[2] - 1) < 1e-12, `fwd ${fwd}`);
});

test('render rig rays match the harness geo rays', () => {
    const cam = { hfov_deg: 62.2, vfov_deg: 48.8 };
    const mount = { roll_deg: 5, pitch_deg: -75, yaw_deg: 10 };
    const att = { r: rad(8), p: rad(-4), y: rad(37) };
    // vehicle mesh quaternion as the app builds it: Ry(-yaw)*Rz(pitch)*Rx(roll)
    const meshQ = mul3(mul3(Ry(-att.y), Rz(att.p)), Rx(att.r));
    const camWorld = mul3(meshQ, mountThreeMatrix(mount));
    for (const [u, v] of [[0, 0], [0.5, 0.5], [-0.5, -0.5],
                          [0.5, -0.5], [-0.5, 0.5], [0.2, -0.3]]) {
        // three.js PerspectiveCamera ray at NDC (2u, -2v)
        const rc = rayCam(u, v, cam.hfov_deg, cam.vfov_deg);
        const threeCamRay = [rc[0], -rc[1], -1];
        const worldThree = apply3(camWorld, threeCamRay);
        // harness: same image point -> NED ray -> three space
        const body = rayBodyHarness(rc, mount);
        const ned = rayNedHarness(body, att);
        const want = ned2three(ned);
        const norm = (v) => Math.hypot(v[0], v[1], v[2]);
        for (let i = 0; i < 3; ++i)
            assert.ok(Math.abs(worldThree[i] / norm(worldThree) -
                               want[i] / norm(want)) < 1e-9,
                      `u=${u} v=${v} axis ${i}: ${worldThree} vs ${want}`);
    }
});

test('hfov expectation helper', () => {
    const h = expectedHfovDeg(48.8, 1280, 720);
    assert.ok(Math.abs(h - 79.0) < 1.5, `h ${h}`);  // ~79 deg for 16:9
});
