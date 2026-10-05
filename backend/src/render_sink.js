#!/usr/bin/env node
/* ********************************************************************************
 *  render_sink.js - DroneEngage world render sink (P5-15)
 *
 *  One WebSocket, N virtual cameras. The Mavlink3DMap render client
 *  (frontend ?world=...&render=cameras) sends binary frames:
 *  [32-byte de_frame_meta header][JPEG]. Frames with stream_id 0 are
 *  demuxed per unit_idx into one ffmpeg per unit writing to that
 *  unit's v4l2loopback device; stream_id 1 (ID pass) is counted and
 *  dropped - the world stream carries its truth rows.
 *
 *  The unit->device map comes from the sim harness as a JSON file:
 *    node render_sink.js --map run/<sim>/render/sink_map.json
 *  map file: {"units":[{"unit_idx":0,"name":"cam1","device":"/dev/video6",
 *                       "width":640,"height":480,"fps":10}]}
 *
 *  Usage:
 *    node render_sink.js -w <ws_port> --map <sink_map.json> [--ffmpeg ffmpeg]
 ********************************************************************************** */

if (process.platform !== 'linux') {
    console.error('Error: render-sink is supported only on Linux.');
    process.exit(1);
}

const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const { program } = require('commander');
const WebSocket = require('ws');

const FRAME_HEADER_BYTES = 32;
const STREAM_COLOR = 0;

program
    .option('-w, --ws_port <port>', 'WebSocket port', '8090')
    .option('--map <file>', 'unit->device map JSON written by the sim')
    .option('--ffmpeg <bin>', 'ffmpeg binary', 'ffmpeg')
    .option('--dry-run', 'parse frames, do not spawn ffmpeg', false);
program.parse(process.argv);
const options = program.opts();

const wsPort = parseInt(options.ws_port, 10);
const mapPath = options.map;
if (!mapPath || !fs.existsSync(mapPath)) {
    console.error(`Error: --map ${mapPath} not found (the sim writes it under run/<sim>/render/)`);
    process.exit(1);
}
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const units = new Map();
for (const u of map.units || []) {
    units.set(u.unit_idx, { ...u, frames: 0, ffmpeg: null, jpegBuf: null });
}
console.error(`render_sink: ${units.size} unit devices on ws :${wsPort}`);

function unpackHeader(buf) {
    // same layout as frontend/src/js/world/de_frame_meta.js
    return {
        unit_idx: buf.readUInt16LE(0),
        stream_id: buf.readUInt16LE(2),
        frame_no: buf.readUInt32LE(4),
        width: buf.readUInt16LE(8),
        height: buf.readUInt16LE(10),
        jpeg_len: buf.readUInt32LE(12),
        pose_t_ms: buf.readDoubleLE(16),
        render_t_ms: buf.readDoubleLE(24),
    };
}

function blackJpeg(w, h) {
    // one solid-black mjpeg frame, rendered by ffmpeg itself - primed
    // into each device so exclusive_caps loopbacks advertise CAPTURE
    // before the world stream (and its first real frame) exists.
    const r = spawnSync(options.ffmpeg, [
        '-loglevel', 'error',
        '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}`,
        '-frames:v', '1',
        '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1',
    ], { encoding: 'buffer', maxBuffer: 1 << 20 });
    if (r.status !== 0 || !r.stdout.length) {
        console.error(`black frame generation failed (${r.status})`);
        return null;
    }
    return r.stdout;
}

function spawnFfmpeg(unit, header) {
    // dims come from the first frame header - the render rig's truth,
    // not the map's hint. mjpeg image2pipe -> yuv420p v4l2.
    const w = header ? header.width : (unit.width || 640);
    const h = header ? header.height : (unit.height || 480);
    unit.feedW = w;
    unit.feedH = h;
    const args = [
        '-loglevel', 'error',
        '-f', 'image2pipe', '-vcodec', 'mjpeg',
        '-r', String(unit.fps || 10),
        '-s', `${w}x${h}`,
        '-i', 'pipe:0',
        '-pix_fmt', 'yuv420p',
        '-f', 'v4l2', unit.device,
    ];
    const proc = spawn(options.ffmpeg, args, { stdio: ['pipe', 'ignore', 'inherit'] });
    proc.on('exit', (code) => {
        console.error(`ffmpeg ${unit.name} (${unit.device}) exited ${code} - restarting on next frame`);
        unit.ffmpeg = null;
    });
    proc.stdin.on('error', () => {});
    console.error(`ffmpeg ${unit.name} -> ${unit.device} ${w}x${h} @${unit.fps}fps`);
    return proc;
}

// exclusive_caps v4l2loopbacks only advertise CAPTURE while a producer
// is attached. Consumers (de_yolo_ai's VideoCapture.open) come up long
// before the world stream delivers a first frame - prime each device
// with black frames until real stream_id-0 frames arrive.
if (!options.dryRun) {
    for (const unit of units.values()) {
        unit.gotColor = false;
        unit.primer = blackJpeg(unit.width || 640, unit.height || 480);
        if (unit.primer) {
            unit.ffmpeg = spawnFfmpeg(unit, null);
        }
    }
    const primers = setInterval(() => {
        for (const unit of units.values()) {
            if (unit.gotColor || !unit.primer) continue;
            if (!unit.ffmpeg) unit.ffmpeg = spawnFfmpeg(unit, null);
            try { unit.ffmpeg.stdin.write(unit.primer); } catch (e) { /* EPIPE */ }
        }
    }, 100);
    primers.unref?.();
}

const wss = new WebSocket.Server({ port: wsPort, perMessageDeflate: false });
wss.on('connection', (ws) => {
    console.error('render client connected');
    ws.on('message', (message) => {
        if (!(message instanceof Buffer) || message.length < FRAME_HEADER_BYTES) return;
        const h = unpackHeader(message);
        const unit = units.get(h.unit_idx);
        if (!unit) return;
        const jpeg = message.subarray(FRAME_HEADER_BYTES,
                                      FRAME_HEADER_BYTES + h.jpeg_len);
        if (h.stream_id !== STREAM_COLOR) { unit.frames++; return; }
        unit.frames++;
        unit.gotColor = true;
        if (options.dryRun) return;
        // a real frame at different dims than the primed feed means the
        // running ffmpeg has the wrong output format - restart it
        if (unit.ffmpeg && (unit.feedW !== h.width || unit.feedH !== h.height)) {
            unit.ffmpeg.kill('SIGKILL');
            unit.ffmpeg = null;
        }
        if (!unit.ffmpeg) unit.ffmpeg = spawnFfmpeg(unit, h);
        try { unit.ffmpeg.stdin.write(jpeg); } catch (e) { /* EPIPE: respawn next frame */ }
    });
    ws.on('close', () => console.error('render client disconnected'));
    ws.on('error', (e) => console.error('ws error', e.message));
});

setInterval(() => {
    const parts = [...units.values()].map(u => `${u.name}:${u.frames}`);
    if (parts.length) console.error(`frames ${parts.join(' ')}`);
}, 30000);

process.on('SIGTERM', () => { for (const u of units.values()) u.ffmpeg?.kill('SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { for (const u of units.values()) u.ffmpeg?.kill('SIGTERM'); process.exit(0); });
