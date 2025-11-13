import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import SimObject from '../js_object.js';
import { EVENTS as js_event } from '../js_eventList.js';
import { js_eventEmitter } from '../js_eventEmitter.js';
import { getMetersPerDegreeLng, metersPerDegreeLat, getInitialDisplacement, _map_lat, _map_lng } from '../js_globals.js';
import { ImageCache } from '../js_image_cache.js'
import { Vehicle } from '../physical_objects/js_vehicle.js';
import { Building } from '../physical_objects/Building.js';
import { CBaseScene } from './js_base_scene.js';

const PI_div_2 = Math.PI / 2;

export class C3DMapScene extends CBaseScene {
    constructor(worldInstance, homeLat = _map_lat, homeLng = _map_lng) {
        super(worldInstance, { homeLat, homeLng, tileRange: 2 });
        this.mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        this.zoomLevel = 14; // Lower zoom for larger tiles to reduce load; adjust as needed
        this.baseHeight = 0; // Will be set to terrain height at home
        this.heightScale = 1.0; // Controllable height exaggeration (resolution/scale factor)
        this.terrainResolution = 255; // Controllable mesh resolution (e.g., 255 for full, 127 for half)
    }

    // Setter to control height scale (exaggeration)
    setHeightScale(scale) {
        this.heightScale = scale;
        // To apply changes, you may need to reload tiles or update existing geometries
        console.warn('Height scale changed. Reload tiles to apply.');
    }

    // Setter to control terrain mesh resolution
    setTerrainResolution(resolution) {
        this.terrainResolution = resolution;
        // To apply changes, you may need to reload tiles
        console.warn('Terrain resolution changed. Reload tiles to apply.');
    }

