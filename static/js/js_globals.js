const MAVLINK_MSG_ID_HEARTBEAT          = 0;
const MAVLINK_MSG_ID_GPS_RAW_INT        = 24;
const MAVLINK_MSG_ID_ATTITUDE           = 30;
const MAVLINK_MSG_ID_LOCAL_POSITION_NED = 32;
const MAVLINK_MSG_ID_SERVO_OUTPUT_RAW   = 36;
const MAVLINK_MSG_ID_RC_CHANNELS        = 65;

const SERVO_NO_9                        = 0;
const SERVO_NO_10                       = 1;

//https://ardupilot.org/copter/docs/parameters.html#frame-class


const PI_div_2 = Math.PI /2.0;
const DEG_2_RAD = Math.PI / 180.0;
const MILE_TO_METER = 1609.34;
const MILE_TO_KM = 1.60934;


var gravityConstant = 9.8;


var _xAxis = new THREE.Vector3( 1, 0, 0 );
var _yAxis = new THREE.Vector3( 0, 1, 0 );
var _zAxis = new THREE.Vector3( 0, 0, 1 );
    