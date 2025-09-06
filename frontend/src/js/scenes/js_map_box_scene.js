import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';
import {EVENTS as js_event} from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';
import { _map_lat, _map_lng } from '../js_globals.js'; // Import _map_lat and _map_lng

const PI_div_2 = Math.PI / 2;

// Approximate meters per degree longitude at given latitude
const metersPerDegreeLat = 111319.9; // Meters per degree latitude (approximate, WGS84)
const getMetersPerDegreeLng = (lat) => metersPerDegreeLat * Math.cos(lat * Math.PI / 180);

export class MapboxWorld {
    constructor(worldInstance) {
        this.world = worldInstance;
        this.tileSize = 500; // Size of each square tile in meters (width and height)
        this.tileRange = 2; // Number of tiles in each direction (e.g., 2 means 5x5 grid)
        this.tiles = new Map(); // Map to store active tiles by their grid coordinates
        this.droneId = null; // To store the ID of the drone
        this.textureLoader = new THREE.TextureLoader();
        this.mapboxAccessToken = 'pk.eyJ1IjoiaHNhYWQiLCJhIjoiY2tqZnIwNXRuMndvdTJ4cnV0ODQ4djZ3NiJ9.LKojA3YMrG34L93jRThEGQ'; // Replace with your Mapbox access token
        this.zoomLevel = 16; // Mapbox zoom level (adjust as needed)

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_POS_CHANGED, this, (p_me, vehicle) => {
            const location_array = vehicle.fn_getPosition();
            p_me.updateTiles(location_array[0], -location_array[2]); // Update tiles based on drone position
        });
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
        // Calculate grid coordinates
        const gridX = Math.floor(droneX / this.tileSize);
        const gridY = Math.floor(droneY / this.tileSize);

        // Create a set of required tile coordinates, including preload range
        const requiredTiles = new Set();
        const preloadRange = this.tileRange + 1; // Preload one extra tile in each direction
        for (let x = gridX - preloadRange; x <= gridX + preloadRange; x++) {
            for (let y = gridY - preloadRange; y <= gridY + preloadRange; y++) {
                requiredTiles.add(`${x},${y}`);
            }
        }

        // Remove tiles that are outside the extended range (tileRange + 2) to avoid excessive memory usage
        const maxRange = this.tileRange + 2;
        for (const key of this.tiles.keys()) {
            const [x, y] = key.split(',').map(Number);
            if (Math.abs(x - gridX) > maxRange || Math.abs(y - gridY) > maxRange) {
                const tile = this.tiles.get(key);
                this.world.v_scene.remove(tile);
                if (tile.material.map) tile.material.map.dispose(); // Dispose texture to free memory
                tile.material.dispose();
                tile.geometry.dispose();
                this.tiles.delete(key);
            }
        }

        // Add new tiles that are needed
        for (const key of requiredTiles) {
            if (!this.tiles.has(key)) {
                const [x, y] = key.split(',').map(Number);
                this._addMapboxTile(x * this.tileSize, y * this.tileSize);
            }
        }
    }

    // Private method to create and add a drone to the scene
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
            });

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            this.world.v_robots[p_id] = c_robot;
            this.world.v_scene.add(c_robot.fn_getMesh());
        });
    }

    // Private method to add a single Mapbox satellite tile
    _addMapboxTile(p_XZero, p_YZero) {
        // Convert world coordinates to geographic coordinates
        const centerLat = _map_lat + (p_XZero / metersPerDegreeLat);
        const metersPerDegreeLng = getMetersPerDegreeLng(centerLat);
        const centerLng = _map_lng + (p_YZero / metersPerDegreeLng);

        // Calculate tile coordinates for Mapbox
        const tileX = Math.floor((centerLng + 180) / 360 * Math.pow(2, this.zoomLevel));
        const tileY = Math.floor((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, this.zoomLevel));

        // Construct Mapbox Static Tiles API URL
        const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/${this.zoomLevel}/${tileX}/${tileY}?access_token=${this.mapboxAccessToken}`;

        // Create plane geometry for the tile
        const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
        const material = new THREE.MeshBasicMaterial({ map: this.textureLoader.load(tileUrl), side: THREE.DoubleSide });

        const tile = new THREE.Mesh(geometry, material);
        tile.position.set(p_XZero, -0.01, p_YZero); // Slightly below ground to avoid z-fighting
        tile.rotation.x = -PI_div_2; // Rotate to lie flat on the ground
        tile.rotation.z = -PI_div_2; // Rotate to lie flat on the ground
        const tileKey = `${Math.floor(p_XZero / this.tileSize)},${Math.floor(p_YZero / this.tileSize)}`;
        this.tiles.set(tileKey, tile);
        this.world.v_scene.add(tile);
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