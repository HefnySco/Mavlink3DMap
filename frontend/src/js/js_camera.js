/* ********************************************************************************
 *   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
 *
 *   Author: Mohammad S. Hefny
 *
 *   Date:   19 Sep 2020
 *********************************************************************************** */

import * as THREE from 'three';
import { PI_div_2, _xAxis, _yAxis, _zAxis, DEG_2_RAD, getAngleOfPWM } from './js_globals.js';

class c_Camera {
    // Camera Relative Rotation & Position
    m_positionCamera_X = 0;
    m_positionCamera_Y = 0;
    m_positionCamera_Z = 0;
    m_rollCamera = 0;
    m_pitchCamera = 0;
    m_yawCamera = 0;

    m_tilteServoChannel = undefined;
    m_rollServoChannel = undefined;

    m_cameraThree;
    m_helperThree;
    m_ownerObject;

    m_OwnerRotationIndependent = false;
    m_VerticalStabilizer = false;
    m_HorizontalStabilizer = false;

    /**
     * @param {Object} p_attachedObject - The object to which the camera is attached.
     * @param {boolean} p_createHelper - Whether to create a camera helper for debugging.
     * @param {boolean} p_ownerRotationIndependent - Whether the camera is independent of the object's rotation (default: false).
     */
    constructor(p_attachedObject, p_createHelper, p_ownerRotationIndependent) {
        this.v_q1 = new THREE.Quaternion();
        this.v_q2 = new THREE.Quaternion();
        this.v_q3 = new THREE.Quaternion();

        if (p_ownerRotationIndependent != null) {
            this.m_OwnerRotationIndependent = p_ownerRotationIndependent;
        }

        this.fn_createCameraForObject(p_createHelper, p_attachedObject);
    }

    /**
     * Sets the camera's rotation independence and stabilization settings.
     * @param {boolean} p_all - If true, the camera is fully independent (other values are ignored).
     * @param {boolean} p_vertical - If true, the camera's vertical direction is stabilized to the world vertical.
     * @param {boolean} p_horizontal - If true, the camera's horizontal direction is stabilized to the world horizontal.
     * @param {number} p_tiltChannel - The servo channel for tilt stabilization (optional).
     * @param {number} p_rollChannel - The servo channel for roll stabilization (optional).
     */
    fn_setRotationIndependence(p_all, p_vertical, p_horizontal, p_tiltChannel, p_rollChannel) {
        this.m_OwnerRotationIndependent = p_all;

        if (p_all && (p_horizontal || p_vertical)) {
            console.warn("WARNING: If p_all is true, other values are ignored.");
            return;
        }

        this.m_VerticalStabilizer = p_vertical;
        this.m_HorizontalStabilizer = p_horizontal;

        this.m_tilteServoChannel = p_tiltChannel;
        this.m_rollServoChannel = p_rollChannel;
    }

    /**
     * Creates a camera and attaches it to the specified object.
     * @param {boolean} p_createHelper - Whether to create a camera helper for debugging.
     * @param {Object} p_attachedObject - The object to which the camera is attached.
     */
    fn_createCameraForObject(p_createHelper, p_attachedObject) {
        const v_camera = new THREE.PerspectiveCamera(
            75, // FOV
            1,  // Aspect Ratio
            0.1, // Near Clipping Plane
            1000 // Far Clipping Plane
        );

        v_camera.userData.m_ownerObject = this;
        this.m_cameraThree = v_camera;
        this.m_ownerObject = p_attachedObject;

        if (p_createHelper) {
            this.m_helperThree = new THREE.CameraHelper(v_camera);
        }
    }

    /**
     * Sets the camera's position relative to the parent object.
     * @param {number} p_lat - Lateral position.
     * @param {number} p_lng - Longitudinal position.
     * @param {number} p_alt - Altitude.
     * @param {number} p_roll - Roll angle.
     * @param {number} p_pitch - Pitch angle.
     * @param {number} p_yaw - Yaw angle.
     */
    fn_setCameraRelativePosition(p_lat, p_lng, p_alt, p_roll, p_pitch, p_yaw) {
        this.m_positionCamera_X = p_lng;
        this.m_positionCamera_Y = p_lat;
        this.m_positionCamera_Z = p_alt;
        this.m_rollCamera = p_pitch;
        this.m_pitchCamera = p_roll;
        this.m_yawCamera = p_yaw - PI_div_2;
    }

