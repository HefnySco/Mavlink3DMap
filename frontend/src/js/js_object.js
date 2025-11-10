/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   14 Oct 2020
*********************************************************************************** */

import * as THREE from 'three';
import { CameraController } from './js_camera.js';
import { Trigger } from './js_triggerObject.js';
import { FRAME_TYPE_UNKNOWN, _xAxis, _yAxis, _zAxis, DEG_2_RAD } from './js_globals.js'; // Assumes js_globals.js provides these
import { getInitialDisplacement } from './js_globals.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// Stub for getAngleOfPWM (used in fn_apply_attached_units)
function getAngleOfPWM(maxAngle, minAngle, pwmValue, maxPWM, minPWM) {
    return (pwmValue - minPWM) / (maxPWM - minPWM) * (maxAngle - minAngle) + minAngle;
}

/**
 * Represent core simulation object.
 * This is not a physics object.
 */
class SimObject {
    m_cameras = [];
    m_children = [];

    m_positionZero_X = 0;
    m_positionZero_Y = 0;
    m_positionZero_Z = 0;
    m_position_X = 0;
    m_position_Y = 0;
    m_position_Z = 0;
    m_roll = 0;
    m_pitch = 0;
    m_yaw = 0;

    m_servoValues = [0, 0, 0, 0, 0, 0];
    m_startServoIndex = 0;

    m_rcChannelsValues = [0, 0, 0, 0, 0, 0];
    m_startRCChannelIndex = 0;

    m_scale = new THREE.Vector3(1, 1, 1);
    m_Mesh = null;
    m_type = FRAME_TYPE_UNKNOWN;
    m_animateFunction = null;

    m_trigger = new Trigger();
    
    m_label_object = null;
    m_label_enabled = true; 

    constructor(p_name) {
        this.m_name = p_name;
        this.v_q1 = new THREE.Quaternion();
        this.v_q2 = new THREE.Quaternion();
        this.v_q3 = new THREE.Quaternion();
        this.v_qt = new THREE.Quaternion();
        const displacement = getInitialDisplacement();
        this.fn_setZeroPosition(displacement.X, displacement.Y, displacement.Alt);
    }

    fn_addLabel(p_label) {

    }

    fn_toggleLabel()
    {
        if (this.m_label_object)
        {
            this.m_label_object.visible = !this.m_label_object.visible;
        }
    }

    fn_changeScaleByDelta(dX, dY, dZ) {
        const old_scale = this.m_scale.clone();

        this.m_scale.x += dX;
        this.m_scale.y += dY;
        this.m_scale.z += dZ;

        // Prevent division by zero or invalid scales (e.g., clamp to min 0.1)
        if (old_scale.x === 0) old_scale.x = 1;
        if (old_scale.y === 0) old_scale.y = 1;
        if (old_scale.z === 0) old_scale.z = 1;
        this.m_scale.x = Math.max(0.1, this.m_scale.x);
        this.m_scale.y = Math.max(0.1, this.m_scale.y);
        this.m_scale.z = Math.max(0.1, this.m_scale.z);

        this.m_scale.x = Math.min(100, this.m_scale.x);
        this.m_scale.y = Math.min(100, this.m_scale.y);
        this.m_scale.z = Math.min(100, this.m_scale.z);

        // Scale attached cameras' relative positions
        const factorX = this.m_scale.x / old_scale.x;
        const factorY = this.m_scale.y / old_scale.y;
        const factorZ = this.m_scale.z / old_scale.z;

        for (let i = 0; i < this.m_cameras.length; ++i) {
            const cam = this.m_cameras[i];
            cam.fn_scaleRelativePosition(factorX, factorY, factorZ);
        }
    }

    fn_setZeroPosition(x, y, z) {
        this.m_positionZero_X = x;
        this.m_positionZero_Y = y; // Altitude in three.js
        this.m_positionZero_Z = z;
    }

    fn_setPosition(p_lat, p_lng, p_alt) {
        if (this.m_Mesh == null) return;

        this.m_position_X = p_lat - this.m_positionZero_X;
        this.m_position_Y = p_alt - this.m_positionZero_Z;
        this.m_position_Z = p_lng - this.m_positionZero_Y;
    }

    fn_getPosition() {
        return [this.m_position_X, this.m_position_Y, this.m_position_Z];
    }

    fn_setRotation(p_roll, p_pitch, p_yaw) {
        this.m_roll = p_roll;
        this.m_pitch = p_pitch;
        this.m_yaw = p_yaw;
    }

