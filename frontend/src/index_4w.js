import $ from 'jquery';
import { C_World } from './js/js_world.js';
import { c_CommandParser } from './js/js_websocket.js'; 
import './js/js_globals.js';
import './js/js_helpers.js'; 
import './js/js_utilities.js'; 
import './js/js_triggerObject.js'; 
import './js/js_object.js';
import './js/js_physicsObject.js'; 
import './js/js_vehicle.js';
import './js/js_camera.js';
import { CGrassWorld } from './js/scenes/js_green_scene.js'; 
//import { RealMapWorld } from './js/scenes/js_real_map.js';
import {MapboxWorld} from './js/scenes/js_map_box_scene.js';
//import './js/objects/Water.js'; 
import './js/ConvexHull.js'; 
import './js/ConvexGeometry.js'; 
import './js/ConvexObjectBreaker.js'; 


function initWorld() {
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
        //scene = new RealMapWorld(c_world);
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
    c_world.m_scene_env.init(0, 0);

    return c_world;
}

function initVehicle(p_world) {
    // Sample add a plane here
    // var v_vehicle = new c_ArduVehicles();
    // v_vehicle.fn_createVehicle(1, true, null, function () {
    //     v_vehicle.fn_setPosition(0, 0, 3);
    //     v_vehicle.fn_castShadow(false);
    //     c_world.v_scene.add(v_vehicle.fn_getMesh());
    //     c_world.v_drone['x'] = v_vehicle;
    //     c_world.fn_registerCamerasOfObject(v_vehicle);
    //     v_vehicle.fn_switchTriggerOn = function () {
    //         v_vehicle.m_trigger.fn_trigger(null, function (v_threeObj, v_physicsObj) {
    //             c_world.v_physicsWorld.addRigidBody(v_physicsObj);
    //             c_world.v_scene.add(v_threeObj);
    //             c_world.v_rigidBodies.push(v_threeObj);
    //         });
    //     };
    // });
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
    const c_world = initWorld();
    initVehicle(c_world);
    startSimulation(c_world);
    //});
}


document.addEventListener('DOMContentLoaded', fn_on_ready);            