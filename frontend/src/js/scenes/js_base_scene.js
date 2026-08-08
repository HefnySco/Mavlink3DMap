import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';
import { EVENTS as js_event } from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';
import { getInitialDisplacement, _map_lat, _map_lng } from '../js_globals.js';
import { Vehicle } from '../physical_objects/js_physicalVehicle.js';
import { Building } from '../physical_objects/js_building.js';
import { getBuildingsPerTileFlag, getCarsEnabledFlag, getPlansEnabledFlag, getAirportsEnabledFlag } from '../js_storage.js';

const PI_div_2 = Math.PI / 2;

export class CBaseScene {
    constructor(worldInstance, { homeLat = _map_lat, homeLng = _map_lng, tileRange = 2 } = {}) {
        this.world = worldInstance;
        this.tileRange = tileRange;
        this.tiles = new Map();
        this.droneId = null;
        this.textureLoader = new THREE.TextureLoader();
        this._objectsByTag = new Map();

        this.homeLat = homeLat;
        this.homeLng = homeLng;
        const displacement = getInitialDisplacement();
        this.displacementX = displacement.X;
        this.displacementY = displacement.Y;

        this.m_default_vehicle_sid = null;

        this.refLat = null;
        this.refLng = null;
        this.refAlt = null;

        // Performance optimization: animation throttling
        this.animationFrameCounter = 0;
        this.animationUpdateFrequency = 3; // Update animations every 3rd frame
        this.maxAnimatedObjects = 12; // Limit total animated objects
        this.currentAnimatedObjects = 0;
        this.lastProcessedFrame = -1; // Track last processed world frame

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_POS_CHANGED, this, (p_me, vehicle) => {
            if (vehicle.sid != p_me.m_default_vehicle_sid) return;
            const { x, y, z } = vehicle.fn_translateXYZ();
            if (typeof p_me.updateTiles === 'function') {
                p_me.updateTiles(x, -z);
            }
        });

