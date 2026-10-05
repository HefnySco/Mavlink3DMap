/* node --test test/de_geo.test.mjs
 *
 * P5-14 gate: the viewer's lat/lng <-> (x,z) conversion must match the
 * simulation harness formula (engine/geo_projection.py) within 1 mm
 * over a 2 km span, on 10 sample points in both directions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fn_makeWorldConverter, M_PER_DEG_LAT } from '../src/js/world/de_geo.js';

// the harness reference, restated here - geo_latlng_to_ne /
// geo_offset_to_latlng evaluated at the reference latitude
const HARNESS_M_PER_DEG_LAT = 111320.0;
function harness_latlng_to_ne(lat0, lng0, lat1, lng1) {
    let clat = Math.cos(lat0 * Math.PI / 180);
    if (Math.abs(clat) < 1e-6) clat = 1e-6;
    return [
        (lat1 - lat0) * HARNESS_M_PER_DEG_LAT,
        (lng1 - lng0) * HARNESS_M_PER_DEG_LAT * clat,
    ];
}
function harness_ne_to_latlng(lat0, lng0, north_m, east_m) {
    let clat = Math.cos(lat0 * Math.PI / 180);
    if (Math.abs(clat) < 1e-6) clat = 1e-6;
    return [
        lat0 + north_m / HARNESS_M_PER_DEG_LAT,
        lng0 + east_m / (HARNESS_M_PER_DEG_LAT * clat),
    ];
}

const ORIGIN = [-35.3632621, 149.1652374];          // the SITL field
// 10 points spread over ~2 km of north/east offsets
const OFFSETS_M = [
    [0, 0], [500, 0], [0, 500], [-500, 500], [500, -500],
    [1000, 1000], [-1000, -1000], [2000, 0], [0, -2000], [1414, 1414],
];

test('constant matches the harness', () => {
    assert.equal(M_PER_DEG_LAT, HARNESS_M_PER_DEG_LAT);
});

test('lat/lng -> xz within 1 mm over 2 km', () => {
    const conv = fn_makeWorldConverter(ORIGIN[0], ORIGIN[1]);
    for (const [north_m, east_m] of OFFSETS_M) {
        const [lat, lng] = harness_ne_to_latlng(
            ORIGIN[0], ORIGIN[1], north_m, east_m);
        const { x, z } = conv.fn_latLngToXZ(lat, lng);
        const [want_n, want_e] = harness_latlng_to_ne(
            ORIGIN[0], ORIGIN[1], lat, lng);
        assert.ok(Math.abs(x - want_n) <= 0.001,
            `x err ${Math.abs(x - want_n)} m at ${north_m},${east_m}`);
        assert.ok(Math.abs(z - want_e) <= 0.001,
            `z err ${Math.abs(z - want_e)} m at ${north_m},${east_m}`);
        // x is north, z is east, both in meters
        assert.ok(Math.abs(x - north_m) <= 0.001);
        assert.ok(Math.abs(z - east_m) <= 0.001);
    }
});

test('xz -> lat/lng round-trips within 1 mm over 2 km', () => {
    const conv = fn_makeWorldConverter(ORIGIN[0], ORIGIN[1]);
    for (const [north_m, east_m] of OFFSETS_M) {
        const [lat, lng] = harness_ne_to_latlng(
            ORIGIN[0], ORIGIN[1], north_m, east_m);
        const back = conv.fn_xzToLatLng(
            conv.fn_latLngToXZ(lat, lng).x,
            conv.fn_latLngToXZ(lat, lng).z);
        const [err_n, err_e] = harness_latlng_to_ne(
            ORIGIN[0], ORIGIN[1], back.lat, back.lng);
        assert.ok(Math.abs(err_n - north_m) <= 0.001,
            `north err ${Math.abs(err_n - north_m)} m`);
        assert.ok(Math.abs(err_e - east_m) <= 0.001,
            `east err ${Math.abs(err_e - east_m)} m`);
    }
});
