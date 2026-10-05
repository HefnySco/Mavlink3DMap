/* ********************************************************************************
*   DroneEngage world frame - flat-earth lat/lng <-> Three.js (x,z)
*
*   This MUST match the simulation harness bit for bit
*   (droneengage_simulation_land engine/geo_projection.py):
*
*       north_m = (lat1 - lat0) * M_PER_DEG_LAT
*       east_m  = (lng1 - lng0) * M_PER_DEG_LAT * cos(rad(lat0))
*
*   evaluated at the REFERENCE latitude (hello.origin), flat earth.
*   Three.js frame used by this app: x = north, z = east, y = up.
*********************************************************************************** */

export const M_PER_DEG_LAT = 111320.0;

const DEG_2_RAD = Math.PI / 180.0;

/**
 * Build a converter anchored at a world origin {lat, lng} (degrees).
 * cos() is evaluated once at the origin latitude - the harness does
 * the same, so vehicles, entities and obstacles share one frame.
 */
export function fn_makeWorldConverter(origin_lat, origin_lng) {
    let clat = Math.cos(origin_lat * DEG_2_RAD);
    if (Math.abs(clat) < 1e-6) clat = 1e-6;
    const mPerDegLng = M_PER_DEG_LAT * clat;

    return {
        /* lat,lng (deg) -> {x: north_m, z: east_m} relative to origin */
        fn_latLngToXZ(lat, lng) {
            return {
                x: (lat - origin_lat) * M_PER_DEG_LAT,
                z: (lng - origin_lng) * mPerDegLng
            };
        },
        /* inverse: {x,z} meters -> {lat,lng} degrees */
        fn_xzToLatLng(x, z) {
            return {
                lat: origin_lat + x / M_PER_DEG_LAT,
                lng: origin_lng + z / mPerDegLng
            };
        },
        m_per_deg_lng: mPerDegLng
    };
}
