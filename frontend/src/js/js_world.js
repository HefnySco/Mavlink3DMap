import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


const STATE = { DISABLE_DEACTIVATION: 4 };
const FLAGS = { CF_KINEMATIC_OBJECT: 2 };

// Stub for downloadImage function (used in onMouseDoubleClick)
function downloadImage(dataURL, filename) {
    console.warn(`downloadImage not implemented: would save ${filename} from ${dataURL}`);
    // Implement if needed: e.g., create a link element to trigger download
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.click();
}

var C_World = function (p_XZero, p_YZero) {
    if (p_XZero == null) p_XZero = 0;
    if (p_YZero == null) p_YZero = 0;

    var Me = this;
    var v_clock;
    var v_water = null;
    var v_selectedView = null;
    var v_collisionConfiguration;
    var v_dispatcher;
    var v_broadphase;
    var v_solver;
    this.v_physicsWorld;
    this.v_rigidBodies = [];
    var v_tmpTrans = null;
    var v_XZero = p_XZero;
    var v_YZero = p_YZero;

    this.v_drone = {};
    this.v_robots = {};
    this.v_cameras = [];
    this.v_views = [];

    this.v_needUpdate = false;
    this.canvas;
    this.stats;
    this.camera;
    this.renderer;
    var raycaster = new THREE.Raycaster();
    var mouseCoords = new THREE.Vector2();
    this.mouse = new THREE.Vector2(1, 1);
    var pos = new THREE.Vector3();
    var quat = new THREE.Quaternion();
    var v_eventMouseClick;
    this.v_convexBreaker;
    const fractureImpulse = 15; // force to break object.

    const v_impactPoint = new THREE.Vector3();
    const v_impactNormal = new THREE.Vector3();

    const v_objectsToRemove = [];

    for (let i = 0; i < 500; i++) {
        v_objectsToRemove[i] = null;
    }

    var v_numObjectsToRemove = 0;

    // Replace jQuery with vanilla JavaScript
    const helpDlg = document.createElement('div');
    helpDlg.id = 'help_dlg';
    helpDlg.innerHTML = `
        <ul>
            <li>F1: Help Toggle</li>
            <li>'P , O' Switch Cameras</li>
            <li>'W A S D Q E' Change Camera View for Vehicles</li>
            <li>'R' Reset Camera View</li>
        </ul>
    `;
    document.getElementById('mav3dmap').appendChild(helpDlg);
    helpDlg.style.display = 'none'; // Initially hidden

    /*
     * Add cameras of a vehicle to all available views.
     */
    this.fn_registerCamerasOfObject = function fn_registerCamerasOfObject(p_vehicle) {
        var cameras = p_vehicle.fn_getCamera();
        for (var i = 0; i < cameras.length; ++i) {
            let v_camera = cameras[i];
            for (var j = 0; j < Me.v_views.length; ++j) {
                Me.v_views[j].v_localCameras.push(v_camera);
            }
            Me.v_scene.add(v_camera.m_cameraThree);
            if (v_camera.m_helperThree != null) {
                Me.v_scene.add(v_camera.m_helperThree);
            }
        }
    };

    var fn_createBall = function (p_id, p_x, p_y, p_radius) {
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
        Me.v_physicsWorld.addRigidBody(c_body);

        if (mass > 0) {
            Me.v_rigidBodies.push(ball);
            c_body.setActivationState(STATE.DISABLE_DEACTIVATION);
        }

        Me.v_scene.add(ball);
    };

    /*
     * Send event to selected view to handle keydown logic.
     */
    var onKeyDown = function onKeyDown(event) {
        if (v_selectedView == null || v_selectedView.fn_handleCameraSwitch == null) return;
        v_selectedView.fn_handleCameraSwitch(event);
    };

    function C_View(p_canvas, p_XZero, p_YZero) {
        var v_myView = this;
        var v_droneIndex = 0;
        this.v_localCameras = [];
        var v_localActiveCamera = null;
        p_canvas.width = p_canvas.clientWidth * window.devicePixelRatio;
        p_canvas.height = p_canvas.clientHeight * window.devicePixelRatio;

        var v_context = p_canvas.getContext('2d');

        var v_camera = new THREE.PerspectiveCamera(
            75, // FOV
            p_canvas.width / p_canvas.height, // Aspect Ratio
            0.1, // Near Clipping Plane
            5000 // Far Clipping Plane
        );

        v_localActiveCamera = v_camera;
        v_myView.v_localCameras.push(v_camera);

        v_camera.position.set(5, 5, 0);
        v_camera.lookAt(new THREE.Vector3(p_XZero + 0, 0, p_YZero + 0));

        v_camera.m_controls = new OrbitControls(v_camera, p_canvas);

        var onMouseDown = function onMouseDown(event) {
            event.preventDefault();
            v_eventMouseClick = event;
            v_selectedView = v_myView;
        };

        var onMouseDoubleClick = function onMouseDoubleClick(event) {
            event.preventDefault();
            var dataURL = event.currentTarget.toDataURL();
            var v_image_counter = new Date();
            downloadImage(dataURL, 'image' + v_image_counter.getSeconds() + '_' + v_image_counter.getMilliseconds() + '.png');
        };

        p_canvas.addEventListener('click', onMouseDown, false);
        p_canvas.addEventListener('dblclick', onMouseDoubleClick, false);

        /*
         * Resize THREE based on canvas scale.
         */
        var fn_resizeRendererToDisplaySize = function fn_resizeRendererToDisplaySize(renderer) {
            const c_canvas = Me.renderer.domElement;
            const width = c_canvas.clientWidth;
            const height = c_canvas.clientHeight;
            const needResize = c_canvas.width !== width || c_canvas.height !== height;
            if (needResize) {
                Me.renderer.setSize(width, height, false);
            }
            return needResize;
        };

        this.fn_setActiveCamera = function (p_activeCamera) {
            v_localActiveCamera = p_activeCamera;
        };

        this.fn_handleCameraSwitch = function (event) {
            const c_keyLength = v_myView.v_localCameras.length;
            if (c_keyLength == 0) return;

            switch (event.keyCode) {
                case 112: /*F1*/
                    const helpDlg = document.getElementById('help_dlg');
                    helpDlg.style.display = helpDlg.style.display === 'none' ? 'block' : 'none';
                    event.preventDefault();
                    break;

                case 79: /*O*/
                    v_droneIndex += 1;
                    v_droneIndex = v_droneIndex % c_keyLength;
                    if (v_myView.v_localCameras[v_droneIndex].m_cameraThree != null) {
                        v_localActiveCamera = v_myView.v_localCameras[v_droneIndex].m_cameraThree;
                    } else {
                        v_localActiveCamera = v_myView.v_localCameras[v_droneIndex];
                    }
                    break;

                case 80: /*P*/
                    v_droneIndex -= 1;
                    if (v_droneIndex < 0) v_droneIndex = c_keyLength - 1;
                    if (v_myView.v_localCameras[v_droneIndex].m_cameraThree != null) {
                        v_localActiveCamera = v_myView.v_localCameras[v_droneIndex].m_cameraThree;
                    } else {
                        v_localActiveCamera = v_myView.v_localCameras[v_droneIndex];
                    }
                    break;

                case 87: /*W*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, 0.1, 0);
                    break;

                case 83: /*S*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, -0.1, 0);
                    break;

                case 69: /*E*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(-0.1, 0, 0);
                    break;

                case 81: /*Q*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.1, 0, 0);
                    break;

                case 68: /*D*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, -0.1);
                    break;

                case 65: /*A*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, 0.1);
                    break;

                case 82: /*R*/
                    if (v_localActiveCamera.userData.m_ownerObject == null) break;
                    v_localActiveCamera.userData.m_ownerObject.fn_setCameraOrientation(0.0, 0, 0);
                    break;
            }
        };

        this.fn_setActiveCameraSelf = function () {
            v_localActiveCamera = v_camera;
        };

        this.render = function () {
            Me.renderer.render(Me.v_scene, v_localActiveCamera);
            v_context.drawImage(Me.renderer.domElement, 0, 0);
        };
    }

    this.fn_addCanvas = function fn_addCanvas(p_canvas) {
        Me.v_views.push(new C_View(p_canvas, v_XZero, v_YZero));
        v_selectedView = p_canvas;
    };

    function removeDebris(object) {
        Me.v_scene.remove(object);
        Me.v_physicsWorld.removeRigidBody(object.userData.m_physicsBody);
    }

    function createRandomColor() {
        return Math.floor(Math.random() * (1 << 24));
    }

    /**
     * Initialize Physics Ammo.js
     */
    this.fn_initPhysics = function fn_initPhysics() {
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
    };

    /**
     * Initialize Three.js graphics world
     */
    this.fn_initTHREE = function fn_initTHREE(p_width, p_height) {
        if (p_width == null) p_width = 640;
        if (p_height == null) p_height = 480;

        v_clock = new THREE.Clock();
        Me.v_height3D = 0;

        Me.v_scene = new THREE.Scene();
        Me.renderer = new THREE.WebGLRenderer({
            logarithmicDepthBuffer: true,
            antialias: true
        });
        Me.renderer.setPixelRatio(window.devicePixelRatio);
        Me.renderer.setSize(p_width, p_height);
        Me.renderer.setClearColor('#337ab7');
        Me.renderer.shadowMap.enabled = false;

        document.addEventListener('keydown', onKeyDown, false);
    };

    this.fn_initWorld = function fn_initWorld(p_XZero, p_YZero) {
        // Placeholder: Implement or import fn_initDesertWorld
        console.warn('fn_initWorld not implemented; define fn_initDesertWorld');
    };

    /*
     * Resize THREE based on canvas scale.
     */
    var fn_resizeRendererToDisplaySize = function fn_resizeRendererToDisplaySize(renderer) {
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
    this.fn_animate = function (time) {
        var c_keys = Object.keys(Me.v_drone);
        var c_key_length = c_keys.length;
        for (var i = 0; i < c_key_length; ++i) {
            Me.v_drone[c_keys[i]].fn_updateSimulationStep();
        }

        c_keys = Object.keys(Me.v_robots);
        c_key_length = c_keys.length;

        for (var i = 0; i < c_key_length; ++i) {
            Me.v_robots[c_keys[i]].fn_updateSimulationStep();
        }

        for (var i = 0; i < Me.v_views.length; ++i) {
            Me.v_views[i].render();
        }

        if (v_water != null) v_water.material.uniforms['time'].value += 1.0 / 60.0;

        let deltaTime = v_clock.getDelta();
        Me.fn_updatePhysics(deltaTime);

        requestAnimationFrame(Me.fn_animate);
    };

    this.fn_updatePhysics = function (p_deltaTime) {
        if (!Me.v_physicsWorld) return ;
        Me.v_physicsWorld.stepSimulation(p_deltaTime, 10);

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

        detectCollision();
    };

    /**
     * Detect collision between Ammo objects
     */
    function detectCollision() {
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
                Me.v_rigidBodies.push(fragment);
                Me.v_physicsWorld.addRigidBody(v_body);
                Me.v_rigidBodies.push(fragment);
                Me.v_scene.add(debris[j]);
            }

            v_objectsToRemove[v_numObjectsToRemove++] = threeObject;
            userData.collided = true;

            for (let i = 0; i < v_numObjectsToRemove; i++) {
                const v_obj = v_objectsToRemove[i].userData.m_removeMe;
                if (v_obj != null) {
                    Me.v_scene.remove(v_obj);
                }
                removeDebris(v_objectsToRemove[i]);
            }

            v_numObjectsToRemove = 0;
        }
    }
};

export { C_World };