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
    #m_positionCamera_X = 0;
    #m_positionCamera_Y = 0;
    #m_positionCamera_Z = 0;
    #m_rollCamera = 0;
    #m_pitchCamera = 0;
    #m_yawCamera = 0;

    #m_tilteServoChannel = undefined;
    #m_rollServoChannel = undefined;

    #m_OwnerRotationIndependent = false;
    #m_VerticalStabilizer = false;
    #m_HorizontalStabilizer = false;

    // New properties for orbit mode
    #m_orbitMode = false;
    m_relativePosition = new THREE.Vector3();
    #m_azimuth = 0;
    #m_elevation = 0;
    #m_bank = 0;

    /**
     * @param {Object} p_attachedObject - The object to which the camera is attached.
     * @param {boolean} p_createHelper - Whether to create a camera helper for debugging.
     * @param {number} p_fov - camera FOV
     */
    constructor(p_attachedObject, p_createHelper, p_fov = 45) {
        this.v_q1 = new THREE.Quaternion();
        this.v_q2 = new THREE.Quaternion();
        this.v_q3 = new THREE.Quaternion();

        this.m_helperThree = null;
        this.m_cameraThree = null;
        this.m_ownerObject = p_attachedObject;

        this.#fn_createCameraForObject( p_createHelper, p_fov);
    }


    // Inside class CameraController
    fn_scaleRelativePosition(scaleFactorX, scaleFactorY, scaleFactorZ) {
        this.#m_positionCamera_Y *= scaleFactorX;  // Affects X-axis translate
        this.#m_positionCamera_Z *= scaleFactorY;  // Affects Y-axis translate
        this.#m_positionCamera_X *= scaleFactorZ;  // Affects Z-axis translate

        // If in orbit mode, scale the relative position vector accordingly
        if (this.#m_orbitMode) {
            this.m_relativePosition.x *= scaleFactorX;
            this.m_relativePosition.y *= scaleFactorY;
            this.m_relativePosition.z *= scaleFactorZ;
        }
    }

    /**
     * Sets the camera's rotation independence and stabilization settings.
     * @param {boolean} p_no_stabilization - If true, the camera is fully independent (other values are ignored).
     * @param {boolean} p_enable_vertical_stabilization - If true, the camera's vertical direction is stabilized to the world vertical.
     * @param {boolean} p_enable_horizontal_stabilization - If true, the camera's horizontal direction is stabilized to the world horizontal.
     * @param {number} p_tiltChannel - The servo channel for tilt stabilization (optional).
     * @param {number} p_rollChannel - The servo channel for roll stabilization (optional).
     */
    fn_setRotationIndependence(p_no_stabilization, p_enable_vertical_stabilization,
        p_enable_horizontal_stabilization,
        p_tiltChannel, p_rollChannel) {
        this.#m_OwnerRotationIndependent = p_no_stabilization;

        if (p_no_stabilization && (p_enable_horizontal_stabilization || p_enable_vertical_stabilization)) {
            console.warn("WARNING: If p_all is true, other values are ignored.");
            return;
        }

        this.#m_VerticalStabilizer = p_enable_vertical_stabilization;
        this.#m_HorizontalStabilizer = p_enable_horizontal_stabilization;

        this.#m_tilteServoChannel = p_tiltChannel;
        this.#m_rollServoChannel = p_rollChannel;
    }

    /**
     * Creates a camera and attaches it to the specified object.
     * @param {boolean} p_createHelper - Whether to create a camera helper for debugging.
     */
    #fn_createCameraForObject(p_createHelper, p_fov) {
        const v_camera = new THREE.PerspectiveCamera(
            p_fov, // FOV
            1,  // Aspect Ratio
            0.1, // Near Clipping Plane
            1000 // Far Clipping Plane
        );

        v_camera.userData.m_ownerObject = this;
        this.m_cameraThree = v_camera;


        if (p_createHelper) {
            this.m_helperThree = new THREE.CameraHelper(v_camera);
        }
    }

    /**
     * Enables or disables the THREE.CameraHelper visualization.
     * If the helper does not exist, it will be created when enabling.
     * @param {boolean} enable - Whether to enable (true) or disable (false) the camera helper.
     * @param {THREE.Scene} scene - The THREE.Scene instance to add/remove the helper from (required when enabling if not already added).
     */
    fn_setCameraHelperEnabled(enable) {
        if (this.m_helperThree) {   // camera created with no helper will not be able to enable this.
            this.m_helperThree.visible = enable
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
        this.#m_positionCamera_X = p_lng;
        this.#m_positionCamera_Y = p_lat;
        this.#m_positionCamera_Z = p_alt;

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
        if (this.#m_orbitMode) {
            this.#m_bank += p_rollDelta;
            this.#m_elevation += p_pitchDelta;
            this.#m_azimuth -= p_yawDelta;
        } else {
            this.#m_rollCamera += p_pitchDelta;
            this.#m_pitchCamera += p_rollDelta;
            this.#m_yawCamera += p_yawDelta;
        }
    }

    /**
     * Sets the camera's orientation to the specified values.
     * @param {number} p_roll - Roll angle.
     * @param {number} p_pitch - Pitch angle.
     * @param {number} p_yaw - Yaw angle.
     */
    fn_setCameraOrientation(p_roll, p_pitch, p_yaw) {
        if (this.#m_orbitMode) {
            this.#m_bank = p_roll;
            this.#m_elevation = p_pitch;
            this.#m_azimuth = p_yaw - PI_div_2;
        } else {
            this.#m_rollCamera = p_pitch;
            this.#m_pitchCamera = p_roll;
            this.#m_yawCamera = p_yaw - PI_div_2;
        }
    }

    /**
     * Enables or disables orbit mode.
     * @param {boolean} enable - Whether to enable orbit mode.
     */
    fn_setOrbitMode(enable) {
        this.#m_orbitMode = enable;
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
        if (this.#m_OwnerRotationIndependent) {
            vehicleOrientation = new THREE.Quaternion(); // Reset orientation if independent
        }

        if (this.#m_orbitMode) {
            // Orbit mode: Position camera by rotating relative position around parent's origin
            const relative = this.m_relativePosition.clone();

            // Apply rotations in parent’s local space: elevation (around X), azimuth (around Y), bank (around Z)
            const qElev = new THREE.Quaternion().setFromAxisAngle(_xAxis, this.#m_elevation);
            const qAzim = new THREE.Quaternion().setFromAxisAngle(_yAxis, this.#m_azimuth);
            relative.applyQuaternion(qElev).applyQuaternion(qAzim);

            // Transform relative position to world space using parent's orientation
            relative.applyQuaternion(vehicleOrientation);

            // Set camera position: parent position + rotated relative position
            c_camera.position.copy(p_position).add(relative);

            // Make camera look at the parent's origin (position)
            c_camera.lookAt(p_position);

            // Apply bank (roll around camera's local Z axis)
            c_camera.rotateZ(this.#m_bank);


        }
        else {
            // Original non-orbit behavior
            c_camera.setRotationFromQuaternion(vehicleOrientation);

            // Move camera to the parent object's position
            c_camera.position.set(p_position.x, p_position.y, p_position.z);

            // Adjust camera's position relative to the parent object
            c_camera.translateOnAxis(_xAxis, this.#m_positionCamera_Y);
            c_camera.translateOnAxis(_yAxis, this.#m_positionCamera_Z);
            c_camera.translateOnAxis(_zAxis, -this.#m_positionCamera_X);

            // Calculate Stabilization adjustments
            let c_pitchCaneller = 0;
            let c_rollCaneller = 0;
            let c_yawCaneller = 0;

            if (!this.#m_OwnerRotationIndependent) {
                if (this.#m_HorizontalStabilizer) {
                    // add horizontal sabilization angle
                    c_rollCaneller = this.m_ownerObject.m_roll;
                }

                if (this.#m_VerticalStabilizer) {
                    // add vertical sabilization angle
                    c_pitchCaneller = -this.m_ownerObject.m_pitch;
                }

                if (this.#m_tilteServoChannel != null) {
                    c_pitchCaneller -= getAngleOfPWM(
                        90 * DEG_2_RAD,
                        -45 * DEG_2_RAD,
                        this.m_ownerObject.m_servoValues[this.#m_tilteServoChannel],
                        1900,
                        1100
                    );
                }

                if (this.#m_rollServoChannel != null) {
                    c_rollCaneller = getAngleOfPWM(
                        90 * DEG_2_RAD,
                        -45 * DEG_2_RAD,
                        this.m_ownerObject.m_servoValues[this.#m_rollServoChannel],
                        1900,
                        1100
                    );
                }
            }

            // Apply rotation adjustments
            this.v_q1.setFromAxisAngle(_yAxis, this.#m_yawCamera + c_yawCaneller);
            this.v_q2.setFromAxisAngle(_zAxis, this.#m_pitchCamera + c_rollCaneller);
            this.v_q3.setFromAxisAngle(_xAxis, this.#m_rollCamera + c_pitchCaneller);
            vehicleOrientation.multiply(this.v_q1).multiply(this.v_q3).multiply(this.v_q2);

            c_camera.setRotationFromQuaternion(vehicleOrientation);
        }
    }
}

export { CameraController };