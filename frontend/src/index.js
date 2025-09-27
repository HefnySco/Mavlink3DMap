import * as THREE from 'three';
import Stats from './js/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C_World } from './js/js_world.js';
import { c_ArduVehicles } from './js/js_arduVehicles.js';
import { c_CommandParser } from './js/js_websocket.js';
import './js/js_globals.js';
import './js/js_utilities.js';
import './js/js_triggerObject.js';
import './js/js_object.js';
import './js/js_physicsObject.js';
import './js/js_vehicle.js';
import './js/js_camera.js';
import { CGrassWorld } from './js/scenes/js_green_scene.js'; 
import { CRealMapWorld } from './js/scenes/js_3d_real_blank.js';
import {MapboxWorld} from './js/scenes/js_map_box_scene.js';
import './js/ConvexHull.js';
import './js/ConvexGeometry.js';
import './js/ConvexObjectBreaker.js';

// Constants for configuration
const CONFIG = {
    worldZero: { x: 0, y: 0 },
    canvasId: 'map3D_1',
};

// Initialize the 3D world
function initWorld() {
    const sceneType = window.sceneType;
    const c_world = new C_World(0, 0);


    // Add canvas to the world
    const canvas = document.getElementById(CONFIG.canvasId);
    if (canvas) {
        canvas.width = document.documentElement.clientWidth;
        canvas.height = document.documentElement.clientHeight;
        c_world.fn_initTHREE(canvas.width, canvas.height);
        c_world.fn_addCanvas(canvas);
    } else {
        console.error(`Canvas element with ID ${CONFIG.canvasId} not found.`);
    }

    let scene;
    // Select scene based on sceneType
    if (sceneType === 'realmap') {
        scene = new CRealMapWorld(c_world);
    } else if (sceneType === 'greengrass') {
        scene = new CGrassWorld(c_world);
    } else if (sceneType === 'map_box') {
        scene = new MapboxWorld(c_world);
    } else {
        console.warn(`Unknown scene type: ${sceneType}. Defaulting to CGrassWorld.`);
        scene = new CGrassWorld(c_world);
    }

    // Initialize physics and world
    c_world.fn_initPhysics();
    c_world.m_scene_env = scene;
    c_world.m_scene_env.init(CONFIG.worldZero.x, CONFIG.worldZero.y);

    return c_world;
}

// Initialize a sample vehicle (commented out as in original)
function initVehicle(c_world) {
    /*
    const v_vehicle = new c_ArduVehicles();
    v_vehicle.fn_createVehicle(1, true, null, () => {
        v_vehicle.fn_setPosition(0, 0, 3);
        v_vehicle.fn_castShadow(false);
        c_world.v_scene.add(v_vehicle.fn_getMesh());
        c_world.v_drone['x'] = v_vehicle;
        c_world.fn_registerCamerasOfObject(v_vehicle);

        v_vehicle.fn_switchTriggerOn = () => {
            v_vehicle.m_trigger.fn_trigger(null, (v_threeObj, v_physicsObj) => {
                c_world.v_physicsWorld.addRigidBody(v_physicsObj);
                c_world.v_scene.add(v_threeObj);
                c_world.v_rigidBodies.push(v_threeObj);
            });
        };
    });
    */
}

// Start the simulation
function startSimulation(p_world) {
    p_world.fn_animate();

    // Initialize WebSocket and command parser
    const c_WebSocketComm = new c_CommandParser();
    c_WebSocketComm.fn_initWebsocket(p_world);
}

// Main initialization function
async function fn_on_ready() {
    try {
        // Initialize Ammo.js
        // await Ammo().then(() => {
        //     const c_world = initWorld();
        //     initVehicle(c_world);
        //     startSimulation(c_world);
        // });
        const c_world = initWorld();
        initVehicle(c_world);
        startSimulation(c_world);
    } catch (error) {
        console.error("Error during simulation initialization:", error);
    }
}

// Start when the document is ready
document.addEventListener('DOMContentLoaded', fn_on_ready);