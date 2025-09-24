/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   26 OCT 2020
*
*********************************************************************************** */


import * as THREE from 'three';
import { CameraController } from './js_camera.js';
import Vehicle from './js_vehicle.js';
import { getMetersPerDegreeLng, metersPerDegreeLat } from './js_globals.js';
import { EVENTS as js_event } from './js_eventList.js'
import { js_eventEmitter } from './js_eventEmitter.js';

const FRAME_TYPE_PLUS = 0;
const FRAME_TYPE_PLANE = 1;
const FRAME_TYPE_X = 2;
const FRAME_TYPE_CUSTOM = 998;
const FRAME_TYPE_UNKNOWN = 999;


class c_ArduVehicles extends Vehicle {


    constructor(p_name) {
        super(p_name);

        this.sid = 0;

        const v = new URLSearchParams(window.location.search);
        this.m_vtol = (v.get("vtol") != null);
        this.mGpsLocation = {
            lat: 0.0,
            lng: 0.0,
            alt: 0.0
        };

        this.m_homeLat = 0;
        this.m_homeLng = 0;
        this.m_homeAlt = 0;

        this.m_zero_set = false;
        this.world = null;  // Reference to C_World
    }


    fn_setLatLngAlt(lat, lng, alt_abs, alt_res) {

        if (this.m_homeLat === 0.0 && this.m_homeLng === 0.0) {
            this.fn_setHomeLatLngAlt(lat, lng, alt_abs - alt_res); // create an initial home locaion.
        }
        this.mGpsLocation.lat = lat / 1e7; // Convert from 1e7 degrees to degrees
        this.mGpsLocation.lng = lng / 1e7;
        this.mGpsLocation.alt = alt_res / 1000; // Convert from mm to meters
        this.mGpsLocation.alt_abs = alt_abs / 1000; // Convert from mm to meters
    }


    fn_setHomeLatLngAlt(lat, lng, alt) {
        this.m_homeLat = lat / 1e7;
        this.m_homeLng = lng / 1e7;
        this.m_homeAlt = alt / 1000;


        js_eventEmitter.fn_dispatch(js_event.EVT_VEHICLE_HOME_CHANGED,
            {
                lat: lat,
                lng: lng,
                alt: alt,
                vehicle: this
            });
    }


    fn_getLocalPositionFromLatLng() {
        if (this.m_homeLat === 0.0 && this.m_homeLng === 0.0) {
            return { x: 0, y: 0, z: 0 }; // Home not set yet
        }

        let refLat = this.m_homeLat;
        let refLng = this.m_homeLng;
        let refAlt = this.m_homeAlt;

        // Use global ref if available (for multi-vehicle consistency)
        if (this.world && this.world.m_scene_env.refLat !== null) {
            refLat = this.world.m_scene_env.refLat;
            refLng = this.world.m_scene_env.refLng;
            refAlt = this.world.m_scene_env.refAlt;
        }

        const deltaLat = this.mGpsLocation.lat - refLat;
        const deltaLng = this.mGpsLocation.lng - refLng;
        const avgLat = (this.mGpsLocation.lat + refLat) / 2;

        const x = deltaLat * metersPerDegreeLat; // North (x)
        const z = deltaLng * getMetersPerDegreeLng(avgLat); // East (z)
        const y = this.mGpsLocation.alt_abs - refAlt / 1000.0; 

        return { x, y, z };
    }

    fn_createVehicle(p_classType, p_attachCamera, p_customObject, p_callbackfunc, p_addtoscene) {
        switch (p_classType) {
            case FRAME_TYPE_X: this.m_type = FRAME_TYPE_X;
                this.#fn_createDroneX(p_attachCamera, p_callbackfunc, p_addtoscene);
                break;

            case FRAME_TYPE_PLUS: this.m_type = FRAME_TYPE_PLUS;
                this.#fn_createDronePlus(p_attachCamera, p_callbackfunc, p_addtoscene);
                break;

            case FRAME_TYPE_PLANE: this.m_type = FRAME_TYPE_PLANE;
                if (this.m_vtol !== true) {
                    this.#fn_createDronePlane(p_attachCamera, p_callbackfunc, p_addtoscene);
                }
                else {
                    this.#fn_createDroneVTOLPlane(p_attachCamera, p_callbackfunc, p_addtoscene);
                }
                break;

            case FRAME_TYPE_PLANE:
                {
                    this.m_type = FRAME_TYPE_CUSTOM;
                    this.fn_createCustom(p_customObject, p_callbackfunc);
                }
                break;

            default: this.m_type = FRAME_TYPE_UNKNOWN;
                this.#fn_createUnknown(p_attachCamera, p_callbackfunc);
                break;
        }
    }

