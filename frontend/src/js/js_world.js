import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import C_View from './js_view';

const STATE = { DISABLE_DEACTIVATION: 4 };
const FLAGS = { CF_KINEMATIC_OBJECT: 2 };




class C_World {
    #m_robots = {};

    constructor(p_XZero, p_YZero) {

        if (p_XZero == null) p_XZero = 0;
        if (p_YZero == null) p_YZero = 0;

        this.v_scene = null

        this.v_clock = null;
        this.v_water = null;
        this.v_selectedView = null;
        this.v_collisionConfiguration;
        this.v_dispatcher;
        this.v_broadphase;
        this.v_solver;
        this.v_physicsWorld;
        this.v_rigidBodies = [];
        this.v_tmpTrans = null;
        this.v_XZero = p_XZero;
        this.v_YZero = p_YZero;
        this.v_height3D = 0;

        this.v_drone = {};
        this.#m_robots = {};
        this.v_cameras = [];
        this.v_views = [];

        this.v_needUpdate = false;
        this.canvas = null;
        this.stats = null;
        this.renderer = null;

        this.raycaster = new THREE.Raycaster();
        this.mouseCoords = new THREE.Vector2();
        this.mouse = new THREE.Vector2(1, 1);

        this.pos = new THREE.Vector3();
        this.quat = new THREE.Quaternion();

        this.v_convexBreaker = null;
        this.fractureImpulse = 15; // force to break object.

        this.v_impactPoint = new THREE.Vector3();
        this.v_impactNormal = new THREE.Vector3();

        this.v_objectsToRemove = [];

        this.m_objects_attached_cameras = [];
        this.m_global_camera_helper = true;
        for (let i = 0; i < 500; i++) {
            this.v_objectsToRemove[i] = null;
        }

        this.v_numObjectsToRemove = 0;

        // Replace jQuery with vanilla JavaScript
        const helpDlg = document.createElement('div');
        helpDlg.id = 'help_dlg';
        helpDlg.innerHTML = `
            <ul>
                <li>F1: Help Toggle</li>
                <li>'P , O' Switch Cameras</li>
                <li>'W A S D Q E' Change Camera View for Vehicles</li>
                <li>'L' Goto First Drone</li>
                <li>'T' Toggle Camera Trace
                <li>'1-9' Goto Drone by Index</li>
                <li>'R' Reset Camera View</li>
            </ul>
        `;
        document.getElementById('mav3dmap').appendChild(helpDlg);
        helpDlg.style.display = 'none'; // Initially hidden

        this.fn_animate = this.fn_animate.bind(this);

    }

    fn_addRobot(key, value) {
        if (!key) return;
        this.#m_robots[key] = value;
    }

    fn_getRobot(key) {
        return this.#m_robots[key];
    }

    fn_deleteRobot(key) {
        delete this.#m_robots[key];
    }

    /*
     * Add cameras of a vehicle to all available views.
     */
    fn_registerCamerasOfObject(p_vehicle) {
        let cameras = p_vehicle.fn_getCamera();
        for (let i = 0; i < cameras.length; ++i) {
            let v_camera = cameras[i];

            this.m_objects_attached_cameras.push(v_camera);

            // add three.js camera to Three.scene
            this.v_scene.add(v_camera.m_cameraThree);

            if (v_camera.m_helperThree != null) {
                // add three.js helper to Three.scene
                this.v_scene.add(v_camera.m_helperThree);
            }
        }
    };

    fn_createBall(p_id, p_x, p_y, p_radius) {
        let mass = 1;

        // threeJS Section
        var ball = new THREE.Mesh(new THREE.SphereBufferGeometry(p_radius), new THREE.MeshPhongMaterial({ color: 0xa0afa4 }));
        ball.name = p_id;
        ball.position.set(p_x, p_radius + 5, p_y);
        ball.castShadow = false;
        ball.receiveShadow = false;

        const c_body = c_PhysicsObject.fn_createBall(p_radius, mass, ball); // Placeholder: c_PhysicsObject not provided
        c_body.setLinearVelocity(new Ammo.btVector3(-1, 0, 0));

        ball.userData.m_physicsBody = c_body;
        this.v_physicsWorld.addRigidBody(c_body);

        if (mass > 0) {
            this.v_rigidBodies.push(ball);
            c_body.setActivationState(STATE.DISABLE_DEACTIVATION);
        }

        this.v_scene.add(ball);
    };

