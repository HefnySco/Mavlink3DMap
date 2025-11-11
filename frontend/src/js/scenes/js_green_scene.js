import * as THREE from 'three';
import { getMetersPerDegreeLng, metersPerDegreeLat, _map_lat, _map_lng } from '../js_globals.js';
import { BaseWorld } from './BaseWorld.js';

const PI_div_2 = Math.PI / 2;

export class CGrassWorld extends BaseWorld {
    constructor(worldInstance, homeLat = _map_lat, homeLng = _map_lng) {
        super(worldInstance, { homeLat, homeLng, tileRange: 2 });
        this.m_env_name = 'forest';
        this.m_max_titles_lat = 2;
        this.m_max_titles_lng = 2;
        this.zoomLevel = 16;
    }

    // init and loadMapFromHome inherited from BaseWorld

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
            for (let j = 0; j < this.world.m_objects_attached_cameras.length; ++j) {
                const cam = this.world.m_objects_attached_cameras[j];
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
        const x= tileX % this.m_max_titles_lng;
        const y= tileY % this.m_max_titles_lat;
        const tileUrl = `../../models/images/${this.m_env_name}/${this.m_env_name}_${x}_${y}.png?${this.zoomLevel}`;

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
}