        js_eventEmitter.fn_subscribe(js_event.EVT_VEHICLE_HOME_CHANGED, this, async (p_me, { lat, lng, alt }) => {
            if (p_me.refLat === null) {
                p_me.refLat = lat * 1E-7;
                p_me.refLng = lng * 1E-7;
                p_me.refAlt = alt;
                if (typeof p_me.loadMapFromHome === 'function') {
                    await p_me.loadMapFromHome(lat, lng);
                }
            }
        });
    }

    // Default init: spawn car, buildings, lights, and initial tiles
    // called form c_world.m_scene_env.init(0, 0);
    init(p_XZero, p_YZero) {
        this._addLights();
        if (typeof this.updateTiles === 'function') {
            this.updateTiles(p_XZero, p_YZero);
        }
    }

    // Default re-center on new home
    async loadMapFromHome(lat, lng, vehicleX = 0, vehicleY = 0) {
        this.homeLat = lat * 1E-7;
        this.homeLng = lng * 1E-7;

        const displacement = getInitialDisplacement();
        this.displacementX = displacement.X;
        this.displacementY = displacement.Y;

        await this._clearTiles();
        this._removeExistingVehicle();

        if (typeof this.onBeforeReload === 'function') this.onBeforeReload();

        // Reinitialize scene with new car, buildings, and lights
        const randomCars = getCarsEnabledFlag();
        if (randomCars) {
            this.droneId = 'car' + uuidv4();
            this._addCar(this.droneId, vehicleX+10, vehicleY+20, 7);


        }
        this._addLights();

        if (typeof this.updateTiles === 'function') {
            this.updateTiles(vehicleX, -vehicleY);
        }

        if (typeof this._adjustCameras === 'function') {
            this._adjustCameras(vehicleX, vehicleY);
        }

        this._addPlanes(vehicleX, vehicleY,20);
    }

    _removeExistingVehicle() {
        if (this.droneId && this.world.fn_getRobot(this.droneId)) {
            const robot = this.world.fn_getRobot(this.droneId);
            this.world.v_scene.remove(robot.fn_getMesh());
            this.world.fn_deleteRobot(this.droneId);
            this.droneId = null;
        }
    }

    async _clearTiles() {
        for (const tile of this.tiles.values()) {
            this._disposeNode(tile);
            this.world?.v_scene?.remove(tile);
        }
        this.tiles.clear();
        // Reset animated object counter when clearing tiles
        this.currentAnimatedObjects = 0;
        console.log('[Performance] Cleared tiles, reset animated object counter');
    }

    _disposeNode(node) {
        if (!node) return;
        if (node.userData?.m_physicsBody && this.world?.v_physicsWorld) {
            this.world.v_physicsWorld.removeRigidBody(node.userData.m_physicsBody);
        }
        if (node.traverse) {
            node.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.material?.map) child.material.map.dispose();
                    if (child.material?.dispose) child.material.dispose();
                    if (child.geometry?.dispose) child.geometry.dispose();
                }
            });
        } else if (node instanceof THREE.Mesh) {
            if (node.material?.map) node.material.map.dispose();
            node.material?.dispose?.();
            node.geometry?.dispose?.();
        }
    }

    _addPlane(p_id, p_x, p_y,p_hight, p_radius) {
        Vehicle.create_plane(0, 0, 0).then((obj) => {
            const c_robot = new SimObject(p_id, this.homeLat, this.homeLng);
            c_robot.fn_createCustom(obj);
            c_robot.fn_setPosition(p_x, p_y, p_hight);
            c_robot.fn_castShadow(false);

            if (p_radius !== 0) {
                this._setCircularAnimation(c_robot, p_x, p_y, p_radius, p_hight);
            }

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0.0, 0.0, 0.0);
            this.world.fn_addRobot(p_id, c_robot);
            this.world.v_scene.add(c_robot.fn_getMesh());
        }).catch((e) => console.error('Car load failed', e));
    }

    _addCar(p_id, p_x, p_y, p_radius) {
        Vehicle.create_car(0, 0, 0).then((obj) => {
            const c_robot = new SimObject(p_id, this.homeLat, this.homeLng);
            c_robot.fn_createCustom(obj);
            c_robot.fn_setPosition(p_x, p_y, 0.1);
            c_robot.fn_castShadow(false);

            if (p_radius !== 0) {
                this._setCircularAnimation(c_robot, p_x, p_y, p_radius, 0);
            }

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            this.world.fn_addRobot(p_id, c_robot);
            this.world.v_scene.add(c_robot.fn_getMesh());
        }).catch((e) => console.error('Car load failed', e));
    }

     _addTank(p_id, p_x, p_y, p_radius) {
        Vehicle.create_tank(0, 0, 0).then((obj) => {
            const c_robot = new SimObject(p_id, this.homeLat, this.homeLng);
            c_robot.fn_createCustom(obj);
            c_robot.fn_setPosition(p_x, p_y, 10);
            c_robot.fn_castShadow(false);

            if (p_radius !== 0) {
                this._setCircularAnimation(c_robot, p_x, p_y, p_radius, 0);
            }

            this.world.fn_registerCamerasOfObject(c_robot);
            c_robot.fn_setRotation(0, 0.0, 0.0);
            this.world.fn_addRobot(p_id, c_robot);
            this.world.v_scene.add(c_robot.fn_getMesh());
        }).catch((e) => console.error('Car load failed', e));
    }

    _setCircularAnimation(c_robot, p_centerX, p_centerY, p_radius, p_altitude = 0) {
        if (!p_radius || this.currentAnimatedObjects >= this.maxAnimatedObjects) return;
        
        this.currentAnimatedObjects++;
        let c_y_deg = 0.0;
        const maxTilt = 1.1;

        const radiusFactor = Math.max(1, p_radius / 10);
        const tiltStepBase = 0.01;
        const angleStepBase = 0.01;
        const c_y_deg_step_base = tiltStepBase / radiusFactor;
        const angleStep = angleStepBase / radiusFactor;

        let c_y_deg_step = c_y_deg_step_base;
        let c_deg = Math.random() * Math.PI * 2;
        
        // Pre-calculate constants for performance
        const TWO_PI = Math.PI * 2;
        const LOD_DISTANCE_SQ = 10000; // 100 units squared for LOD cutoff

        c_robot.fn_setAnimate(() => {
            // Multi-view optimization: only update once per world frame (PER OBJECT)
            // NOTE: must be per robot; otherwise first robot would block all others.
            const worldFrame = this.world?.currentFrame || 0;
            const ud = c_robot.fn_getMesh ? c_robot.fn_getMesh().userData : (c_robot.userData || null);
            if (ud) {
                if (ud.lastProcessedFrame === worldFrame) return;
                ud.lastProcessedFrame = worldFrame;
            }

            // Animation throttling: only update every Nth frame
            this.animationFrameCounter++;
            if (this.animationFrameCounter % this.animationUpdateFrequency !== 0) return;

            // Distance-based LOD: skip animation if object is far from camera
            if (this.world?.v_views?.[0]?.m_view_selected_camera) {
                const camera = this.world.v_views[0].m_view_selected_camera;
                const dx = camera.position.x - p_centerX;
                const dz = camera.position.z - p_centerY;
                const distanceSq = dx * dx + dz * dz;
                if (distanceSq > LOD_DISTANCE_SQ) return;
            }

            c_y_deg += c_y_deg_step;
            if (c_y_deg >= maxTilt) {
                c_y_deg_step = -c_y_deg_step_base;
                c_y_deg = maxTilt;
            } else if (c_y_deg <= -maxTilt) {
                c_y_deg_step = c_y_deg_step_base;
                c_y_deg = -maxTilt;
            }
            
            const newX = p_radius * Math.cos(c_deg) + p_centerX;
            const newY = p_radius * Math.sin(c_deg) + p_centerY;
            c_robot.fn_setPosition(newX, newY, p_altitude);
            c_deg = (c_deg + angleStep) % TWO_PI;
            const heading = Math.atan2(newY - p_centerY, newX - p_centerX) + PI_div_2;
            c_robot.fn_setRotation(0, 0, -heading);
        });
    }

    _addBuildings(p_XZero, p_YZero, totalBuildings = 3) {
        console.log('Adding buildings at', p_XZero, p_YZero, totalBuildings);
        const tag = `${p_XZero},${p_YZero}`;
        const minX = -160;
        const maxX = 160;
        const minY = -160;
        const maxY = 280;

        const c_buildings = [];
        for (let i = 0; i < totalBuildings; i++) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            c_buildings.push([x, y]);
        }

        for (const c_location of c_buildings) {
            Building.create(this.world, {
                url: './models/building1.json',
                position: { x: p_XZero + c_location[0], y: 0.01, z: p_YZero + c_location[1] },
                width: 8,
                height: 12,
                depth: null,
                rotationY: 0,
                tag,
                onLoaded: (obj) => this._registerObjects(obj, tag)
            });
        }
    }

    _addPlanes(p_XZero, p_YZero, totalPlanes = 3, maxRadius= 60, minRadius= 15) {
        console.log('Adding planes at', p_XZero, p_YZero, totalPlanes);
        const minX = -10;
        const maxX = 10;
        const minY = -10;
        const maxY = 10;
        const minAlt = 0;  // Include ground level
        const maxAlt = 200;
    

        const c_planes = [];
        for (let i = 0; i < totalPlanes; i++) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            const alt = minAlt + Math.random() * (maxAlt - minAlt);
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            c_planes.push([x, y, alt, radius]);
        }

        for (const c_location of c_planes) {
            const planeId = 'plane' + uuidv4();
            this._addPlane(planeId, p_XZero + c_location[0], p_YZero + c_location[1], c_location[2], c_location[3]);
        }
    }

    _addAirport(p_XZero, p_YZero, totalAirports = 1) {
        console.log('Adding airports at', p_XZero, p_YZero, totalAirports);
        const minX = -120;
        const maxX = 140;
        const minY = -140;
        const maxY = 260;

        const c_airports = [];
        for (let i = 0; i < totalAirports; i++) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            c_airports.push([x, y]);
        }

        for (const c_location of c_airports) {
            const airportId = 'airport' + uuidv4();
            this._addAirportObject(airportId, p_XZero + c_location[0], p_YZero + c_location[1]);
        }
    }

    _addAirportObject(p_id, p_x, p_y) {
        Vehicle.create_airport(0, 0, 0).then((obj) => {
            
            // Spawn group of planes on ground around this airport
            this._addPlanesOnGround(p_x, p_y, 6);  // 3 planes per airport
        }).catch((e) => console.error('Airport load failed', e));
    }

    _addPlanesOnGround(p_centerX, p_centerY, totalPlanes = 3) {
        console.log('Adding planes on ground at', p_centerX, p_centerY, totalPlanes);
        
        // Spawn planes in a pattern around the airport center
        const radius = 30;  // Spread planes around airport
        const groundLevel = 0.1;  // Ground level altitude

        for (let i = 0; i < totalPlanes; i++) {
            const angle = (i / totalPlanes) * Math.PI * 2;  // Evenly distribute in circle
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            const planeId = 'groundPlane' + uuidv4();
            this._addPlane(planeId, p_centerX + offsetX, p_centerY + offsetY, groundLevel, 0);  // No circular animation
        }
    }

    _addCars(p_XZero, p_YZero, totalCars = 2, maxRadius = 40, minRadius = 0) {
        console.log('Adding cars at', p_XZero, p_YZero, totalCars);
        const minX = -120;
        const maxX = 140;
        const minY = -140;
        const maxY = 260;
        const maxRadiusValue = maxRadius;
        const minRadiusValue = minRadius;

        const c_cars = [];
        for (let i = 0; i < totalCars; i++) {
            const x = minX + Math.random() * (maxX - minX);
            const y = minY + Math.random() * (maxY - minY);
            const radius = minRadiusValue + Math.random() * (maxRadiusValue - minRadiusValue);
            c_cars.push([x, y, radius]);
        }

        for (const c_location of c_cars) {
            const carId = 'car' + uuidv4();
            this._addCar(carId, p_XZero + c_location[0], p_YZero + c_location[1], c_location[2]);
        }
    }

    _addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.world.v_scene.add(ambientLight);
    }

    fn_onNewTileCreated(x, y) {
        const startTime = performance.now();
        
        if (typeof this._addBuildings === 'function') {
            const buildingsPerTile = getBuildingsPerTileFlag();
            if (buildingsPerTile) {
                this._addBuildings(x, y);
            }
        }

        if (typeof this._addCars === 'function') {
            const randomCars = getCarsEnabledFlag();
            if (randomCars) {
                this._addCars(x, y);
            }
        }

        if (typeof this._addPlanes === 'function') {
            const randomPlans = getPlansEnabledFlag();
            if (randomPlans) {
                this._addPlanes(x, y);
            }
        }

        if (typeof this._addAirport === 'function') {
            const randomAirports = getAirportsEnabledFlag();
            if (randomAirports) {
                this._addAirport(x, y);
            }
        }
        
    }

    fn_onTileRemoved(x, y) {
        this._removeObjectsByTag(`${x},${y}`);
    }

    _registerObjects(obj, tag) {
        if (!tag || !obj) return;
        const list = this._objectsByTag.get(tag) || [];
        list.push(obj);
        this._objectsByTag.set(tag, list);
    }

    _removeObjectsByTag(tag) {
        const list = this._objectsByTag.get(tag);
        if (!list || list.length === 0) return;
        for (const obj of list) {
            this._disposeNode(obj);
            this.world?.v_scene?.remove(obj);
        }
        this._objectsByTag.delete(tag);
    }
}