    /*
    * Send event to selected view to handle keydown logic.
    */
    fn_onKeyDown(event) {
        if (event.key == '-') {
            const vehicleIds = Object.keys(this.v_drone);

            for (const id of vehicleIds) {
                const vehicle = this.v_drone[id];
                vehicle.fn_changeScaleByDelta(-2, -2, -2);
            }
        }
        else if ((event.key == '+') || (event.key == '=')) {
            const vehicleIds = Object.keys(this.v_drone);

            for (const id of vehicleIds) {
                const vehicle = this.v_drone[id];
                vehicle.fn_changeScaleByDelta(+2, +2, +2);
            }
        }
        // Handle number keys 1-9 (keyCodes 49 to 57)
        else if (event.keyCode >= 49 && event.keyCode <= 57) {
            const drone_index = event.keyCode - 49; // Convert keyCode to 0-based index (49='1', 50='2', etc.)
            const vehicleIds = Object.keys(this.v_drone);
            if (drone_index >= vehicleIds.length) {
                console.warn(`No drone found at index ${drone_index}.`);
                return;
            }

            this.v_selectedView.fn_selectWorldCamera();
            const vehicle = this.v_drone[vehicleIds[drone_index]];
            if (!vehicle) {
                console.warn(`Drone at index ${drone_index} is undefined.`);
                return;
            }

            // Get the vehicle's position
            const { x, y, z } = vehicle.fn_translateXYZ();

            // Position the main camera above the vehicle (e.g., 10 units above)
            const cameraHeight = 10; // Adjust this value as needed
            this.v_selectedView.m_main_camera.position.set(x, y + cameraHeight, z);

            // Make the camera look at the vehicle's position
            this.v_selectedView.m_main_camera.lookAt(new THREE.Vector3(x, y, z));

            // Update OrbitControls to focus on the vehicle
            if (this.v_selectedView.m_main_camera.m_controls) {
                this.v_selectedView.m_main_camera.m_controls.target.set(x, y, z);
                this.v_selectedView.m_main_camera.m_controls.update();
            }
        }
        else if (event.keyCode === 76) { /* L */
            const vehicleIds = Object.keys(this.v_drone);

            for (const id of vehicleIds) {
                const vehicle = this.v_drone[id];
                vehicle.fn_toggleLabel();
            }
        }
        else if (event.keyCode === 84) { /* T */
            this.m_global_camera_helper = !this.m_global_camera_helper;


            const len = this.m_objects_attached_cameras.length;
            for (let drone_index = 0; drone_index < len; ++drone_index) {
                this.fn_setCameraHelperEnabled(drone_index, this.m_global_camera_helper);
            }
        }

        if (this.v_selectedView == null || this.v_selectedView.fn_handleCameraSwitch == null) return;
        this.v_selectedView.fn_handleCameraSwitch(event);


    };


    fn_setCameraHelperEnabled(drone_index, enable) {
        if (this.m_objects_attached_cameras[drone_index] && this.m_objects_attached_cameras[drone_index].m_cameraThree != null) {
            this.m_objects_attached_cameras[drone_index].fn_setCameraHelperEnabled(enable);
        }
    }

    fn_addCanvas(p_canvas, isStreamable = false) {
        const c_view = new C_View(this, p_canvas, this.v_XZero, this.v_YZero, isStreamable);
        this.v_views.push(c_view);
        this.v_selectedView = c_view;
    };

    removeDebris(object) {
        this.v_scene.remove(object);
        this.v_physicsWorld.removeRigidBody(object.userData.m_physicsBody);
    }

    createRandomColor() {
        return Math.floor(Math.random() * (1 << 24));
    }

