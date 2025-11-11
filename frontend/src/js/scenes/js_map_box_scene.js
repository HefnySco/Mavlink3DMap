import * as THREE from 'three';
import { getMetersPerDegreeLng, metersPerDegreeLat, _map_lat, _map_lng } from '../js_globals.js';
import { ImageCache } from '../js_image_cache.js'
import { CBaseScene } from './js_base_scene.js';

const PI_div_2 = Math.PI / 2;

// Approximate meters per degree latitude (WGS84)

export class CFlatMapScene extends CBaseScene {
    constructor(worldInstance, homeLat = _map_lat, homeLng = _map_lng) {
        super(worldInstance, { homeLat, homeLng, tileRange: 2 });
        this.pendingTiles = new Set(); // avoid duplicate in-flight loads
        this.mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        this.zoomLevel = 16;
    }

    // init and loadMapFromHome are inherited from CBaseScene

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

        // Add new tiles (debounced by pendingTiles)
        for (const key of requiredTiles) {
            if (!this.tiles.has(key) && !this.pendingTiles.has(key)) {
                const [tileX, tileY] = key.split(',').map(Number);
                // Convert tile center back to world coordinates
                const lon = (tileX + 0.5) / n * 360 - 180;
                const latRad = Math.atan(0.5 * (Math.exp(Math.PI - 2 * Math.PI * (tileY + 0.5) / n) - Math.exp(-(Math.PI - 2 * Math.PI * (tileY + 0.5) / n))));
                const lat = (180 / Math.PI) * latRad;
                const p_XZero = (lat - this.homeLat) * metersPerDegreeLat - this.displacementX;
                const p_YZero = (lon - this.homeLng) * getMetersPerDegreeLng(lat) - this.displacementY;
                this.pendingTiles.add(key);
                this._addMapboxTile(p_XZero, p_YZero, tileX, tileY)
                    .catch(e => console.error('Tile load failed', key, e))
                    .finally(() => this.pendingTiles.delete(key));
            }
        }
    }

    _adjustCameras(p_XZero, p_YZero) {
        if (!this.world || !Array.isArray(this.world.v_views)) return;
        for (let i = 0; i < this.world.v_views.length; ++i) {
            const view = this.world.v_views[i];
            const cams = view?.m_objects_attached_cameras || view?.v_localCameras || [];
            for (let j = 0; j < cams.length; ++j) {
                const cam = cams[j] && (cams[j].m_cameraThree instanceof THREE.PerspectiveCamera ? cams[j].m_cameraThree : cams[j]);
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

    async _addMapboxTile(p_XZero, p_YZero, tileX, tileY) {
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

        // Load image with caching
        const cachedImage = await ImageCache.getInstance().getImage(tileUrl, this.zoomLevel, tileX, tileY);

        if (!cachedImage) {
            console.error(`Failed to load tile image for ${tileX},${tileY}`);
            return; // Skip adding the tile or use a fallback placeholder mesh
        }

        // Create Three.js texture from cached image with robust params
        const texture = new THREE.CanvasTexture(cachedImage);
        texture.flipY = true; // align with PlaneGeometry UVs and Web image origin
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        if (THREE.sRGBEncoding) {
            texture.encoding = THREE.sRGBEncoding;
        }

        const geometry = new THREE.PlaneGeometry(tileWidth, tileHeight);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

        const tile = new THREE.Mesh(geometry, material);
        tile.position.set(p_XZero, -0.01, p_YZero);
        tile.rotation.x = -PI_div_2;
        tile.rotation.z = -PI_div_2;
        const tileKey = `${tileX},${tileY}`;
        // Replace existing tile if present (avoid stacking/darkening)
        const existing = this.tiles.get(tileKey);
        if (existing) {
            this.world.v_scene.remove(existing);
            if (existing.material?.map) existing.material.map.dispose();
            existing.material?.dispose?.();
            existing.geometry?.dispose?.();
            this.tiles.delete(tileKey);
        }
        this.tiles.set(tileKey, tile);
        this.world.v_scene.add(tile);
    }

    
}