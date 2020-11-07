/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   19 Sep 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */

class c_Camera
{

    // Camera Relative Rotation & position
    m_positionCamera_X   = 0;
    m_positionCamera_Y   = 0;
    m_positionCamera_Z   = 0;
    m_rollCamera         = 0;
    m_pitchCamera        = 0;
    m_yawCamera          = 0;
    
    m_tilteServoChannel  = undefined;
    m_rollServoChannel   = undefined;

    m_cameraThree;
    m_helperThree;
    m_ownerObject;
    
    m_OwnerRotationIndependent = false;
    m_VerticalStabilizer = false;
    m_HorizontalStabilizer = false;

    /**
     * 
     * @param {*} p_attachedObject 
     * @param {*} p_createHelper 
     * @param {boolean} p_ownerRotationIndependent camera is indepenent of object rotation. (default == true) @default false
     */
    constructor (p_attachedObject, p_createHelper, p_ownerRotationIndependent)
    {
        
        this.v_q1 = new THREE.Quaternion(); 
        this.v_q2 = new THREE.Quaternion();  
        this.v_q3 = new THREE.Quaternion(); 

        if (p_ownerRotationIndependent != null) 
        {
            this.m_OwnerRotationIndependent = p_ownerRotationIndependent;
        }

        this.fn_createCameraForObject (p_createHelper, p_attachedObject);
    }

    /**
     * 
     * @param {bool} p_all if true then other values are IGNORED
     * @param {bool} p_vertical  if true then camera vertical is World vertical direction.
     * @param {bool} p_horizontal if true then camera horizontal is World horizontal direction.
     */
    fn_setRotationIndependence (p_all, p_vertical, p_horizontal, p_tiltChannel, p_rollChannel)
    {
        
        this.m_OwnerRotationIndependent = p_all;
        
        if ((p_all == true) && ((p_horizontal == true) || (p_vertical == true)))
        {
            console.log ("WARNING: p_all if true then other values are IGNORED")
            return ;
        }
        this.m_VerticalStabilizer = p_vertical;
        this.m_HorizontalStabilizer = p_horizontal;

        this.m_tilteServoChannel = p_tiltChannel;
        this.m_rollServoChannel  = p_rollChannel;

    }

    /**
     * 
     * @param {boolean} p_createHelper create camera helper to view camera direction.
     * @param {c_Object} p_attachedObject c_Object based class.
     */
    fn_createCameraForObject (p_createHelper, p_attachedObject)
    {

        var v_camera = new THREE.PerspectiveCamera
        (   75,                                         // FOV
            1,                                          // Aspect Ratio
            0.1,                                        // Near Clipping Pane
            1000                                        // Far Clipping Pane
        );
        
        v_camera.userData.m_ownerObject = this;    
        this.m_cameraThree = v_camera;
        this.m_ownerObject = p_attachedObject;
        if (p_createHelper === true)
        {
            this.m_helperThree = new THREE.CameraHelper( v_camera );
        }
        
    }


    /**
     * Camera position relative to (0,0,0) of parent object.
     * @param {float} p_lat 
     * @param {float} p_lng 
     * @param {float} p_alt 
     * @param {float} p_roll 
     * @param {float} p_pitch 
     * @param {float} p_yaw 
     */
    fn_setCameraRelativePosition (p_lat, p_lng, p_alt, p_roll, p_pitch, p_yaw)
    {
        this.m_positionCamera_X   = p_lng;
        this.m_positionCamera_Y   = p_lat
        this.m_positionCamera_Z   = p_alt;
        this.m_rollCamera         = p_pitch;
        this.m_pitchCamera        = p_roll;
        this.m_yawCamera          = p_yaw - PI_div_2;
    }


    fn_setCameraDeltaOrientation (p_rollDelta, p_pitchDelta, p_yawDelta)
    {
        this.m_rollCamera         += p_pitchDelta;
        this.m_pitchCamera        += p_rollDelta;
        this.m_yawCamera          += p_yawDelta;
    }

    
    fn_setCameraOrientation (p_roll, p_pitch, p_yaw)
    {
        this.m_rollCamera         = p_roll;
        this.m_pitchCamera        = p_pitch;
        this.m_yawCamera          = p_yaw-PI_div_2;
    };


    fn_applyCameraIMU (p_position,v_vehicleOrientationQT)
    {
        const c_camera = this.m_cameraThree;
        
        if (c_camera != null)
        {

            if (this.m_OwnerRotationIndependent === true)
            {  // Camera rotation is absolute and independent of vehicle
                v_vehicleOrientationQT = new THREE.Quaternion();
            }
            
            //v_vehicleOrientationQT.setFromAxisAngle(_yAxis,  0);
            c_camera.setRotationFromQuaternion (v_vehicleOrientationQT);
            

            // Move camera to owner object (0,0,0) position.
            this.m_cameraThree.position.set(p_position.x, p_position.y, p_position.z);
            
            // Now move it relative to owner object position.
            c_camera.translateOnAxis(_xAxis,  this.m_positionCamera_Y);
            c_camera.translateOnAxis(_yAxis,  this.m_positionCamera_Z);
            c_camera.translateOnAxis(_zAxis, -this.m_positionCamera_X);
            
            // rotate camera relative to camera original position in a vehicle.
            var c_picthCaneller = 0;
            var c_rollCaneller = 0;
            var c_yawCaneller = 0;
              
            if (this.m_OwnerRotationIndependent !== true)
            {
                // stabilize camera
                if (this.m_HorizontalStabilizer === true)
                {
                    c_rollCaneller  = this.m_ownerObject.m_roll;
                    
                }   

                if (this.m_VerticalStabilizer === true)
                {
                    c_picthCaneller = -this.m_ownerObject.m_pitch;
                }   

                if (this.m_tilteServoChannel != null)
                {
                    c_picthCaneller -= getAngleOfPWM (90*DEG_2_RAD,-45*DEG_2_RAD,this.m_ownerObject.m_servoValues[this.m_tilteServoChannel]);

                }
            
                if (this.m_rollServoChannel != null)
                {
                    c_rollCaneller = getAngleOfPWM (90*DEG_2_RAD,-45*DEG_2_RAD,this.m_ownerObject.m_servoValues[this.m_rollServoChannel]);

                }
            }
            

            //var c = this.v_q1.setFromEuler(new THREE.Euler( this.m_rollCamera, this.m_pitchCamera,  this.m_yawCamera,'YZX' ));
            //v_vehicleOrientationQT.multiply(this.v_q1);
            this.v_q1.setFromAxisAngle(_yAxis,this.m_yawCamera + c_yawCaneller);
            this.v_q2.setFromAxisAngle(_zAxis,this.m_pitchCamera + c_rollCaneller);
            this.v_q3.setFromAxisAngle(_xAxis,this.m_rollCamera + c_picthCaneller );
            v_vehicleOrientationQT.multiply(this.v_q1).multiply(this.v_q3).multiply(this.v_q2);

            c_camera.setRotationFromQuaternion (v_vehicleOrientationQT);

            
            
        }
    };

}

