import * as THREE from 'three';

// MAVLINK message IDs
export const MAVLINK_MSG_ID_HEARTBEAT = 0;
export const MAVLINK_MSG_ID_GPS_RAW_INT = 24;
export const MAVLINK_MSG_ID_ATTITUDE = 30;
export const MAVLINK_MSG_ID_LOCAL_POSITION_NED = 32;
export const MAVLINK_MSG_ID_SERVO_OUTPUT_RAW = 36;
export const MAVLINK_MSG_ID_RC_CHANNELS = 65;

// Servo indices
export const SERVO_NO_9 = 0;
export const SERVO_NO_10 = 1;

// Constants for physics and math
export const PI_div_2 = Math.PI / 2.0;
export const DEG_2_RAD = Math.PI / 180.0;
export const MAP_SCALE = 1418;
export const MILE_TO_KM = 1.60934;
export const gravityConstant = 9.8;
export const metersPerDegreeLat = 111319.9;

// Three.js vectors
export const _xAxis = new THREE.Vector3(1, 0, 0);
export const _yAxis = new THREE.Vector3(0, 1, 0);
export const _zAxis = new THREE.Vector3(0, 0, 1);

// Map coordinates
export const _map_lng = 149.1652374;
export const _map_lat = -35.3632621;

// Placeholder for FRAME_TYPE_UNKNOWN
export const FRAME_TYPE_UNKNOWN = 0;

// Utility function for PWM to angle conversion
export function getAngleOfPWM(maxAngle, minAngle, pwmValue, maxPWM = 1900, minPWM = 1100) {
    return (pwmValue - minPWM) / (maxPWM - minPWM) * (maxAngle - minAngle) + minAngle;
}

// Placeholder for getInitialDisplacement
export function getInitialDisplacement() {
    // Return X, Y offsets in meters
    // Example: Adjust based on specific requirements (e.g., from config or URL parameters)
    //return { X: -140, Y: 110,  Alt: 0}; // Default: no offset
    return { X: 0, Y: 0,  Alt: 0}; // Default: no offset
}



export const getMetersPerDegreeLng = (lat) => metersPerDegreeLat * Math.cos(lat * Math.PI / 180);