    fn_setServosOutputs(p_startServoIndex, p_servosValues) {
        this.m_startServoIndex = p_startServoIndex;
        this.m_servoValues = p_servosValues;
    }

    fn_setRCChannels(p_startRCChannelIndex, p_rcChannelsValues) {
        this.m_startRCChannelIndex = p_startRCChannelIndex;
        this.m_rcChannelsValues = p_rcChannelsValues;
    }

    fn_castShadow(p_enable) {
        this.m_Mesh.castShadow = p_enable;
    }

    fn_getMesh() {
        return this.m_Mesh;
    }

    fn_getCamera() {
        return this.m_cameras;
    }

    fn_rotateAboutPoint(obj, point, axis, theta, pointIsWorld) {
        pointIsWorld = pointIsWorld === undefined ? false : pointIsWorld;

        if (pointIsWorld) {
            obj.parent.localToWorld(obj.position);
        }

        obj.position.sub(point);
        obj.position.applyAxisAngle(axis, theta);
        obj.position.add(point);

        if (pointIsWorld) {
            obj.parent.worldToLocal(obj.position);
        }

        obj.rotateOnAxis(axis, theta);
    }

    fn_attachedCamera(p_all, p_vertical, p_horizontal) {
        var v_cam1 = new c_Camera(this, true);
        v_cam1.fn_setRotationIndependence(p_all, p_vertical, p_horizontal);
        var v_cam2 = new c_Camera(this, false, true);
        v_cam2.fn_setRotationIndependence(true);
        v_cam2.fn_setCameraRelativePosition(-1.5, 0.0, 1.5, 0.0, -0.5, 0.0);

        this.m_cameras.push(v_cam1);
        this.m_cameras.push(v_cam2);
    }

    fn_addMesh(p_customObject) {
        this.m_Mesh = p_customObject;
    }

    fn_createCustom(p_customObject, p_callbackfunc) {
        this.m_Mesh = new THREE.Group();
        this.m_Mesh.add(p_customObject);
        
        // Add SID label after mesh creation
        this.fn_addLabel();

        if (p_callbackfunc != null) p_callbackfunc(this.m_Mesh);
    }

    fn_apply_attached_units(p_position, v_vehicleOrientationQT) {
        const len = this.m_children.length;
        if (len === 0) return;

        for (let i = 0; i < len; ++i) {
            let obj = this.m_children[i];
            const motor = obj.motor;
            const offset = obj.offset;
            const ch = obj.channel;

            const angle = getAngleOfPWM(90 * DEG_2_RAD, 0 * DEG_2_RAD, parseInt(this.m_servoValues[parseInt(ch)]), 1100, 800);

            this.v_q1.setFromAxisAngle(_yAxis, 0);
            this.v_q2.setFromAxisAngle(_zAxis, 0);
            this.v_q3.setFromAxisAngle(_xAxis, angle);
            this.v_qt.multiplyQuaternions(this.v_q1, this.v_q2).multiply(this.v_q3);
            motor.setRotationFromQuaternion(this.v_qt);
        }
    }

    /**
     * Can be overridden by children classes to use different coordinates.
     */
    fn_translateXYZ() {
        return { x: this.m_position_X, y: this.m_position_Y, z: this.m_position_Z };
    }

    fn_applyIMU() {
        if (this.m_Mesh == null) return;

        this.v_q1.setFromAxisAngle(_yAxis, this.m_yaw);
        this.v_q2.setFromAxisAngle(_zAxis, this.m_pitch);
        this.v_q3.setFromAxisAngle(_xAxis, this.m_roll);

        this.v_qt.multiplyQuaternions(this.v_q1, this.v_q2).multiply(this.v_q3);

        this.m_Mesh.setRotationFromQuaternion(this.v_qt);

        const { x, y, z } = this.fn_translateXYZ();
        this.m_Mesh.position.set(x, y, z);
        this.m_Mesh.scale.x = this.m_scale.x;
        this.m_Mesh.scale.y = this.m_scale.y;
        this.m_Mesh.scale.z = this.m_scale.z;
        const v_len = this.m_cameras.length;

        for (let i = 0; i < v_len; ++i) {
            this.m_cameras[i].fn_applyCameraIMU(this.m_Mesh.position, this.v_qt.clone());
        }

        if (this.m_children.length > 0) this.fn_apply_attached_units(this.m_Mesh.position, this.v_qt.clone());
    }

    fn_setAnimate(p_animate) {
        this.m_animateFunction = p_animate;
    }

    fn_updateSimulationStep() {
        this.fn_applyIMU();
        if (this.m_animateFunction != null) {
            this.m_animateFunction();
        }
    }
}

export default SimObject;