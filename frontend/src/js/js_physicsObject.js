/* ********************************************************************************
*   M A V L I N K 3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   14 Oct 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */
import SimObject from './js_object.js';

class c_PhysicsObject extends SimObject {



    static v_tempBtVec3_1;

    static _fn_createConvexHullPhysicsShape( coords ) {

        var shape = new Ammo.btConvexHullShape();

        for ( var i = 0, il = coords.length; i < il; i += 3 ) {
            if (c_PhysicsObject.v_tempBtVec3_1 == null) c_PhysicsObject.v_tempBtVec3_1 = new Ammo.btVector3( 0, 0, 0 );
            c_PhysicsObject.v_tempBtVec3_1.setValue( coords[ i ], coords[ i + 1 ], coords[ i + 2 ] );
            var lastOne = ( i >= ( il - 3 ) );
            shape.addPoint( c_PhysicsObject.v_tempBtVec3_1, lastOne );

        }

        return shape;
    }
    

    static fn_createRigidBody (p_mass, p_margin, p_position, p_quaternion, p_ammoShape)
    {
        
        p_ammoShape.setMargin( p_margin );

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3( p_position.x, p_position.y, p_position.z ) );
        transform.setRotation( new Ammo.btQuaternion( p_quaternion.x, p_quaternion.y, p_quaternion.z, p_quaternion.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );

        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        p_ammoShape.calculateLocalInertia( p_mass, localInertia );

        const rbInfo = new Ammo.btRigidBodyConstructionInfo( p_mass, motionState, p_ammoShape, localInertia );
        
        const v_body = new Ammo.btRigidBody( rbInfo );
        
        return v_body;
    }
   

    /**
     * Creates breaks for a THREE.object.
     * It takes an object and then creates "ConvexHullPhysicsShape" that represent it and can be break into parts.
     * Breaks are connected to AMMO RigidBody.
     * @param {THREE.Object} p_threeObject 
     */
    static fn_createDebrisFromBreakableObject( p_threeObject ) {

        p_threeObject.castShadow = true;
        p_threeObject.receiveShadow = true;

        
        var v_ammoShape = c_PhysicsObject._fn_createConvexHullPhysicsShape( p_threeObject.geometry.attributes.position.array);
        const v_margin =0.01;

        const v_body = c_PhysicsObject.fn_createRigidBody(  p_threeObject.userData.mass, v_margin, p_threeObject.position, p_threeObject.quaternion, v_ammoShape);

        const vel = p_threeObject.userData.velocity ;
        const angVel = p_threeObject.userData.angularVelocity ;

        if ( vel ) {

            v_body.setLinearVelocity( new Ammo.btVector3( vel.x, vel.y, vel.z ) );
        }

        if ( angVel ) {

            v_body.setAngularVelocity( new Ammo.btVector3( angVel.x, angVel.y, angVel.z ) );
        }

        // Set pointer back to the three object only in the debris objects
        const btVecUserData = new Ammo.btVector3( 1, 0, 0 );
        btVecUserData.threeObject = p_threeObject;
        v_body.setUserPointer( btVecUserData );

        p_threeObject.userData.m_physicsBody = v_body;
        p_threeObject.userData.collided = v_body;

        return v_body;
    }


    static fn_createBox (p_mass, p_threeObject)
    {
        const v_ammoShape = new Ammo.btBoxShape( new Ammo.btVector3( p_threeObject.scale.x * 0.5, p_threeObject.scale.y * 0.5, p_threeObject.scale.z * 0.5) );
        const v_margin = 0.05;

        const v_body = c_PhysicsObject.fn_createRigidBody (p_mass, v_margin, p_threeObject.position, p_threeObject.quaternion, v_ammoShape);
        v_body.setFriction(1);
        v_body.setRollingFriction(0.1);
        
        p_threeObject.userData.m_physicsBody = v_body;
		p_threeObject.userData.collided = v_body;
        //v_body.setLinearVelocity(new Ammo.btVector3(-5,0,0));
        //body.setActivationState( STATE.DISABLE_DEACTIVATION );
        //body.setCollisionFlags( FLAGS.CF_KINEMATIC_OBJECT );
        return v_body;
    }


    static fn_createBall (p_radius, p_mass, p_threeObject)
    {
        
        const v_ammoShape = new Ammo.btSphereShape( p_radius );
        const v_margin = 0.05;

        const v_body = c_PhysicsObject.fn_createRigidBody (p_mass, v_margin, p_threeObject.position, p_threeObject.quaternion, v_ammoShape);

        v_body.setFriction(1);
        v_body.setRollingFriction(1);
        
        p_threeObject.userData.m_physicsBody = v_body;
		p_threeObject.userData.collided = v_body;
        //body.setActivationState( STATE.DISABLE_DEACTIVATION );
        //body.setCollisionFlags( FLAGS.CF_KINEMATIC_OBJECT );
        return v_body;
        
    }


    

    


}