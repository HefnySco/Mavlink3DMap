import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';
import { EVENTS as js_event } from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';
import { getMetersPerDegreeLng, metersPerDegreeLat, getInitialDisplacement, _map_lat, _map_lng } from '../js_globals.js';
import { Vehicle } from '../physical_objects/js_vehicle.js';
import { Building } from '../physical_objects/Building.js';

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
        this.droneId = 'car' + uuidv4();
        this._addCar(this.droneId, p_XZero, p_YZero, 7);
        this._addBuildings(p_XZero, p_YZero);
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
        this.droneId = 'car' + uuidv4();
        this._addCar(this.droneId, vehicleX, vehicleY, 7);
        this._addLights();

        if (typeof this.updateTiles === 'function') {
            this.updateTiles(vehicleX, -vehicleY);
        }

        if (typeof this._adjustCameras === 'function') {
            this._adjustCameras(vehicleX, vehicleY);
        }
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

    _addCar(p_id, p_x, p_y, p_radius) {
        Vehicle.create_car(p_x, 0, p_y).then((obj) => {
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
        }).catch((e) => console.error('Car load failed', e));
    }

    _addBuildings(p_XZero, p_YZero) {
        const tag = `${p_XZero},${p_YZero}`;
        const c_buildings = [
            [-160, -80], [-106, -120], [-160, -160],
            [160, 200], [160, 240], [160, 280]
        ];

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

    _addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.world.v_scene.add(ambientLight);
    }

    fn_onNewTileCreated(x, y) {
        if (typeof this._addBuildings === 'function') {
            const buildingsPerTile = import.meta.env.VITE_BUILDINGS_PER_TILE;
            if (buildingsPerTile=== 'true')
            {
                this._addBuildings(x, y);
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
