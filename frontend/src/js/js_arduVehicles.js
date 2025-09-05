/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   26 OCT 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */

import * as THREE from 'three';
import { c_Camera } from './js_camera.js'; 
import c_Vehicle from './js_vehicle.js'

const FRAME_TYPE_PLUS = 0;
const FRAME_TYPE_PLANE = 1;
const FRAME_TYPE_X = 2;
const FRAME_TYPE_CUSTOM = 998;
const FRAME_TYPE_UNKNOWN = 999;


class c_ArduVehicles extends c_Vehicle {


    constructor (p_name)
    {
        super(p_name);

        const v = new URLSearchParams(window.location.search);
        this.m_vtol = (v.get("vtol") != null);
    }


    fn_createVehicle (p_classType, p_attachCamera, p_customObject, p_callbackfunc, p_addtoscene) {
        switch (p_classType) {
            case FRAME_TYPE_X: this.m_type = FRAME_TYPE_X;
                this.fn_createDroneX(p_attachCamera, p_callbackfunc, p_addtoscene);
                break;

            case FRAME_TYPE_PLUS: this.m_type = FRAME_TYPE_PLUS;
                this.fn_createDronePlus(p_attachCamera, p_callbackfunc, p_addtoscene);
                break;

            case FRAME_TYPE_PLANE: this.m_type = FRAME_TYPE_PLANE;
                if (this.m_vtol !== true)
                {
                    this.fn_createDronePlane(p_attachCamera, p_callbackfunc, p_addtoscene);
                }
                else
                {
                    this.fn_createDroneVTOLPlane(p_attachCamera, p_callbackfunc, p_addtoscene);
                }
                break;

            case FRAME_TYPE_PLANE: this.m_type = FRAME_TYPE_CUSTOM;
                this.fn_createCustom(p_customObject, p_callbackfunc);
                break;

            default: this.m_type = FRAME_TYPE_UNKNOWN;
                this.fn_createUnknown(p_attachCamera, p_callbackfunc);
                break;
        }
    }