    /**
     * Adjusts the camera's orientation by the specified deltas.
     * @param {number} p_rollDelta - Delta for roll.
     * @param {number} p_pitchDelta - Delta for pitch.
     * @param {number} p_yawDelta - Delta for yaw.
     */
    fn_setCameraDeltaOrientation(p_rollDelta, p_pitchDelta, p_yawDelta) {
        this.m_rollCamera += p_pitchDelta;
        this.m_pitchCamera += p_rollDelta;
        this.m_yawCamera += p_yawDelta;
    }

    /**
     * Sets the camera's orientation to the specified values.
     * @param {number} p_roll - Roll angle.
     * @param {number} p_pitch - Pitch angle.
     * @param {number} p_yaw - Yaw angle.
     */
    fn_setCameraOrientation(p_roll, p_pitch, p_yaw) {
        this.m_rollCamera = p_roll;
        this.m_pitchCamera = p_pitch;
        this.m_yawCamera = p_yaw - PI_div_2;
    }

    /**
     * Applies the camera's position and orientation based on the parent object's state.
     * @param {THREE.Vector3} p_position - Parent object's position.
     * @param {THREE.Quaternion} v_vehicleOrientationQT - Parent object's orientation.
     */
    fn_applyCameraIMU(p_position, v_vehicleOrientationQT) {
        const c_camera = this.m_cameraThree;

        if (!c_camera) return;

        if (this.m_OwnerRotationIndependent) {
            v_vehicleOrientationQT = new THREE.Quaternion(); // Reset orientation if independent
        }

        // Set camera's base orientation to match the parent object
        c_camera.setRotationFromQuaternion(v_vehicleOrientationQT);

        // Move camera to the parent object's position
        c_camera.position.set(p_position.x, p_position.y, p_position.z);

        // Adjust camera's position relative to the parent object
        c_camera.translateOnAxis(_xAxis, this.m_positionCamera_Y);
        c_camera.translateOnAxis(_yAxis, this.m_positionCamera_Z);
        c_camera.translateOnAxis(_zAxis, -this.m_positionCamera_X);

        // Calculate stabilization adjustments
        let c_pitchCaneller = 0;
        let c_rollCaneller = 0;
        let c_yawCaneller = 0;

        if (!this.m_OwnerRotationIndependent) {
            if (this.m_HorizontalStabilizer) {
                c_rollCaneller = this.m_ownerObject.m_roll;
            }

            if (this.m_VerticalStabilizer) {
                c_pitchCaneller = -this.m_ownerObject.m_pitch;
            }

            if (this.m_tilteServoChannel != null) {
                c_pitchCaneller -= getAngleOfPWM(
                    90 * DEG_2_RAD,
                    -45 * DEG_2_RAD,
                    this.m_ownerObject.m_servoValues[this.m_tilteServoChannel],
                    1900,
                    1100
                );
            }

            if (this.m_rollServoChannel != null) {
                c_rollCaneller = getAngleOfPWM(
                    90 * DEG_2_RAD,
                    -45 * DEG_2_RAD,
                    this.m_ownerObject.m_servoValues[this.m_rollServoChannel],
                    1900,
                    1100
                );
            }
        }

        // Apply rotation adjustments
        this.v_q1.setFromAxisAngle(_yAxis, this.m_yawCamera + c_yawCaneller);
        this.v_q2.setFromAxisAngle(_zAxis, this.m_pitchCamera + c_rollCaneller);
        this.v_q3.setFromAxisAngle(_xAxis, this.m_rollCamera + c_pitchCaneller);
        v_vehicleOrientationQT.multiply(this.v_q1).multiply(this.v_q3).multiply(this.v_q2);

        c_camera.setRotationFromQuaternion(v_vehicleOrientationQT);
    }
}

export { c_Camera };