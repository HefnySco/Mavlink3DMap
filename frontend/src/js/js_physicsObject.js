/* ********************************************************************************
*   M A V L I N K  3 D - M A P        JAVASCRIPT  LIB
*   
*   Author: Mohammad S. Hefny
*
*   Date:   14 Oct 2020
*
*********************************************************************************** */


/*jshint esversion: 6 */
import SimObject from './js_object.js';

export default class c_PhysicsObject extends SimObject {



    static v_tempBtVec3_1;

    static _fn_createConvexHullPhysicsShape( coords ) {
        return null;
    }
    

    static fn_createRigidBody (p_mass, p_margin, p_position, p_quaternion, p_ammoShape)
    {
        return null;
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

        p_threeObject.userData.m_physicsBody = null;
        p_threeObject.userData.collided = false;
        return null;
    }


    static fn_createBox (p_mass, p_threeObject)
    {
        p_threeObject.userData.m_physicsBody = null;
		p_threeObject.userData.collided = false;
        return null;
    }


    static fn_createBall (p_radius, p_mass, p_threeObject)
    {
        p_threeObject.userData.m_physicsBody = null;
		p_threeObject.userData.collided = false;
        return null;
    }


    

    


}