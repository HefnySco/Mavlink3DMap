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


function getViewCount() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const q = params.get('views');
        const fromQuery = q ? String(q).trim() : '';
        if (fromQuery === '1' || fromQuery === '2' || fromQuery === '4') return Number(fromQuery);
    } catch (_) { }

    try {
        const stored = window.localStorage ? window.localStorage.getItem('VIEW_COUNT') : null;
        if (stored === '1' || stored === '2' || stored === '4') return Number(stored);
    } catch (_) { }

    return 4;
}

function buildViews(viewCount) {
    const mav = document.getElementById('mav3dmap');
    if (!mav) {
        console.error('Element #mav3dmap not found');
        return;
    }

    let row = mav.querySelector('.row');
    if (!row) {
        row = document.createElement('div');
        row.className = 'row';
        mav.appendChild(row);
    }

    while (row.firstChild) row.removeChild(row.firstChild);

    const columnClass = viewCount === 1 ? 'column1' : (viewCount === 2 ? 'column2' : 'column4');
    for (let i = 1; i <= viewCount; i++) {
        const col = document.createElement('div');
        col.className = columnClass;
        const canvas = document.createElement('canvas');
        canvas.id = `map3D_${i}`;
        col.appendChild(canvas);
        row.appendChild(col);
    }
}



async function initWorld() {
    const sceneType = window.sceneType;
    const c_world = new C_World(0, 0);
    const viewCount = getViewCount();
    const scaleFactor = viewCount >= 4 ? 2.1 : (viewCount === 2 ? 1.5 : 1);
    c_world.fn_initTHREE(
        document.documentElement.clientWidth / scaleFactor,
        document.documentElement.clientHeight / scaleFactor
    );

    const ids = Array.from({ length: viewCount }, (_, i) => `map3D_${i + 1}`);
    ids.forEach((id, index) => {
        const canvas = document.getElementById(id);
        if (!canvas) {
            console.warn(`Canvas element with ID ${id} not found.`);
            return;
        }
        let container = canvas.parentNode;
        if (!container.classList.contains('map3D_container')) {
            container = document.createElement('div');
            container.className = 'map3D_container';
            container.id = `container${index + 1}`;
            canvas.parentNode.insertBefore(container, canvas);
            container.appendChild(canvas);
        }
        c_world.fn_addCanvas(canvas, index === (viewCount - 1)); // Only last is streamable
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
    const viewCount = getViewCount();
    buildViews(viewCount);

    const canvas = $('canvas')[0];
    if (canvas) {
        canvas.width = document.documentElement.clientWidth;
        canvas.height = document.documentElement.clientHeight;
    }

    // Ammo.js Initialization
    //await Ammo().then(() => {
    const c_world = await initWorld();
    startSimulation(c_world);
    //});
}


document.addEventListener('DOMContentLoaded', fn_on_ready);            