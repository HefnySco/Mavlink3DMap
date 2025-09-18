/* ********************************************************************************
 *   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
 *
 *   Author: Mohammad S. Hefny
 *
 *   Date:   19 Sep 2020
 *********************************************************************************** */

import * as THREE from 'three';
import { PI_div_2, _xAxis, _yAxis, _zAxis, DEG_2_RAD, getAngleOfPWM } from './js_globals.js';

class CameraController {
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

    // New properties for orbit mode
    m_orbitMode = false;
    m_relativePosition = new THREE.Vector3();
    m_azimuth = 0;
    m_elevation = 0;
    m_bank = 0;

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

        // Store the initial relative position vector for orbit mode
        this.m_relativePosition.set(p_lat, p_alt, -p_lng); // x: lateral (right), y: alt (up), z: -lng (forward)

        this.fn_setCameraOrientation(p_roll, p_pitch, p_yaw);
    }

    /**
     * Adjusts the camera's orientation by the specified deltas.
     * @param {number} p_rollDelta - Delta for roll.
     * @param {number} p_pitchDelta - Delta for pitch.
     * @param {number} p_yawDelta - Delta for yaw.
     */
    fn_setCameraDeltaOrientation(p_rollDelta, p_pitchDelta, p_yawDelta) {
        if (this.m_orbitMode) {
            this.m_bank += p_rollDelta;
            this.m_elevation += p_pitchDelta;
            this.m_azimuth -= p_yawDelta;
        } else {
            this.m_rollCamera += p_pitchDelta;
            this.m_pitchCamera += p_rollDelta;
            this.m_yawCamera += p_yawDelta;
        }
    }

    /**
     * Sets the camera's orientation to the specified values.
     * @param {number} p_roll - Roll angle.
     * @param {number} p_pitch - Pitch angle.
     * @param {number} p_yaw - Yaw angle.
     */
    fn_setCameraOrientation(p_roll, p_pitch, p_yaw) {
        if (this.m_orbitMode) {
            this.m_bank = p_roll;
            this.m_elevation = p_pitch;
            this.m_azimuth = p_yaw - PI_div_2;
        } else {
            this.m_rollCamera = p_pitch;
            this.m_pitchCamera = p_roll;
            this.m_yawCamera = p_yaw - PI_div_2;
        }
    }

    /**
     * Enables or disables orbit mode.
     * @param {boolean} enable - Whether to enable orbit mode.
     */
    fn_setOrbitMode(enable) {
        this.m_orbitMode = enable;
    }

    /**
     * Applies the camera's position and orientation based on the parent object's state.
     * @param {THREE.Vector3} p_position - Parent object's position.
     * @param {THREE.Quaternion} v_vehicleOrientationQT - Parent object's orientation.
     */
    fn_applyCameraIMU(p_position, v_vehicleOrientationQT) {
        const c_camera = this.m_cameraThree;

        if (!c_camera) return;

        let vehicleOrientation = v_vehicleOrientationQT;
        if (this.m_OwnerRotationIndependent) {
            vehicleOrientation = new THREE.Quaternion(); // Reset orientation if independent
        }

        if (this.m_orbitMode) {
            // Orbit mode: Position camera by rotating relative position around parent's origin
            const relative = this.m_relativePosition.clone();

            // Apply rotations in parent’s local space: elevation (around X), azimuth (around Y), bank (around Z)
            const qElev = new THREE.Quaternion().setFromAxisAngle(_xAxis, this.m_elevation);
            const qAzim = new THREE.Quaternion().setFromAxisAngle(_yAxis, this.m_azimuth);
            relative.applyQuaternion(qElev).applyQuaternion(qAzim);

            // Transform relative position to world space using parent's orientation
            relative.applyQuaternion(vehicleOrientation);

            // Set camera position: parent position + rotated relative position
            c_camera.position.copy(p_position).add(relative);

            // Make camera look at the parent's origin (position)
            c_camera.lookAt(p_position);

            // Apply bank (roll around camera's local Z axis)
            c_camera.rotateZ(this.m_bank);
        } else {
            // Original non-orbit behavior
            c_camera.setRotationFromQuaternion(vehicleOrientation);

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
            vehicleOrientation.multiply(this.v_q1).multiply(this.v_q3).multiply(this.v_q2);

            c_camera.setRotationFromQuaternion(vehicleOrientation);
        }
    }
}

export { CameraController };