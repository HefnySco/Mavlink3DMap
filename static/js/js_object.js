/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   14 Oct 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */


/**
 * Represent core simulation object.
 * This is not a physics object.
 */
class c_Object {

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

    m_servoValues=[0,0,0,0,0,0];   
    m_startServoIndex=0;
    
    m_rcChannelsValues=[0,0,0,0,0,0];
    m_startRCChannelIndex=0;

    //m_tempPos = new THREE.Vector3();
    //m_tempQuat = new THREE.Quaternion();

    m_Mesh = null;
    m_type = FRAME_TYPE_UNKNOWN;
    m_animateFunction = null;


    m_trigger = new c_Trigger();

    constructor (p_name) {
        this.m_name = p_name;
        this.v_q1 = new THREE.Quaternion(); 
        this.v_q2 = new THREE.Quaternion();  
        this.v_q3 = new THREE.Quaternion(); 
        this.fn_setZeroPosition(0, 0, 0);
    }

    fn_setZeroPosition (p_lat, p_lng, p_alt) {
        this.m_positionZero_X = p_lat;
        this.m_positionZero_Y = p_lng;
        this.m_positionZero_Z = p_alt;
    }

    fn_setPosition (p_lat, p_lng, p_alt) {
        if (this.m_Mesh == null) 
            return;
        

        this.m_position_X = p_lat - this.m_positionZero_X;
        this.m_position_Y = p_alt - this.m_positionZero_Z;
        this.m_position_Z = p_lng - this.m_positionZero_Y;
    }

    fn_setRotation (p_roll, p_pitch, p_yaw) {
        this.m_roll = p_roll;
        this.m_pitch = p_pitch;
        this.m_yaw = p_yaw;
    }

    fn_setServosOutputs (p_startServoIndex, p_servosValues)
    {
        this.m_startServoIndex = p_startServoIndex;
        this.m_servoValues = p_servosValues;
    }
    
    fn_setRCChannels (p_startRCChannelIndex, p_rcChannelsValues)
    {
        this.m_startRCChannelIndex = p_startRCChannelIndex;
        this.m_rcChannelsValues = p_rcChannelsValues;
    }

    fn_castShadow (p_enable) 
    {
        this.m_Mesh.castShadow = p_enable;
    }

    fn_getMesh () 
    {
        return this.m_Mesh;
    }

    fn_getCamera () 
    {
        return this.m_cameras;
    }


    // obj - your object (THREE.Object3D or derived)
    // point - the point of rotation (THREE.Vector3)
    // axis - the axis of rotation (normalized THREE.Vector3)
    // theta - radian value of rotation
    // pointIsWorld - boolean indicating the point is in world coordinates (default = false)
    fn_rotateAboutPoint(obj, point, axis, theta, pointIsWorld)
    {
        pointIsWorld = (pointIsWorld === undefined)? false : pointIsWorld;

        if(pointIsWorld){
            obj.parent.localToWorld(obj.position); // compensate for world coordinate
        }

        obj.position.sub(point); // remove the offset
        obj.position.applyAxisAngle(axis, theta); // rotate the POSITION
        obj.position.add(point); // re-add the offset

        if(pointIsWorld){
            obj.parent.worldToLocal(obj.position); // undo world coordinates compensation
        }

        obj.rotateOnAxis(axis, theta); // rotate the OBJECT
    }

    /**
     * attached camera to object to be able to watch the object.
     * @param {*} p_all if true then other values are IGNORED
     * @param {*} p_vertical 
     * @param {*} p_horizontal  
     */
    fn_attachedCamera(p_all, p_vertical, p_horizontal)
    {
        var v_cam1 = new c_Camera(this, true);
        v_cam1.fn_setRotationIndependence (p_all, p_vertical, p_horizontal);
        var v_cam2 = new c_Camera(this, false, true);
        v_cam2.fn_setRotationIndependence (true);
        v_cam2.fn_setCameraRelativePosition(- 1.5, 0.0 , 1.5
            ,0.0 ,-0.5 ,0.0);

        this.m_cameras.push(v_cam1); 
        this.m_cameras.push(v_cam2);

        
    }


    fn_addMesh (p_customObject) {

        this.m_Mesh = p_customObject;
    }

    fn_createCustom (p_customObject, p_callbackfunc) {
    
        this.m_Mesh = new THREE.Group;
        this.m_Mesh.add(p_customObject);
        

        if (p_callbackfunc!= null) p_callbackfunc(this.m_Mesh);
    }


    
    fn_apply_attached_units(p_position,v_vehicleOrientationQT) 
    {

        
        const len = this.m_children.length;
        if (len <0) return ;

        for (var i=0; i<len; ++i)
        {
            //v_vehicleOrientationQT = new THREE.Quaternion();
            let obj = this.m_children[i];
            const motor = obj.motor;
            const offset = obj.offset;
            const ch = obj.channel;
            
            // motor.setRotationFromQuaternion(v_vehicleOrientationQT);
            // //var c = motor.geometry.boundingSphere.center.clone();
            
            var angle = getAngleOfPWM (90*DEG_2_RAD,0*DEG_2_RAD,parseInt(this.m_servoValues[parseInt(ch)]), 1100, 800);

            this.v_q1.setFromAxisAngle(_yAxis,0);
            this.v_q2.setFromAxisAngle(_zAxis, 0 );
            this.v_q3.setFromAxisAngle(_xAxis, angle);
            var v_qt = new THREE.Quaternion();
            v_qt.multiply(this.v_q1).multiply(this.v_q2).multiply(this.v_q3);
            motor.setRotationFromQuaternion(v_qt);
            
        }

    }


    /**
     * apply location changes
     */
    fn_applyIMU () {
        if (this.m_Mesh == null) 
            return;
        

        this.v_q1.setFromAxisAngle(_yAxis, this.m_yaw);

        this.v_q2.setFromAxisAngle(_zAxis, this.m_pitch);

        this.v_q3.setFromAxisAngle(_xAxis, this.m_roll);

        var v_qt = new THREE.Quaternion();
        v_qt.multiply(this.v_q1).multiply(this.v_q2).multiply(this.v_q3);

        this.m_Mesh.setRotationFromQuaternion(v_qt);

        
        this.m_Mesh.position.set(this.m_position_X, this.m_position_Y, this.m_position_Z);


        let v_len = this.m_cameras.length;

        for (var i = 0; i < v_len; ++ i) {
            this.m_cameras[i].fn_applyCameraIMU(this.m_Mesh.position, v_qt.clone());
        }

        if (this.m_children.length>0)  this.fn_apply_attached_units(this.m_Mesh.position, v_qt.clone());
        
    };

    /*
    // Attach external animation function.
    */
    fn_setAnimate (p_animate) {
        this.m_animateFunction = p_animate;
    }

    fn_updateSimulationStep () {

        this.fn_applyIMU();
        if (this.m_animateFunction != null) {
            this.m_animateFunction();
        }
    }




}