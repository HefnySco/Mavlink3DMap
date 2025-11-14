import $ from 'jquery';
import { C_World } from './js/js_world.js';
import { c_CommandParser } from './js/js_websocket.js'; 
import './js/js_globals.js';
import './js/js_helpers.js'; 
import './js/js_utilities.js'; 
import './js/js_triggerObject.js'; 
import './js/js_object.js';
import './js/js_vehicle.js';
import './js/js_camera.js';
import { CGrassScene } from './js/scenes/js_green_scene.js'; 
import { C3DMapScene } from './js/scenes/js_3d_real_blank.js';
import {CFlatMapScene} from './js/scenes/js_map_box_scene.js';



async function initWorld() {
    const sceneType = window.sceneType;
    const c_world = new C_World(0, 0);
    c_world.fn_initTHREE(document.documentElement.clientWidth / 2.1, document.documentElement.clientHeight / 2.1);
    
    // Ensure canvases are in containers
    ['map3D_1', 'map3D_2', 'map3D_3', 'map3D_4'].forEach((id, index) => {
        const canvas = document.getElementById(id);
        let container = canvas.parentNode;
        if (!container.classList.contains('map3D_container')) {
            container = document.createElement('div');
            container.className = 'map3D_container';
            container.id = `container${index + 1}`;
            canvas.parentNode.insertBefore(container, canvas);
            container.appendChild(canvas);
        }
        c_world.fn_addCanvas(canvas, id === 'map3D_4'); // Only last is streamable
    });

    
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

    // Initialize physics and world
    await c_world.fn_initPhysics();
    c_world.m_scene_env = scene; 
    c_world.m_scene_env.init(0, 0);

    

    return c_world;
}

function startSimulation(p_world) {
    p_world.fn_animate();

    // Initialize WebSocket and command parser
    const c_WebSocketComm = new c_CommandParser();
    c_WebSocketComm.fn_initWebsocket(p_world);
}

async function fn_on_ready() {
    var canvas = $('canvas')[0];
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;

    // Ammo.js Initialization
    //await Ammo().then(() => {
    const c_world = await initWorld();
    startSimulation(c_world);
    //});
}


document.addEventListener('DOMContentLoaded', fn_on_ready);            