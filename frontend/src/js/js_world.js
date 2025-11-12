import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { PhysicsBall } from './physical_objects/js_ball.js';

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

        // Track drone velocities for physics spawn
        this.v_droneVel = {}; // key -> {x,y,z}
        this._lastDronePos = {}; // key -> {x,y,z}

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

        // Cannon.js physics containers
        this.cannonWorld = null;
        this._physicsObjects = []; // { mesh, body }
        this._fixedTimeStep = 1 / 60;
        this._maxSubSteps = 3;

        // Track last globally selected drone (via 1..9)
        this.v_selectedDroneId = null;

        // Replace jQuery with vanilla JavaScript
        const helpDlg = document.createElement('div');
        helpDlg.id = 'help_dlg';
        helpDlg.innerHTML = `
            <ul>
                <li>F1: Help Toggle</li>
                <li>'1-9' Goto Drone by Index</li>
                <li>'O' next / 'P' previous camera (selected drone)</li>
                <li>'W A S D Q E' Change Camera View for Vehicles</li>
                <li>'L' Toggle Drone Labels</li>
                <li>'T' Toggle Camera Trace
                <li>'R' Reset Camera View</li>
                <li>'+ -' Change Drones Scale</li>
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

    // Persist multi-view layout (per-view selected drone/camera) to localStorage
    fn_saveLayoutToLocalStorage() {
        const LAYOUT_KEY = 'm3d_layout_v1';
        const views = this.v_views || [];
        const payload = {
            version: 1,
            savedAt: Date.now(),
            views: views.map(v => {
                // Determine camera mode and tag
                let mode = 'world';
                let tag = null;
                if (v.m_view_selected_camera && v.m_view_selected_camera !== v.m_main_camera) {
                    mode = 'attached';
                    const ctrl = v.m_view_selected_camera.userData && v.m_view_selected_camera.userData.m_ownerObject;
                    tag = ctrl && ctrl.m_camera_tag ? ctrl.m_camera_tag : null;
                }
                return {
                    selectedDroneId: v.selectedDroneId || null,
                    camera: { mode, tag }
                };
            })
        };
        try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload));
            console.log('Layout saved');
            try { this.v_selectedView?.fn_displayMessage('<b>Layout saved</b>', 1200); } catch (_) { }
        } catch (e) {
            console.warn('Failed to save layout:', e);
        }
    }

    // Restore multi-view layout from localStorage with safe fallbacks
    fn_restoreLayoutFromLocalStorage() {
        const LAYOUT_KEY = 'm3d_layout_v1';
        let data = null;
        try {
            const raw = localStorage.getItem(LAYOUT_KEY);
            if (!raw) {
                console.warn('No saved layout to restore');
                return;
            }
            data = JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to parse saved layout:', e);
            return;
        }

        if (!data || !Array.isArray(data.views)) return;

        const views = this.v_views || [];
        const count = Math.min(views.length, data.views.length);
        for (let i = 0; i < count; i++) {
            const cfg = data.views[i] || {};
            this.#fn_applyViewConfigSafely(views[i], cfg);
        }
        // Extra existing views without saved config => default
        for (let i = count; i < views.length; i++) {
            views[i].fn_selectWorldCamera();
            views[i].selectedDroneId = null;
        }
        console.log('Layout restored');
        try { this.v_selectedView?.fn_displayMessage('<b>Layout restored</b>', 1200); } catch (_) { }
    }

    // Clear saved layout and reset all views to defaults
    fn_resetLayout() {
        const LAYOUT_KEY = 'm3d_layout_v1';
        try { localStorage.removeItem(LAYOUT_KEY); } catch (_) { }
        const views = this.v_views || [];
        for (const v of views) {
            v.fn_selectWorldCamera();
            v.selectedDroneId = null;
        }
        console.log('Layout reset');
        try { this.v_selectedView?.fn_displayMessage('<b>Layout reset</b>', 1200); } catch (_) { }
    }

    // Helper: apply a saved config to a view with fallbacks if drone/camera missing
    #fn_applyViewConfigSafely(view, cfg) {
        if (!view) return;
        const cameraCfg = cfg.camera || {};
        const mode = cameraCfg.mode || 'world';
        const tag = cameraCfg.tag || null;
        const id = cfg.selectedDroneId || null;

        // Validate drone
        const vehicle = id && this.v_drone ? this.v_drone[id] : null;

        if (mode === 'world' || !vehicle) {
            view.fn_selectWorldCamera();
            view.selectedDroneId = vehicle ? id : null; // keep if valid, else null
            return;
        }

        // Attached camera: try to find matching tag first
        const cams = (vehicle && Array.isArray(vehicle.m_cameras)) ? vehicle.m_cameras : [];
        let found = null;
        if (tag) {
            found = cams.find(c => c && c.m_camera_tag === tag);
        }
        // Fallback: pick first available attached camera
        if (!found) {
            found = cams.length > 0 ? cams[0] : null;
        }

        if (found && found.m_cameraThree) {
            view.selectedDroneId = id;
            view.fn_setSelectedCamera(found.m_cameraThree);
        } else {
            // Final fallback: world camera
            view.fn_selectWorldCamera();
            view.selectedDroneId = id; // store even if no cam; still a valid drone selection
        }
    }

    fn_createBall(p_id, p_x, p_y, p_radius) {
        const { mesh } = PhysicsBall.create(
            this,
            { x: p_x, y: p_radius + 5, z: p_y },
            p_radius,
            0xa0afa4
        );
        mesh.name = p_id;
    };

    /*
    * Send event to selected view to handle keydown logic.
    */
    fn_onKeyDown(event) {
        // Global shortcuts: Save/Restore/Reset layout
        try {
            const key = (event.key || '').toLowerCase();
            if (event.ctrlKey && !event.altKey && !event.metaKey) {
                if (key === 's') { // Ctrl+S => Save layout
                    event.preventDefault();
                    this.fn_saveLayoutToLocalStorage();
                    return;
                }
                if (key === 'r' && !event.shiftKey) { // Ctrl+R => Restore layout
                    event.preventDefault();
                    this.fn_restoreLayoutFromLocalStorage();
                    return;
                }
                if (key === 'r' && event.shiftKey) { // Ctrl+Shift+R => Reset layout
                    event.preventDefault();
                    this.fn_resetLayout();
                    return;
                }
            }
        } catch (_) { }

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
            const chosenId = vehicleIds[drone_index];
            // Set selection on the active view (per-view selection)
            if (this.v_selectedView) {
                this.v_selectedView.selectedDroneId = chosenId;
                // Reset camera cycle index when selecting a different drone
                this.v_selectedView.v_droneIndex = 0;
                try { this.v_selectedView.fn_displayMessage(`<b>Drone ${chosenId}</b> selected`, 1200); } catch (_) { }
            }
            const vehicle = this.v_drone[chosenId];
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
        else if (event.keyCode === 32) { /* Space: trigger throw on selected drone for active view */
            const view = this.v_selectedView;
            if (!view) return;
            const chosenId = view.selectedDroneId;
            if (!chosenId) return;
            const vehicle = this.v_drone[chosenId];
            if (!vehicle) return;

            // Execute vehicle trigger (BallThrower)
            if (vehicle.m_trigger && vehicle.m_trigger.fn_trigger) {
                vehicle.m_trigger.fn_trigger(this);
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

    // Remove a canvas/view and dispose its resources
    fn_removeCanvas(p_canvas) {
        const idx = this.v_views.findIndex(v => v.m_canvas === p_canvas);
        if (idx >= 0) {
            const view = this.v_views[idx];
            try {
                if (view && typeof view.dispose === 'function') {
                    view.dispose();
                }
            } catch (e) { }
            this.v_views.splice(idx, 1);
            if (this.v_selectedView === view) {
                this.v_selectedView = this.v_views.length > 0 ? this.v_views[0] : null;
            }
        }
    };

    // Dispose all views (e.g., on scene teardown)
    fn_disposeAllViews() {
        if (this.v_views && this.v_views.length) {
            for (const view of this.v_views) {
                try {
                    if (view && typeof view.dispose === 'function') {
                        view.dispose();
                    }
                } catch (e) { }
            }
            this.v_views = [];
        }
        this.v_selectedView = null;
    };

    removeDebris(object) {
        this.v_scene.remove(object);
    }

    createRandomColor() {
        return Math.floor(Math.random() * (1 << 24));
    }

    /**
     * Initialize Cannon.js physics
     */
    fn_initPhysics() {
        // Create world
        this.cannonWorld = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });
        this.cannonWorld.broadphase = new CANNON.SAPBroadphase(this.cannonWorld);
        this.cannonWorld.allowSleep = true;

        // Materials and contact (basic defaults)
        const defaultMat = new CANNON.Material('default');
        const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, {
            friction: 0.4,
            restitution: 0.2
        });
        this.cannonWorld.defaultContactMaterial = contactMat;

        // Static ground plane at y=0 (Three.js uses Y up)
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, material: defaultMat });
        groundBody.addShape(groundShape);
        // Rotate to be horizontal (normal pointing up)
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0, 'XYZ');
        this.cannonWorld.addBody(groundBody);

        return Promise.resolve(this.cannonWorld);
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

        // Simple ground visual is handled by scene tiles; physics ground added in fn_initPhysics
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

        // Estimate drone velocities each frame
        const vehicleIds = Object.keys(this.v_drone);
        for (const id of vehicleIds) {
            const v = this.v_drone[id];
            const { x, y, z } = v.fn_translateXYZ();
            const last = this._lastDronePos[id];
            if (last && deltaTime > 0) {
                this.v_droneVel[id] = { x: (x - last.x) / deltaTime, y: (y - last.y) / deltaTime, z: (z - last.z) / deltaTime };
            }
            this._lastDronePos[id] = { x, y, z };
        }

        this.fn_updatePhysics(deltaTime);

        requestAnimationFrame(this.fn_animate);
    };

    fn_updatePhysics(p_deltaTime) {
        if (!this.cannonWorld) return;

        // Step simulation
        this.cannonWorld.step(this._fixedTimeStep, p_deltaTime, this._maxSubSteps);

        // Sync meshes to bodies and cleanup fallen ones
        for (let i = this._physicsObjects.length - 1; i >= 0; --i) {
            const { mesh, body } = this._physicsObjects[i];
            if (!mesh || !body) continue;

            mesh.position.set(body.position.x, body.position.y, body.position.z);
            mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

            // Remove if far below ground to avoid leaks
            if (body.position.y < -100) {
                this.v_scene.remove(mesh);
                this.cannonWorld.removeBody(body);
                this._physicsObjects.splice(i, 1);
            }
        }
    };

    // Collision detection removed (no physics)
};

export { C_World };