    // Load map with new home coordinates and center on vehicle position
    async loadMapFromHome(lat, lng, vehicleX = 0, vehicleY = 0) {
        // Update home coordinates
        this.homeLat = lat * 1E-7;
        this.homeLng = lng * 1E-7;

        // Compute base height from terrain at home position
        this.baseHeight = await this._getTerrainHeight(this.homeLat, this.homeLng);

        // Update displacement
        const displacement = getInitialDisplacement();
        this.displacementX = displacement.X;
        this.displacementY = displacement.Y;

        // Clear existing tiles
        for (const tile of this.tiles.values()) {
            this.world.v_scene.remove(tile);
            if (tile.userData.m_physicsBody) {
                this.world.v_physicsWorld.removeRigidBody(tile.userData.m_physicsBody);
            }
            tile.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                    child.geometry.dispose();
                }
            });
        }
        this.tiles.clear();



        // Remove existing buildings and lights
        this.world.v_scene.children = this.world.v_scene.children.filter(child =>
            !child.userData?.isTile &&
            !(child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight) // Remove lights
        );

        this._addLights();

        // Update tiles around the vehicle's position
        this.updateTiles(vehicleX, -vehicleY);

        // Adjust cameras to focus on the vehicle's new position
        this._adjustCameras(vehicleX, vehicleY);
    }

    init(p_XZero, p_YZero) {
        this._addLights();
        this.updateTiles(p_XZero + 10, p_YZero);
    }

    async updateTiles(droneX, droneY) {
        const adjustedX = droneX - this.displacementX;
        const adjustedY = -droneY - this.displacementY;

        // Convert vehicle position to geographic coordinates
        const centerLat = this.homeLat + (adjustedX / metersPerDegreeLat);
        const metersPerDegreeLng = getMetersPerDegreeLng(centerLat);
        const centerLng = this.homeLng + (adjustedY / metersPerDegreeLng);

        // Compute current tile coordinates (Web Mercator)
        const n = Math.pow(2, this.zoomLevel);
        const currentTileX = Math.floor((centerLng + 180) / 360 * n);
        const sinLat = Math.sin(centerLat * Math.PI / 180);
        const currentTileY = Math.floor((1 - Math.log((1 + sinLat) / (1 - sinLat)) / (2 * Math.PI)) / 2 * n);

        const newTiles = new Set();
        const newTilePromises = [];

        for (let dx = -this.tileRange; dx <= this.tileRange; dx++) {
            for (let dy = -this.tileRange; dy <= this.tileRange; dy++) {
                const tileX = currentTileX + dx;
                const tileY = currentTileY + dy;
                const tileKey = `${tileX},${tileY}`;
                newTiles.add(tileKey);
                if (!this.tiles.has(tileKey)) {
                    newTilePromises.push(this._add3DTerrainTile(tileX, tileY));
                }
            }
        }

        await Promise.all(newTilePromises);

        //await ImageCache.getInstance().clearTiles(new Set(this.tiles.keys()));

        // Remove tiles outside the current range
        for (const [key, tile] of this.tiles) {
            if (!newTiles.has(key)) {
                const centerX = tile?.position?.x ?? 0;
                const centerY = tile?.position?.z ?? 0;
                this.world.v_scene.remove(tile);
                if (tile.userData.m_physicsBody) {
                    this.world.v_physicsWorld.removeRigidBody(tile.userData.m_physicsBody);
                }
                tile.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                        child.geometry.dispose();
                    }
                });
                this.tiles.delete(key);
                if (typeof this.fn_onTileRemoved === 'function') {
                    this.fn_onTileRemoved(centerX, centerY);
                }
            }
        }
    }

    _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    async _getTerrainHeight(lat, lng) {
        const zoom = this.zoomLevel;
        const n = Math.pow(2, zoom);

        // Compute tile coordinates
        const tileX = Math.floor((lng + 180) / 360 * n);
        const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

        // Compute tile bounds for fractions
        const lonLeft = tileX / n * 360 - 180;
        const lonRight = (tileX + 1) / n * 360 - 180;

        // Mercator Y for accurate y_frac
        const latRad = lat * Math.PI / 180;
        const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));

        const mercYNorth = Math.PI - (tileY / n) * 2 * Math.PI;
        const mercYSouth = Math.PI - ((tileY + 1) / n) * 2 * Math.PI;

        const x_frac = (lng - lonLeft) / (lonRight - lonLeft);
        const y_frac = (mercYNorth - mercY) / (mercYNorth - mercYSouth);

        const pixelX = Math.floor(x_frac * 256);
        const pixelY = Math.floor(y_frac * 256);

        // Load terrain image
        const terrainUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}.png?access_token=${this.mapboxAccessToken}`;
        //const terrainImg = await this._loadImage(terrainUrl);
        const terrainImg = await ImageCache.getInstance().getImage(terrainUrl, this.zoomLevel, tileX, tileY);

        // Extract RGB at pixel
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(terrainImg, 0, 0);
        const imageData = ctx.getImageData(pixelX, pixelY, 1, 1).data;

        const r = imageData[0];
        const g = imageData[1];
        const b = imageData[2];

        const height = -10000 + ((r * 65536 + g * 256 + b) * 0.1);
        return height;
    }

    async _add3DTerrainTile(tileX, tileY) {
        const n = Math.pow(2, this.zoomLevel);

        // Compute tile bounds
        const lonLeft = tileX / n * 360 - 180;
        const lonRight = (tileX + 1) / n * 360 - 180;
        const deltaLng = lonRight - lonLeft;

        const latNorth = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * tileY / n) - Math.exp(-(Math.PI - 2 * Math.PI * tileY / n))));
        const latSouth = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * (tileY + 1) / n) - Math.exp(-(Math.PI - 2 * Math.PI * (tileY + 1) / n))));
        const deltaLat = latNorth - latSouth;

        // Compute dimensions in meters
        const centerLat = (latNorth + latSouth) / 2;
        const metersPerDegreeLngCenter = getMetersPerDegreeLng(centerLat);
        const tileWidth = deltaLng * metersPerDegreeLngCenter;
        const tileHeight = deltaLat * metersPerDegreeLat;

        // Compute tile center position in world meters
        const tileCenterX = (centerLat - this.homeLat) * metersPerDegreeLat;
        const tileCenterZ = (((lonLeft + lonRight) / 2) - this.homeLng) * metersPerDegreeLngCenter;

        // Terrain URL (use .png for image loading)
        const terrainUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${this.zoomLevel}/${tileX}/${tileY}.png?access_token=${this.mapboxAccessToken}`;
        //const satelliteUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/${this.zoomLevel}/${tileX}/${tileY}?access_token=${this.mapboxAccessToken}`;
        const satelliteUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/${this.zoomLevel}/${tileX}/${tileY}?access_token=${this.mapboxAccessToken}`;

        try {
            // Load terrain image
            //const terrainImg = await this._loadImage(terrainUrl);
            const terrainImg = await ImageCache.getInstance().getImage(terrainUrl, this.zoomLevel, tileX, tileY);

            // Create canvas and extract height data
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(terrainImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, 256, 256);
            const data = imageData.data;

            // Create geometry with controllable resolution
            const segments = this.terrainResolution;
            const geometry = new THREE.PlaneGeometry(tileWidth, tileHeight, segments, segments);
            const vertices = geometry.attributes.position.array;

            for (let y = 0; y <= segments; y++) {
                for (let x = 0; x <= segments; x++) {
                    // Sample from 256x256 data, interpolate if segments != 255
                    const dataX = Math.floor(x / segments * 255);
                    const dataY = Math.floor(y / segments * 255);
                    const i = (dataY * 256 + dataX) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    let height = -10000 + ((r * 65536 + g * 256 + b) * 0.1);

                    // Apply offset and scale
                    height = (height - this.baseHeight) * this.heightScale;

                    const vertIndex = (y * (segments + 1) + x) * 3;
                    vertices[vertIndex + 2] = height; // Set z (which becomes y after rotation)
                }
            }

            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();

            // Load image with caching
            // const cachedImage = await ImageCache.getInstance().getImage(satelliteUrl, this.zoomLevel, tileX, tileY);

            // if (!cachedImage) {
            //     console.error(`Failed to load tile image for ${tileX},${tileY}`);
            //     return; // Skip adding the tile or use a fallback placeholder mesh
            // }

            // BUG: for unknown reason I cannot used the cached image with THREE.Texture() & geometry.
            // // 2. Create an empty texture and assign the cached image to its .image property
            // const texture = new THREE.Texture();
            // texture.image = cachedImage;
            // texture.needsUpdate = true;

            const texture = this.textureLoader.load(
                satelliteUrl,
                () => {
                    if (typeof this.fn_onNewTileCreated === 'function') {
                        this.fn_onNewTileCreated(tileCenterX, tileCenterZ);
                    }
                },
                undefined,
                (error) => {
                    console.error('Failed to load satellite texture', satelliteUrl, error);
                }
            );

            // Create material and mesh
            const material = new THREE.MeshLambertMaterial({ map: texture });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -PI_div_2;
            mesh.rotation.z = -PI_div_2;

            // Create group for the tile
            const tileGroup = new THREE.Group();
            tileGroup.add(mesh);
            tileGroup.position.set(tileCenterX, 0, tileCenterZ);
            tileGroup.userData.isTile = true;

            // Add to scene
            this.world.v_scene.add(tileGroup);

            // Store in tiles map
            const tileKey = `${tileX},${tileY}`;
            this.tiles.set(tileKey, tileGroup);

            

        } catch (error) {
            console.error(`Failed to load terrain tile ${tileX},${tileY}:`, error);
        }
    }

    _adjustCameras(p_XZero, p_YZero) {
        // Adjust cameras to new locations

        for (var i = 0; i < this.world.v_views.length; ++i) {
            if (!this.world.v_views[i].m_objects_attached_cameras) continue;
            for (var j = 0; j < this.world.v_views[i].m_objects_attached_cameras.length; ++j) {
                if ((this.world.v_views[i].m_objects_attached_cameras[j] instanceof THREE.PerspectiveCamera) === true) {
                    const cam = this.world.v_views[i].m_objects_attached_cameras[j];
                    // Place camera above the vehicle with an offset
                    cam.position.set(p_XZero + 5, 50, p_YZero + 5); // Higher to see over terrain
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
        Vehicle.create_car( p_x, 0, p_y).then((obj) => {
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
}