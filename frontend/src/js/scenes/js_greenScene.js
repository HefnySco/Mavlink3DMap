import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';

const PI_div_2 = Math.PI / 2;

export class DesertWorld {
    constructor(worldInstance) {
        this.world = worldInstance;
        this.tileSize = 50; // Size of each square tile (width and height)
        this.tileRange = 2; // Number of tiles in each direction (e.g., 2 means 5x5 grid)
        this.tiles = new Map(); // Map to store active tiles by their grid coordinates
        this.droneId = null; // To store the ID of the drone
    }

    init(p_XZero, p_YZero) {
        this.droneId = 'car' + uuidv4();
        this._addCar(this.droneId, p_XZero + 10, p_YZero + 0, 7);
        this._addBuildings(p_XZero, p_YZero);
        this._addLights();
        this.updateTiles(p_XZero, p_YZero); // Initialize tiles around starting position
    }

    // Update tiles based on drone's position
    updateTiles(droneX, droneY) {
        // Calculate the grid coordinates of the tile under the drone
        const gridX = Math.floor(droneX / this.tileSize);
        const gridY = Math.floor(droneY / this.tileSize);

        // Create a set of required tile coordinates
        const requiredTiles = new Set();
        for (let x = gridX - this.tileRange; x <= gridX + this.tileRange; x++) {
            for (let y = gridY - this.tileRange; y <= gridY + this.tileRange; y++) {
                requiredTiles.add(`${x},${y}`);
            }
        }

        // Remove tiles that are no longer needed
        for (const key of this.tiles.keys()) {
            if (!requiredTiles.has(key)) {
                const tile = this.tiles.get(key);
                this.world.v_scene.remove(tile);
                this.tiles.delete(key);
            }
        }

        // Add new tiles that are needed
        for (const key of requiredTiles) {
            if (!this.tiles.has(key)) {
                const [x, y] = key.split(',').map(Number);
                this._addGrassPlane(x * this.tileSize, y * this.tileSize);
            }
        }
    }

    // Private method to create and add a car (drone) to the scene
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
                const newX = p_radius * Math.cos(c_deg) + p_x;
                const newY = p_radius * Math.sin(c_deg) + p_y;
                c_robot.fn_setPosition(newX, newY, 0);
                c_deg = (c_deg + 0.01) % (2 * Math.PI);
                c_robot.fn_setRotation(0, 0, -c_deg - PI_div_2);

                // Update tiles based on the drone's new position
                this.updateTiles(newX, newY);
            });

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            this.world.v_robots[p_id] = c_robot;
            this.world.v_scene.add(c_robot.fn_getMesh());
        });
    }

    // Private method to add a single grass plane tile
    _addGrassPlane(p_XZero, p_YZero) {
        const loader = new THREE.ObjectLoader();
        loader.load('/public/models/grass_plan.json', (obj) => {
            obj.position.set(p_XZero, -0.01, p_YZero);
            obj.rotateZ(0);
            const tileKey = `${Math.floor(p_XZero / this.tileSize)},${Math.floor(p_YZero / this.tileSize)}`;
            this.tiles.set(tileKey, obj);
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