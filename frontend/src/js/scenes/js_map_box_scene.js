import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';
import {EVENTS as js_event} from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';
import { getMetersPerDegreeLng, metersPerDegreeLat, getInitialDisplacement, _map_lat, _map_lng } from '../js_globals.js';

const PI_div_2 = Math.PI / 2;

// Approximate meters per degree latitude (WGS84)

export class MapboxWorld {
    constructor(worldInstance, homeLat = _map_lat, homeLng = _map_lng) {
        this.world = worldInstance;
        this.tileRange = 2; // Number of tiles in each direction (e.g., 2 means 5x5 grid)
        this.tiles = new Map(); // Map to store active tiles by their grid coordinates
        this.droneId = null;
        this.textureLoader = new THREE.TextureLoader();
        this.mapboxAccessToken = 'pk.eyJ1IjoiaHNhYWQiLCJhIjoiY2tqZnIwNXRuMndvdTJ4cnV0ODQ4djZ3NiJ9.LKojA3YMrG34L93jRThEGQ';
        this.zoomLevel = 16;
        this.homeLat = homeLat;
        this.homeLng = homeLng;
        const displacement = getInitialDisplacement();
        this.displacementX = displacement.X;
        this.displacementY = displacement.Y;

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_POS_CHANGED, this, (p_me, vehicle) => {
            // const location_array = vehicle.fn_getPosition();
            // p_me.updateTiles(location_array[0], -location_array[2]);
            const {x,y,z} = vehicle.fn_translateXYZ();
            p_me.updateTiles(x, -z); // Update tiles based on drone position
        });

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_HOME_CHANGED, this, (p_me, {lat,lng}) => {
            p_me.loadMapFromHome(lat, lng);
        });
    }

    // Load map with new home coordinates and center on vehicle position
    loadMapFromHome(lat, lng, vehicleX = 0, vehicleY = 0) {
        // Update home coordinates
        this.homeLat = lat * 1E-7;
        this.homeLng = lng * 1E-7;

        // Update displacement
        const displacement = getInitialDisplacement();
        this.displacementX = displacement.X;
        this.displacementY = displacement.Y;

        // Clear existing tiles
        for (const tile of this.tiles.values()) {
            this.world.v_scene.remove(tile);
            if (tile.material.map) tile.material.map.dispose();
            tile.material.dispose();
            tile.geometry.dispose();
        }
        this.tiles.clear();

        // Remove existing car (if any) to avoid duplicates
        if (this.droneId && this.world.fn_getRobot(this.droneId)) {
            const robot = this.world.fn_getRobot(this.droneId);
            this.world.v_scene.remove(robot.fn_getMesh());
            this.world.fn_deleteRobot(this.droneId);
            this.droneId = null;
        }

        // Remove existing buildings and lights
        this.world.v_scene.children = this.world.v_scene.children.filter(child => 
            !(child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry) && // Keep non-tile meshes temporarily
            !(child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight) // Remove lights
        );

        // Reinitialize scene with new car, buildings, and lights
        this.droneId = 'car' + uuidv4();
        this._addCar(this.droneId, vehicleX, vehicleY, 7);
        this._addBuildings(vehicleX, vehicleY);
        this._addLights();

        // Update tiles around the vehicle's position
        this.updateTiles(vehicleX, -vehicleY);

        // Adjust cameras to focus on the vehicle's new position
        this._adjustCameras(vehicleX, vehicleY);
    }

    init(p_XZero, p_YZero) {
        this.droneId = 'car' + uuidv4();
        this._addCar(this.droneId, p_XZero + 10, p_YZero, 7);
        this._addBuildings(p_XZero, p_YZero);
        this._addLights();
        this.updateTiles(p_XZero, p_YZero);
    }

    updateTiles(droneX, droneY) {
        const adjustedX = droneX - this.displacementX;
        const adjustedY = -droneY - this.displacementY;

        // Convert vehicle position to geographic coordinates
        const centerLat = this.homeLat + (adjustedX / metersPerDegreeLat);
        const metersPerDegreeLng = getMetersPerDegreeLng(centerLat);
        const centerLng = this.homeLng + (adjustedY / metersPerDegreeLng);

        // Calculate current Mapbox tile coordinates for vehicle position
        const n = Math.pow(2, this.zoomLevel);
        const gridTileX = Math.floor((centerLng + 180) / 360 * n);
        const gridTileY = Math.floor((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * n);

        // Create a set of required tile coordinates, including preload range
        const requiredTiles = new Set();
        const preloadRange = this.tileRange + 1;
        for (let x = gridTileX - preloadRange; x <= gridTileX + preloadRange; x++) {
            for (let y = gridTileY - preloadRange; y <= gridTileY + preloadRange; y++) {
                requiredTiles.add(`${x},${y}`);
            }
        }

        // Remove tiles outside extended range (tileRange + 2)
        const maxRange = this.tileRange + 2;
        for (const key of this.tiles.keys()) {
            const [x, y] = key.split(',').map(Number);
            if (Math.abs(x - gridTileX) > maxRange || Math.abs(y - gridTileY) > maxRange) {
                const tile = this.tiles.get(key);
                this.world.v_scene.remove(tile);
                if (tile.material.map) tile.material.map.dispose();
                tile.material.dispose();
                tile.geometry.dispose();
                this.tiles.delete(key);
            }
        }

        // Add new tiles
        for (const key of requiredTiles) {
            if (!this.tiles.has(key)) {
                const [tileX, tileY] = key.split(',').map(Number);
                // Convert tile center back to world coordinates
                const lon = (tileX + 0.5) / n * 360 - 180;
                const latRad = Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * (tileY + 0.5) / n) - Math.exp(-(Math.PI - 2 * Math.PI * (tileY + 0.5) / n))));
                const lat = (180 / Math.PI) * latRad;
                const p_XZero = (lat - this.homeLat) * metersPerDegreeLat - this.displacementX;
                const p_YZero = (lon - this.homeLng) * getMetersPerDegreeLng(lat) - this.displacementY;
                this._addMapboxTile(p_XZero, p_YZero, tileX, tileY);
            }
        }
    }

    _adjustCameras(p_XZero, p_YZero) {
        for (let i = 0; i < this.world.v_views.length; ++i) {
            for (let j = 0; j < this.world.v_views[i].v_localCameras.length; ++j) {
                const cam = this.world.v_views[i].v_localCameras[j];
                if (cam instanceof THREE.PerspectiveCamera) {
                    // Position camera above the vehicle with an offset
                    cam.position.set(p_XZero + 5, 5, p_YZero);
                    cam.lookAt(new THREE.Vector3(p_XZero, 0, p_YZero));
                    // Update OrbitControls if present
                    if (cam.m_controls) {
                        cam.m_controls.target.set(p_XZero, 0, p_YZero);
                        cam.m_controls.update();
                    }
                }
            }
        }
    }

    _addCar(p_id, p_x, p_y, p_radius) {
        const loader = new THREE.ObjectLoader();
        loader.load('../../models/vehicles/car1.json', (obj) => {
            obj.rotateZ(0);
            const c_robot = new SimObject(p_id, this.homeLat, this.homeLng);
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
            this.world.fn_addRobot(p_id, c_robot);
            this.world.v_scene.add(c_robot.fn_getMesh());
        });
    }

    _addMapboxTile(p_XZero, p_YZero, tileX, tileY) {
        const adjustedX = p_XZero + this.displacementX;
        const adjustedY = p_YZero + this.displacementY;

        const centerLat = this.homeLat + (adjustedX / metersPerDegreeLat);
        const metersPerDegreeLng = getMetersPerDegreeLng(centerLat);
        const centerLng = this.homeLng + (adjustedY / metersPerDegreeLng);

        // Compute actual tile bounds
        const n = Math.pow(2, this.zoomLevel);
        const lonLeft = tileX / n * 360 - 180;
        const lonRight = (tileX + 1) / n * 360 - 180;
        const deltaLng = lonRight - lonLeft;

        const latNorth = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * tileY / n) - Math.exp(-(Math.PI - 2 * Math.PI * tileY / n))));
        const latSouth = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * (tileY + 1) / n) - Math.exp(-(Math.PI - 2 * Math.PI * (tileY + 1) / n))));
        const deltaLat = latNorth - latSouth;

        // Compute dimensions in meters
        const tileWidth = deltaLng * metersPerDegreeLng;
        const tileHeight = deltaLat * metersPerDegreeLat;

        const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/${this.zoomLevel}/${tileX}/${tileY}?access_token=${this.mapboxAccessToken}`;

        const geometry = new THREE.PlaneGeometry(tileWidth, tileHeight);
        const material = new THREE.MeshBasicMaterial({ map: this.textureLoader.load(tileUrl), side: THREE.DoubleSide });

        const tile = new THREE.Mesh(geometry, material);
        tile.position.set(p_XZero, -0.01, p_YZero);
        tile.rotation.x = -PI_div_2;
        tile.rotation.z = -PI_div_2;
        const tileKey = `${tileX},${tileY}`;
        this.tiles.set(tileKey, tile);
        this.world.v_scene.add(tile);
    }

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
            obj.position.set(0.0, 0.0, p_YZero + 0);
            obj.rotateZ(0);
            this.world.v_scene.add(obj);
        });
    }

    _addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.world.v_scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.world.v_scene.add(directionalLight);
    }
}