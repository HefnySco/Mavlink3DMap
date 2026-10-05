/* ********************************************************************************
 *  DroneEngage world render - frame metadata helpers (P5-15)
 *
 *  Pure functions shared by the render client (de_render_cameras.js)
 *  and the node tests: the 32-byte binary frame header that rides in
 *  front of every JPEG on the render sink socket, the 16-cell frame
 *  number strip drawn into the image's bottom rows (the latency probe
 *  reads it back from the V4L2 device), and the CV->three.js mount
 *  matrix matching the harness geo_ray_body() convention.
 *
 *  Frame header (32 bytes, little-endian):
 *    u16 unit_idx      index into hello.units
 *    u16 stream_id     0 = colour (to v4l2), 1 = ID pass (meta only)
 *    u32 frame_no      per-unit frame counter (echoed by the strip)
 *    u16 width         image width px
 *    u16 height        image height px
 *    u32 jpeg_len      bytes following the header
 *    f64 pose_t_ms     unix ms of the vehicle pose sample rendered
 *    f64 render_t_ms   unix ms when the frame left the browser
 ********************************************************************************** */

export const FRAME_HEADER_BYTES = 32;
export const STRIP_CELLS = 16;          // frame_no bits echoed in-band
export const STRIP_ROWS = 8;            // bottom pixel rows
export const STREAM_COLOR = 0;
export const STREAM_ID_PASS = 1;

export function packFrameHeader(unitIdx, streamId, frameNo, width, height,
                                jpegLen, poseTms, renderTms) {
    const b = new ArrayBuffer(FRAME_HEADER_BYTES);
    const u = new DataView(b);
    u.setUint16(0, unitIdx, true);
    u.setUint16(2, streamId, true);
    u.setUint32(4, frameNo >>> 0, true);
    u.setUint16(8, width, true);
    u.setUint16(10, height, true);
    u.setUint32(12, jpegLen >>> 0, true);
    u.setFloat64(16, poseTms, true);
    u.setFloat64(24, renderTms, true);
    return b;
}

export function unpackFrameHeader(buf) {
    const u = new DataView(buf.buffer || buf,
                           buf.byteOffset || 0, FRAME_HEADER_BYTES);
    return {
        unit_idx: u.getUint16(0, true),
        stream_id: u.getUint16(2, true),
        frame_no: u.getUint32(4, true),
        width: u.getUint16(8, true),
        height: u.getUint16(10, true),
        jpeg_len: u.getUint32(12, true),
        pose_t_ms: u.getFloat64(16, true),
        render_t_ms: u.getFloat64(24, true),
    };
}

/* ---- frame-number strip ------------------------------------------------
 * 16 cells across the bottom STRIP_ROWS rows; cell i carries bit i of
 * frame_no (LSB first) as white(255)/black(0). Drawn into the RGBA pixel
 * buffer before JPEG encode, so the V4L2 reader sees it without any
 * out-of-band channel. The cells sit in the image itself, so a detector
 * could in principle see them - the bottom 8 px of 480 is ~1.7% of the
 * frame; the yolo config has no ROI support, documented limitation.
 */
export function drawStrip(rgba, width, height, frameNo) {
    const cellW = Math.floor(width / STRIP_CELLS);
    for (let i = 0; i < STRIP_CELLS; ++i) {
        const on = (frameNo >>> i) & 1;
        const v = on ? 255 : 0;
        const x0 = i * cellW, x1 = Math.min(x0 + cellW, width);
        for (let y = height - STRIP_ROWS; y < height; ++y) {
            let p = (y * width + x0) * 4;
            for (let x = x0; x < x1; ++x, p += 4) {
                rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
                rgba[p + 3] = 255;
            }
        }
    }
    return rgba;
}

/* Decode a strip from a grayscale luma buffer (what the probe reads
 * back off the V4L2 device); returns the 16-bit frame_no. An all-dark
 * strip reads as frame 0 - indistinguishable from a real frame_no 0 by
 * design (the probe pairs rows with the stream's frame_meta events). */
export function readStrip(luma, width, height) {
    const cellW = Math.floor(width / STRIP_CELLS);
    const yMid = height - Math.floor(STRIP_ROWS / 2);
    let frameNo = 0;
    for (let i = 0; i < STRIP_CELLS; ++i) {
        const xMid = i * cellW + Math.floor(cellW / 2);
        if (luma[yMid * width + xMid] > 127) frameNo |= (1 << i);
    }
    return frameNo >>> 0;
}

/* ---- mount matrix -------------------------------------------------------
 * Harness geo_projection.py: camera frame is x right, y down, z forward
 * (CV); geo_ray_body maps it to body FRD with base = (cam_z, cam_x, cam_y)
 * then applies the ZYX mount euler Rz(yaw)*Ry(pitch)*Rx(roll), so mount
 * pitch -90 aims the camera straight down. A three.js PerspectiveCamera
 * instead looks along its local -Z with +Y up; the fixed child rotation
 * below converts between the two (CV -> three camera: flip y and z), so
 *  cameraWorld = vehicleMeshQuat * mountQuat
 * renders exactly the rays geo_ray_body produces in NED (verified
 * numerically - the vehicle mesh quaternion is already the NED->three
 * basis-changed attitude).
 */

// 3x3 helpers (row-major arrays) - kept dependency-free for node --test
export function rot3(roll, pitch, yaw) {
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    return [
        cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr,
        sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr,
        -sp,     cp * sr,              cp * cr];
}

function mul3(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; ++r)
        for (let c = 0; c < 3; ++c)
            o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] +
                           a[r * 3 + 2] * b[6 + c];
    return o;
}

/* CV camera axes expressed in body FRD after the mount euler - the same
 * product the harness applies in geo_ray_body (R_mount * A). */
export function mountBodyMatrix(mountDeg) {
    const A = [0, 0, 1,   // cam_x -> body_y
               1, 0, 0,   // cam_y -> body_z
               0, 1, 0];  // cam_z -> body_x
    const R = rot3(mountDeg.roll_deg * Math.PI / 180,
                   mountDeg.pitch_deg * Math.PI / 180,
                   mountDeg.yaw_deg * Math.PI / 180);
    return mul3(R, A);
}

/* The three.js-space mount quaternion as a flat 3x3: body->three is the
 * same NED->three map C = [[1,0,0],[0,0,-1],[0,1,0]] (x=north, y=up,
 * z=east), and the CV->three-camera flip is F = diag(1,-1,-1):
 *   mountThree = C * R_mount * A * F           */
export function mountThreeMatrix(mountDeg) {
    const C = [1, 0, 0, 0, 0, -1, 0, 1, 0];
    const F = [1, 0, 0, 0, -1, 0, 0, 0, -1];
    return mul3(mul3(C, mountBodyMatrix(mountDeg)), F);
}

/* three.js PerspectiveCamera check used at rig load (D2): the harness
 * hfov must match what fov=vfov + aspect gives, warn above 0.5 deg. */
export function expectedHfovDeg(vfovDeg, width, height) {
    return 2 * Math.atan(Math.tan(vfovDeg * Math.PI / 360) *
                         (width / height)) * 180 / Math.PI;
}