    fn_createDroneX (p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        var Me = this;
        c_loader.load('/public/models/vehicles/quadX.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            obj.rotateOnAxis(_xAxis,90);
            */
            
            // extract object from Group
           
            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                var v_cam1 = new c_Camera(Me, true);
                v_cam1.fn_setRotationIndependence (false, true, true);
                // facing down with stabilizer
                v_cam1.fn_setCameraRelativePosition(0.0,  -0.1 ,0.0,
                    0.0, -1.57 ,0.0);
                var v_cam2 = new c_Camera(Me, false, true);
                v_cam2.fn_setRotationIndependence (true);
                v_cam2.fn_setCameraRelativePosition(-1.5, 0.0 , 1.5
                    ,0.0 ,-0.5 ,0.0);

                Me.m_cameras.push(v_cam1); 
                Me.m_cameras.push(v_cam2);
            }

            Me.fn_createCustom (p_obj ,function (p_mesh)
            {
                p_callbackfunc(p_mesh);
            });
        });
    }

    fn_createDronePlus (p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        var Me = this;
        c_loader.load('./models/vehicles/quadplus.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            obj.rotateOnAxis(_xAxis,90);
            */
           
           // extract object from Group
           
           if (p_attachCamera === true) {
            //this.fn_attachedCamera(false,false,false);
            var v_cam1 = new c_Camera(Me, true);
            v_cam1.fn_setRotationIndependence (false, false, false);
            // facing down with stabilizer
            v_cam1.fn_setCameraRelativePosition(0.0,  -0.1 ,0.0,
                0.0, -1.57 ,0.0);
            var v_cam2 = new c_Camera(Me, false, true);
            v_cam2.fn_setRotationIndependence (true);
            v_cam2.fn_setCameraRelativePosition(- 1.5, 0.0 , 1.5
                ,0.0 ,-0.5 ,0.0);

            Me.m_cameras.push(v_cam1); 
            Me.m_cameras.push(v_cam2);
            }

           Me.fn_createCustom (p_obj ,p_callbackfunc);
        });
    }

    fn_createDronePlane (p_attachCamera, p_callbackfunc) {
        const c_loader = new THREE.ObjectLoader();
        var Me = this;
        c_loader.load('./models/vehicles/plane_model1.json', function (p_obj) {
            /*
            Adjust relative object position & orientation here if needed.
            obj.rotateOnAxis(_xAxis,90);
            */

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                var v_cam1 = new c_Camera(Me, true);
                // 6 & 7 are servo channels that is used by gimbal... you can use them to get real feedback
                //v_cam1.fn_setRotationIndependence (false, false, false, 6, 7);
                v_cam1.fn_setRotationIndependence (false, false, false, null, null);
                // facing down with stabilizer
                v_cam1.fn_setCameraRelativePosition(0.4,  0.0 ,0.0,
                    0.0, 0.0 ,0.0);
                var v_cam2 = new c_Camera(Me, false, true);
                v_cam2.fn_setRotationIndependence (true);
                v_cam2.fn_setCameraRelativePosition(-1.5, 0.0 , 1.5
                    ,0.0 ,-0.5 ,0.0);

                Me.m_cameras.push(v_cam1); 
                Me.m_cameras.push(v_cam2);
            }

            Me.fn_createCustom (p_obj ,p_callbackfunc);
        });
    }


    fn_createDroneVTOLPlane (p_attachCamera, p_callbackfunc, p_addtoscene) {
        const c_loader = new THREE.ObjectLoader();
        var Me = this;
        c_loader.load('./models/vehicles/vtol3Motor/model.json', function (p_obj) {
            
            /*
            Adjust relative object position & orientation here if needed.
            obj.rotateOnAxis(_xAxis,90);
            */
            
            const c_ServoChannels = [10,11,12];
            const c_MotorNumber = [1,2,3];
            //const c_MotorOffset = [[-40,-45,0], [40,-45,0], [0,100,0]];
            for (var x=0; x<c_MotorNumber.length;++x)
            {
               var label = "M" + (x+1).toString();
               var M = p_obj.getObjectByName(label);
               if (M != null)
               {
                    var pivot = new THREE.Group();
                    pivot.add (M);
                    p_addtoscene(pivot);
                    p_obj.add (pivot);
                    
                    var _offset = new THREE.Vector3();
			        M.geometry.computeBoundingBox();
                    var center_motor = M.geometry.boundingBox.getCenter(_offset).clone();
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
                       "channel" : c_ServoChannels[x]-9,  // servos are from number 9
                       "offset" : M.geometry.boundingSphere.center.clone(),
                       
                    });
                }
            }

            if (p_attachCamera === true) {
                //this.fn_attachedCamera(false,false,false);
                var v_cam1 = new c_Camera(Me, true);
                // channel 6 Servo
                //v_cam1.fn_setRotationIndependence (false, false, false, null, null);
                //v_cam1.m_cameraThree.setRotationFromQuaternion(p_obj.quaternion);
                //v_cam1.fn_setRotationIndependence (true);
                // facing down with stabilizer
                v_cam1.fn_setCameraRelativePosition(1.0,  0.0 ,0.0,
                   0.0, 0.0, 0.0);
                var v_cam2 = new c_Camera(Me, false, true);
                v_cam2.fn_setRotationIndependence (true);
                v_cam2.fn_setCameraRelativePosition(-1.5, 0.0 , 1.5
                    ,0.0 ,-0.5 ,0.0);

                Me.m_cameras.push(v_cam1); 
                Me.m_cameras.push(v_cam2);
            }

            Me.fn_createCustom (p_obj ,function (p_mesh)
            {
                p_callbackfunc(p_obj);
            });
        });
    }


    fn_createUnknown (p_attachCamera, p_callbackfunc) {
        var v_Object = function () { // Run the Group constructor with the given arguments
            THREE.Group.apply(this, arguments);

            let p1 = fn_drawDronePropeller(0xf80008, 0.0, 0.0, 0.0, 0.3);
            p1.m_tag = this;
            this.add(p1);
        };

        v_Object.prototype = Object.create(THREE.Group.prototype);
        v_Object.prototype.constructor = v_Object;
        this.m_Mesh = new v_Object();

        if (p_callbackfunc!= null) p_callbackfunc(this.m_Mesh);
    }

    /**
     * Apply actions depends on RCChannels
     */
    fn_applyRCChannels()
    {

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



    fn_updateSimulationStep () {
        this.fn_applyRCChannels();
        this.fn_applyServos();
        super.fn_updateSimulationStep();
    }

}


export { c_ArduVehicles };