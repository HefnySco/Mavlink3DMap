// DesertWorld.js

import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js'; // The path to your SimObject module

const PI_div_2 = Math.PI / 2;

export class DesertWorld {
    
    constructor(worldInstance) {
        this.world = worldInstance; // Use a more descriptive name like 'world'
    }

    init(p_XZero, p_YZero) {
        this._addCar('car' + uuidv4(), p_XZero + 10, p_YZero + 0, 7);
        this._addGrassPlane(p_XZero, p_YZero);
        this._addBuildings(p_XZero, p_YZero);
        this._addLights();
    }
    
    // Private method to create and add a car to the scene
    _addCar(p_id, p_x, p_y, p_radius) {
        const loader = new THREE.ObjectLoader();
        loader.load('../../models/vehicles/car1.json', (obj) => {
            obj.rotateZ(0);
            const c_robot = new SimObject(p_id);
            c_robot.fn_createCustom(obj);
            c_robot.fn_setPosition(p_x, p_y, 0);
            c_robot.fn_castShadow(false);
            
            let c_y_deg_step = 0.01;
            let c_y_deg = 0.0;
            let c_deg = Math.random() * Math.PI;

            c_robot.fn_setAnimate(() => {
                c_y_deg += c_y_deg_step;
                if (c_y_deg >= 1.1) {
                    c_y_deg_step = -0.01;
                    c_y_deg = 1.1;
                } else if (c_y_deg <= -1.1) {
                    c_y_deg_step = 0.01;
                    c_y_deg = -1.1;
                }
                c_robot.fn_setPosition(p_radius * Math.cos(c_deg) + p_x, p_radius * Math.sin(c_deg) + p_y, 0);
                c_deg = (c_deg + 0.01) % (2 * Math.PI); // Correctly wrap the angle
                c_robot.fn_setRotation(0, 0, -c_deg - PI_div_2);
            });

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            this.world.v_robots[p_id] = c_robot;
            this.world.v_scene.add(c_robot.fn_getMesh());
        });
    }

    // Private method to add static objects like grass
    _addGrassPlane(p_XZero, p_YZero) {
        const loader = new THREE.ObjectLoader();
        loader.load('/public/models/grass_plan.json', (obj) => {
            obj.position.set(p_XZero, -0.01, p_YZero);
            obj.rotateZ(0);
            this.world.v_scene.add(obj);
        });
    }

    // Private method to add buildings
    _addBuildings(p_XZero, p_YZero) {
        const c_buildings = [
            [-16, -8], [-16, -12], [-16, -16],
            [16, 20], [16, 24], [16, 28]
        ];
        
        for (const c_location of c_buildings) {
            const buildingLoader = new THREE.ObjectLoader();
            buildingLoader.load('./models/building1.json', (obj) => {
                obj.position.set(p_XZero + c_location[0], 0.01, p_YZero + c_location[1]);
                obj.rotateZ(0);
                this.world.v_scene.add(obj);
            });
        }
        
        const building2Loader = new THREE.ObjectLoader();
        building2Loader.load('./models/building2.json', (obj) => {
            obj.position.set(p_XZero + 22, 0.0, p_YZero + 0);
            obj.rotateZ(0);
            this.world.v_scene.add(obj);
        });
    }

    // Private method to add lights
    _addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.world.v_scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.world.v_scene.add(directionalLight);
    }
}