    /**
     * Initialize Physics Ammo.js
     */
    fn_initPhysics() {
        import('ammo').then(() => {

            v_tmpTrans = new Ammo.btTransform();
            let v_collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            v_dispatcher = new Ammo.btCollisionDispatcher(v_collisionConfiguration);
            v_broadphase = new Ammo.btDbvtBroadphase();
            v_solver = new Ammo.btSequentialImpulseConstraintSolver();
            this.v_convexBreaker = new ConvexObjectBreaker(); // Placeholder: ConvexObjectBreaker not provided
            this.v_physicsWorld = new Ammo.btDiscreteDynamicsWorld(v_dispatcher, v_broadphase, v_solver, v_collisionConfiguration);
            this.v_physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));
            // The Ammo object is now available globally after the file is loaded
            // You can access it like this: window.Ammo or just Ammo
            console.log("Ammo.js loaded successfully!");

        });
    }

    fn_initTHREE(p_width, p_height) {
        if (p_width == null) p_width = 640;
        if (p_height == null) p_height = 640;

        this.v_clock = new THREE.Clock();
        this.v_height3D = 0;

        this.v_scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            logarithmicDepthBuffer: true,
            antialias: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(p_width, p_height);
        this.renderer.setClearColor('#337ab7');
        this.renderer.shadowMap.enabled = false;

        this.fn_onKeyDown = this.fn_onKeyDown.bind(this);
        document.addEventListener('keydown', this.fn_onKeyDown, false);
    };

    m_scene_env(p_XZero, p_YZero) {
        // Placeholder: Implement or import fn_initDesertWorld
        console.warn('m_scene_env not implemented; define fn_initDesertWorld');
    };

    /*
     * Resize THREE based on canvas scale.
     */
    fn_resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
        return needResize;
    };

    /*
     * Update & run simulator
     */
    fn_animate(time) {
        let c_keys = Object.keys(this.v_drone);
        let c_key_length = c_keys.length;
        for (let i = 0; i < c_key_length; ++i) {
            this.v_drone[c_keys[i]].fn_updateSimulationStep();
        }

        c_keys = Object.keys(this.#m_robots);
        c_key_length = c_keys.length;

        for (let i = 0; i < c_key_length; ++i) {
            this.#m_robots[c_keys[i]].fn_updateSimulationStep();
        }

        this.v_views.forEach(view => {
            view.fn_render();
        });

        if (this.v_water != null) this.v_water.material.uniforms['time'].value += 1.0 / 60.0;

        let deltaTime = this.v_clock.getDelta();
        this.fn_updatePhysics(deltaTime);

        requestAnimationFrame(this.fn_animate);
    };

    fn_updatePhysics(p_deltaTime) {
        if (!this.v_physicsWorld) return;
        this.v_physicsWorld.stepSimulation(p_deltaTime, 10);

        for (let i = 0; i < this.v_rigidBodies.length; i++) {
            let v_objThree = this.v_rigidBodies[i];
            let v_physicsObject = v_objThree.userData.m_physicsBody;
            let ms = v_physicsObject.getMotionState();
            if (ms) {
                ms.getWorldTransform(v_tmpTrans);
                let p = v_tmpTrans.getOrigin();
                let q = v_tmpTrans.getRotation();
                v_objThree.position.set(p.x(), p.y(), p.z());
                v_objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
                v_objThree.userData.collided = false;
            }
        }

        this.detectCollision();
    };

    /**
     * Detect collision between Ammo objects
     */
    detectCollision() {
        let numManifolds = v_dispatcher.getNumManifolds();

        for (let i = 0; i < numManifolds; i++) {
            let contactManifold = v_dispatcher.getManifoldByIndexInternal(i);
            const rb0 = Ammo.castObject(contactManifold.getBody0(), Ammo.btRigidBody);
            const rb1 = Ammo.castObject(contactManifold.getBody1(), Ammo.btRigidBody);

            const threeObject0 = Ammo.castObject(rb0.getUserPointer(), Ammo.btVector3).threeObject;
            const threeObject1 = Ammo.castObject(rb1.getUserPointer(), Ammo.btVector3).threeObject;

            if (!threeObject0 && !threeObject1) {
                continue;
            }

            const userData0 = threeObject0 ? threeObject0.userData : null;
            const userData1 = threeObject1 ? threeObject1.userData : null;

            const breakable0 = userData0 ? userData0.breakable : false;
            const breakable1 = userData1 ? userData1.breakable : false;

            const collided0 = userData0 ? userData0.collided : false;
            const collided1 = userData1 ? userData1.collided : false;

            if ((!breakable0 && !breakable1) || (collided0 && collided1)) {
                continue;
            }

            let contact = false;
            let maxImpulse = 0;
            const numContacts = contactManifold.getNumContacts();

            for (let j = 0; j < numContacts; j++) {
                let contactPoint = contactManifold.getContactPoint(j);

                if (contactPoint.getDistance() > 0.0) continue;

                contact = true;
                const impulse = contactPoint.getAppliedImpulse();

                if (impulse > maxImpulse) {
                    maxImpulse = impulse;
                    const pos = contactPoint.get_m_positionWorldOnB();
                    const normal = contactPoint.get_m_normalWorldOnB();
                    v_impactPoint.set(pos.x(), pos.y(), pos.z());
                    v_impactNormal.set(normal.x(), normal.y(), normal.z());
                }

                break;
            }

            if (!contact) continue;

            var rb;
            var userData;
            var threeObject;
            if (breakable0 && !collided0 && maxImpulse > fractureImpulse) {
                rb = rb0;
                userData = userData0;
                threeObject = threeObject0;
            } else if (breakable1 && !collided1 && maxImpulse > fractureImpulse) {
                rb = rb1;
                userData = userData1;
                threeObject = threeObject1;
            } else {
                continue;
            }

            const debris = this.v_convexBreaker.subdivideByImpact(threeObject, v_impactPoint, v_impactNormal, 1, 2, 1.5);

            const numObjects = debris.length;
            for (let j = 0; j < numObjects; j++) {
                const vel = rb.getLinearVelocity();
                const angVel = rb.getAngularVelocity();
                const fragment = debris[j];
                fragment.userData.velocity.set(vel.x(), vel.y(), vel.z());
                fragment.userData.angularVelocity.set(angVel.x(), angVel.y(), angVel.z());

                const v_body = c_PhysicObject.fn_createDebrisFromBreakableObject(fragment); // Placeholder: c_PhysicsObject not provided
                this.v_rigidBodies.push(fragment);
                this.v_physicsWorld.addRigidBody(v_body);
                this.v_rigidBodies.push(fragment);
                this.v_scene.add(debris[j]);
            }

            v_objectsToRemove[v_numObjectsToRemove++] = threeObject;
            userData.collided = true;

            for (let i = 0; i < v_numObjectsToRemove; i++) {
                const v_obj = v_objectsToRemove[i].userData.m_removeMe;
                if (v_obj != null) {
                    this.v_scene.remove(v_obj);
                }
                removeDebris(v_objectsToRemove[i]);
            }

            v_numObjectsToRemove = 0;
        }
    }
};

export { C_World };