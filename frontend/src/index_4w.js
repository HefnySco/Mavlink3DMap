import $ from 'jquery';
import * as THREE from 'three';
import Stats from './js/stats.module.js'; // Placeholder: Ensure this file exists or use npm stats.js
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C_World } from './js/js_world.js';
import { c_ArduVehicles } from './js/js_arduVehicles.js'; // Placeholder: Ensure this file exists
import { c_CommandParser } from './js/js_websocket.js'; // Placeholder: Ensure this file exists
import './js/js_globals.js';
import './js/js_helpers.js'; // Placeholder: Ensure this file exists
import './js/js_utilities.js'; // Placeholder: Ensure this file exists
import './js/js_triggerObject.js'; // Placeholder: Ensure this file exists
import './js/js_object.js';
import './js/js_physicsObject.js'; // Placeholder: Ensure this file exists
import './js/js_vehicle.js';
import './js/js_camera.js';
import { DesertWorld } from './js/scenes/js_greenScene.js'; // Placeholder: Ensure this file exists
//import './js/objects/Water.js'; // Placeholder: Ensure this file exists
import './js/ConvexHull.js'; // Placeholder: Ensure this file exists
import './js/ConvexGeometry.js'; // Placeholder: Ensure this file exists
import './js/ConvexObjectBreaker.js'; // Placeholder: Ensure this file exists


function initWorld() {
    const c_world = new C_World(0, 0);
    c_world.fn_addCanvas(document.getElementById('map3D_1'));
    c_world.fn_addCanvas(document.getElementById('map3D_2'));
    c_world.fn_addCanvas(document.getElementById('map3D_3'));
    c_world.fn_addCanvas(document.getElementById('map3D_4'));
    c_world.fn_initTHREE(document.documentElement.clientWidth / 2.1, document.documentElement.clientHeight / 2.1);
    
    // Initialize physics and world
    c_world.fn_initPhysics();
    c_world.fn_initWorld = new DesertWorld(c_world); 
    c_world.fn_initWorld.init(0, 0);

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