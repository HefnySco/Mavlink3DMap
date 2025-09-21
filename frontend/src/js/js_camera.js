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

    m_fov = 75;
    m_isDownward = false;

    // Reusable temps to avoid per-frame allocations
    v_q1; v_q2; v_q3;
    _qIdentity = new THREE.Quaternion(); // left at identity; never mutate directly
    _eulerYXZ = new THREE.Euler(0, 0, 0, 'YXZ'); // Y->X->Z (matches existing multiply order)
    _tmpV1 = new THREE.Vector3();
    _tmpV2 = new THREE.Vector3();

    /**
     * @param {Object} p_attachedObject - The object to which the camera is attached.
     * @param {boolean} p_createHelper - Whether to create a camera helper for debugging.
     * @param {boolean} p_ownerRotationIndependent - Whether the camera is independent of the object's rotation (default: false).
     */
    constructor(p_attachedObject, p_createHelper, p_ownerRotationIndependent, p_isDownward = false, p_fov = 75) {
        this.v_q1 = new THREE.Quaternion();
        this.v_q2 = new THREE.Quaternion();
        this.v_q3 = new THREE.Quaternion();

        this.m_fov = p_fov;
        this.m_isDownward = p_isDownward;
        this.m_OwnerRotationIndependent = p_ownerRotationIndependent ?? false;

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
        const aspectRatio = p_attachedObject.m_canvas
            ? p_attachedObject.m_canvas.width / p_attachedObject.m_canvas.height
            : 1.33;
        const v_camera = new THREE.PerspectiveCamera(
            this.m_fov,
            aspectRatio,
            0.1,
            1000
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

        const rotationIndependent = this.m_OwnerRotationIndependent;

        if (this.m_orbitMode) {
            // Orbit mode: rotate relative position around parent's origin
            // Use cached temp vector instead of clone()
            const rel = this._tmpV1.copy(this.m_relativePosition);

            // Apply elevation (X) and azimuth (Y) in parent's local space
            if (this.m_elevation !== 0) {
                this.v_q1.setFromAxisAngle(_xAxis, this.m_elevation);
                rel.applyQuaternion(this.v_q1);
            }
            if (this.m_azimuth !== 0) {
                this.v_q2.setFromAxisAngle(_yAxis, this.m_azimuth);
                rel.applyQuaternion(this.v_q2);
            }

            // Transform to world space by parent's orientation unless rotation-independent
            if (!rotationIndependent) {
                rel.applyQuaternion(v_vehicleOrientationQT);
            }

            // Position = parent position + rotated relative vector
            c_camera.position.copy(p_position).add(rel);

            // Look at parent origin
            c_camera.lookAt(p_position);

            // Apply bank around camera's local Z
            if (this.m_bank !== 0) {
                c_camera.rotateZ(this.m_bank);
            }

            return;
        }

        // ---------- Non-orbit behavior ----------
        // Base orientation: either parent's or identity (no allocation)
        c_camera.quaternion.copy(rotationIndependent ? this._qIdentity : v_vehicleOrientationQT);

        // Position offset in one pass (replaces three translateOnAxis calls)
        // Local offset vector (right, up, forward)
        const offset = this._tmpV2.set(
            this.m_positionCamera_Y,
            this.m_positionCamera_Z,
            -this.m_positionCamera_X
        ).applyQuaternion(c_camera.quaternion);

        c_camera.position.copy(p_position).add(offset);

        if (this.m_isDownward) {
            // Downward-facing: Look at ground
            // Use a tiny epsilon below to avoid exact horizontal lookAt edge cases
            const groundY = -0.01;
            c_camera.lookAt(p_position.x, groundY, p_position.z);

            // Stabilization
            let c_pitchCaneller = 0;
            let c_rollCaneller = 0;

            if (!rotationIndependent) {
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

            if (c_pitchCaneller !== 0) this.v_q1.setFromAxisAngle(_yAxis, c_pitchCaneller);
            if (c_rollCaneller !== 0) this.v_q2.setFromAxisAngle(_zAxis, c_rollCaneller);

            // Multiply only what’s needed; preserves original order q = q * q1 * q2
            if (c_pitchCaneller !== 0) c_camera.quaternion.multiply(this.v_q1);
            if (c_rollCaneller !== 0) c_camera.quaternion.multiply(this.v_q2);

        } else {
            // Forward-facing: local camera rotations (combine into one quaternion)
            // Original order: q = base * yaw(Y) * roll(X) * pitch(Z)  => Euler order 'YXZ'
            this._eulerYXZ.set(this.m_rollCamera, this.m_yawCamera, this.m_pitchCamera, 'YXZ');
            this.v_q1.setFromEuler(this._eulerYXZ);
            c_camera.quaternion.multiply(this.v_q1);
        }
    }
}

export { CameraController };