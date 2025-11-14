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
import './js/js_vehicle.js';
import './js/js_camera.js';
import { CGrassScene } from './js/scenes/js_green_scene.js'; 
import { C3DMapScene } from './js/scenes/js_3d_real_blank.js';
import {CFlatMapScene} from './js/scenes/js_map_box_scene.js';
import './js/ConvexHull.js';
import './js/ConvexGeometry.js';

// Constants for configuration
const CONFIG = {
    worldZero: { x: 0, y: 0 },
    canvasId: 'map3D_1',
};

// Initialize the 3D world
async function initWorld() {
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
        scene = new C3DMapScene(c_world);
    } else if (sceneType === 'greengrass') {
        scene = new CGrassScene(c_world);
    } else if (sceneType === 'map_box') {
        scene = new CFlatMapScene(c_world);
    } else {
        console.warn(`Unknown scene type: ${sceneType}. Defaulting to CGrassScene.`);
        scene = new CGrassScene(c_world);
    }

    // Initialize physics and world (await Ammo initialization)
    await c_world.fn_initPhysics();
    c_world.m_scene_env = scene;
    c_world.m_scene_env.init(CONFIG.worldZero.x, CONFIG.worldZero.y);

    return c_world;
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
        const c_world = await initWorld();
        startSimulation(c_world);
    } catch (error) {
        console.error("Error during simulation initialization:", error);
    }
}

// Start when the document is ready
document.addEventListener('DOMContentLoaded', fn_on_ready);