    #fn_createDroneX(p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        let Me = this;
        c_loader.load('/models/vehicles/quadX.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            */

            // extract object from Group

            if (p_attachCamera === true) {
                let v_cam1_down = new CameraController(Me, true, 90);
                v_cam1_down.fn_setRotationIndependence(false, true, true);
                // facing down with stabilizer
                v_cam1_down.fn_setCameraRelativePosition(0.0, 0.0, 0.0,
                    0.0, -1.57, 0.0);

                let v_cam_front = new CameraController(Me, true, 90);
                v_cam_front.fn_setRotationIndependence(false, true, true);
                v_cam_front.fn_setCameraRelativePosition(0.3, 0.0, 0.0,
                    0.0, 0.0, 0.0);

                let v_cam_follow_me = new CameraController(Me, false);
                v_cam_follow_me.fn_setRotationIndependence(true);
                v_cam_follow_me.fn_setOrbitMode(true);
                v_cam_follow_me.fn_setCameraRelativePosition(-1.5, 0.0, 1.5
                    , 0.0, -0.5, 0.0);

                
                Me.m_cameras.push(v_cam1_down);  // drone cam
                Me.m_cameras.push(v_cam_front);  // drone cam front
                Me.m_cameras.push(v_cam_follow_me);  // follow-me
                
            }

            Me.fn_createCustom(p_obj, function (p_mesh) {
                p_callbackfunc(p_mesh);
            });
        });
    }

    #fn_createDronePlus(p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        let Me = this;
        c_loader.load('./models/vehicles/quadplus.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            */

            // extract object from Group

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                let v_cam1_down = new CameraController(Me, true);
                v_cam1_down.fn_setRotationIndependence(false, false, false);
                // facing down with stabilizer
                v_cam1_down.fn_setCameraRelativePosition(0.0, 0.0, 0.0,
                    0.0, -1.57, 0.0);
                let v_cam_follow_me = new CameraController(Me, false);
                v_cam_follow_me.fn_setRotationIndependence(true);
                v_cam_follow_me.fn_setCameraRelativePosition(- 1.5, 0.0, 1.5
                    , 0.0, -0.5, 0.0);

                Me.m_cameras.push(v_cam1_down);
                Me.m_cameras.push(v_cam_follow_me);
            }

            Me.fn_createCustom(p_obj, p_callbackfunc);
        });
    }


    #fn_createDrone4(p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        let Me = this;
        c_loader.load('./models/vehicles/drone4/drone-4.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            */

            // extract object from Group

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                let v_cam1_down = new CameraController(Me, true);
                v_cam1_down.fn_setRotationIndependence(false, true, true, 90);
                // facing down with stabilizer
                v_cam1_down.fn_setCameraRelativePosition(-0.1, -0.3, 0.8,
                    0.0, 1.57, 0.0);
                
                
                let v_cam_follow_me = new CameraController(Me, false);
                v_cam_follow_me.fn_setRotationIndependence(true);
                v_cam_follow_me.fn_setOrbitMode(true);
                v_cam_follow_me.fn_setCameraRelativePosition(-1.5, 0.0, 1.5
                    , 0.0, -0.5, 0.0);

                
                // var v_cam3 = new CameraController(Me, true);
                // v_cam3.fn_setCameraRelativePosition(1.0, 0.0, 0.0,
                //     0.0, 0.0, 0.0);

                Me.m_cameras.push(v_cam1_down);  // drone cam
                Me.m_cameras.push(v_cam_follow_me);  // follow-me
            }

            Me.fn_createCustom(p_obj, function (p_mesh) {
                p_callbackfunc(p_mesh);
            });
        });
    }

    // Override
    fn_translateXYZ() {
        return this.fn_getLocalPositionFromLatLng();
    }

    #fn_createDronePlane(p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        let Me = this;
        c_loader.load('./models/vehicles/plane_model1.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            */

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                let v_cam_front = new CameraController(Me, true);
                // 6 & 7 are servo channels that is used by gimbal... you can use them to get real feedback
                //v_cam1.fn_setRotationIndependence (false, false, false, 6, 7);
                v_cam_front.fn_setRotationIndependence(false, false, false, null, null);
                // facing down with stabilizer
                v_cam_front.fn_setCameraRelativePosition(0.4, 0.0, 0.0,
                    0.0, 0.0, 0.0);
                
                    let v_cam_follow_me = new CameraController(Me, false);
                v_cam_follow_me.fn_setRotationIndependence(true);
                v_cam_follow_me.fn_setOrbitMode(true);
                v_cam_follow_me.fn_setCameraRelativePosition(-1.5, 0.0, 1.5
                    , 0.0, -0.5, 0.0);

                
                Me.m_cameras.push(v_cam_front);
                Me.m_cameras.push(v_cam_follow_me);  // follow-me
            }

            Me.fn_createCustom(p_obj, p_callbackfunc);
        });
    }


    #fn_createDroneVTOLPlane(p_attachCamera, p_callbackfunc, p_addtoscene) {
        const c_loader = new THREE.ObjectLoader();
        let Me = this;
        c_loader.load('./models/vehicles/vtol3Motor/model.json', function (p_obj) {

            /*
            Adjust relative object position & orientation here if needed.
            */

            const c_ServoChannels = [10, 11, 12];
            const c_MotorNumber = [1, 2, 3];
            //const c_MotorOffset = [[-40,-45,0], [40,-45,0], [0,100,0]];
            for (let x = 0; x < c_MotorNumber.length; ++x) {
                let label = "M" + (x + 1).toString();
                let M = p_obj.getObjectByName(label);
                if (M != null) {
                    let pivot = new THREE.Group();
                    pivot.add(M);
                    p_addtoscene(pivot);
                    p_obj.add(pivot);

                    let _offset = new THREE.Vector3();
                    M.geometry.computeBoundingBox();
                    let center_motor = M.geometry.boundingBox.getCenter(_offset).clone();
                    // //.geometry.center()
                    M.geometry.center();
                    M.parent.translateX(center_motor.x * M.scale.x);
                    M.parent.translateY(center_motor.y * M.scale.y);
                    M.parent.translateZ(center_motor.z * M.scale.z);

                    M.angle_old = 0;
                    Me.m_children.push(
                        {
                            "index": x,
                            "motor": M,
                            "channel": c_ServoChannels[x] - 9,  // servos are from number 9
                            "offset": M.geometry.boundingSphere.center.clone(),

                        });
                }
            }

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                let v_cam1 = new CameraController(Me, true);
                // channel 6 Servo
                //v_cam1.fn_setRotationIndependence (false, false, false, null, null);
                //v_cam1.m_cameraThree.setRotationFromQuaternion(p_obj.quaternion);
                //v_cam1.fn_setRotationIndependence (true);
                // facing down with stabilizer
                v_cam1.fn_setCameraRelativePosition(1.0, 0.0, 0.0,
                    0.0, 0.0, 0.0);
                
                let v_cam_follow_me = new CameraController(Me, false);
                v_cam_follow_me.fn_setRotationIndependence(true);
                v_cam_follow_me.fn_setOrbitMode(true);
                v_cam_follow_me.fn_setCameraRelativePosition(-1.5, 0.0, 1.5
                    , 0.0, -0.5, 0.0);

                
                Me.m_cameras.push(v_cam1);
                Me.m_cameras.push(v_cam_follow_me);  // follow-me
            }

            Me.fn_createCustom(p_obj, function (p_mesh) {
                p_callbackfunc(p_obj);
            });
        });
    }


    #fn_createUnknown(p_attachCamera, p_callbackfunc) {
        var v_Object = function () { // Run the Group constructor with the given arguments
            THREE.Group.apply(this, arguments);

            let p1 = fn_drawDronePropeller(0xf80008, 0.0, 0.0, 0.0, 0.3);
            p1.m_tag = this;
            this.add(p1);
        };

        v_Object.prototype = Object.create(THREE.Group.prototype);
        v_Object.prototype.constructor = v_Object;
        this.m_Mesh = new v_Object();

        if (p_callbackfunc != null) p_callbackfunc(this.m_Mesh);
    }

    /**
     * Apply actions depends on RCChannels
     */
    fn_applyRCChannels() {

    }


    /**
     * Apply actions depends on Servo Status
     */
    fn_applyServos() {

        // Note: You can read Servo status here and take actions.
        // if (this.m_servoValues[SERVO_NO_9] > 1500)
        // {

        // }
        // else
        // {

        // }
    }



    fn_updateSimulationStep() {
        this.fn_applyRCChannels();
        this.fn_applyServos();
        super.fn_updateSimulationStep();
    }

}


export { c_ArduVehicles };