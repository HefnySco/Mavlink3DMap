// js_RealMap.js

class CThreeDWorld {
    constructor(p_XZero, p_YZero) {
        this.m_world = this; // Self-reference for clarity within methods

        // --- Configuration ---
        const TILE_LOAD_THRESHOLD = 500; // Distance in meters before a new tile is loaded
        const MAP_RADIUS_KM = 5.0; // Radius of the bounding circle for terrain loading
        const MAP_ZOOM_LEVEL = 14; // Zoom resolution for terrain
        let currentMapCenter = { lat: _map_lat, lng: _map_lng }; // Initial map center

        // Assume c_PhysicsObject, THREE, ThreeGeo, MAP_SCALE, _map_lat, _map_lng, get_UrlParameter, STATE are defined elsewhere in the global scope or imported

        // --- Helper Functions ---
        const getHeightOf3DPoint = (p_x, p_y) => {
            const res = (new THREE.Raycaster(new THREE.Vector3(p_x, 18900, p_y), new THREE.Vector3(0, -1, 0), 1, 50000)).intersectObject(window.terrain, true);
            if ((res === null) || (res.length === 0)) {
                return 0;
            } else {
                return 18900 - Math.floor(res[0].distance);
            }
        };

        const createRandomColor = () => {
            return Math.floor(Math.random() * (1 << 24));
        };

        const createMaterial = (color) => {
            color = color || createRandomColor();
            return new THREE.m_worldshPhongMaterial({ color: color });
        };

        const createObject = (mass, halfExtents, pos, quat, material) => {
            const v_threeObj = new THREE.m_worldsh(new THREE.BoxBufferGeometry(halfExtents.x, halfExtents.y, halfExtents.z), material);
            v_threeObj.position.copy(pos);
            v_threeObj.quaternion.copy(quat);
            this.m_world.v_convexBreaker.prepareBreakableObject(v_threeObj, mass, new THREE.Vector3(), new THREE.Vector3(), true);
            const v_body = c_PhysicsObject.fn_createDebrisFromBreakableObject(v_threeObj);

            if (mass > 0) {
                this.m_world.v_rigidBodies.push(v_threeObj);
                v_body.setActivationState(STATE.DISABLE_DEACTIVATION);
            }

            this.m_world.v_physicsWorld.addRigidBody(v_body);
            this.m_world.v_rigidBodies.push(v_threeObj);
            return v_threeObj;
        };

        this.createObject2 = (mass, object, p_scale) => {
            const v_threeObj = createObject(mass, p_scale, object.position, object.quaternion, createMaterial(0xB03014));
            v_threeObj.userData.m_removeMe = object;
            this.m_world.v_scene.add(v_threeObj);
        };

        const fn_adjustLocalCamerasBasedOnHeight = () => {
            for (let i = 0; i < this.m_world.v_views.length; ++i) {
                for (let j = 0; j < this.m_world.v_views[i].v_localCameras.length; ++j) {
                    if ((this.m_world.v_views[i].v_localCameras[j] instanceof THREE.PerspectiveCamera) === true) {
                        this.m_world.v_views[i].v_localCameras[j].position.y = this.m_world.v_height3D + (70 + i * 70);
                        this.m_world.v_views[i].v_localCameras[j].lookAt(new THREE.Vector3(p_XZero + 0, this.m_world.v_height3D, p_YZero + 0));
                    }
                }
            }
        };

        const fn_onMapLoaded = () => {
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            this.m_world.v_scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            this.m_world.v_scene.add(directionalLight);
        };

        // --- Dynamic Map Loading ---
        this.loadNewTerrain = async (latitude, longitude) => {
            console.log(`Loading new terrain for [${latitude}, ${longitude}]`);

            // Remove old terrain if it exists
            if (window.terrain) {
                this.m_world.v_scene.remove(window.terrain);
                if (window.terrain.userData.m_physicsBody) {
                    this.m_world.v_physicsWorld.removeRigidBody(window.terrain.userData.m_physicsBody);
                    // Remove from rigidBodies array
                    const index = this.m_world.v_rigidBodies.indexOf(window.terrain);
                    if (index > -1) {
                        this.m_world.v_rigidBodies.splice(index, 1);
                    }
                }
                window.terrain.geometry.dispose();
                window.terrain.material.dispose();
                window.terrain = null;
            }

            const tgeo = new ThreeGeo({
                tokenMapbox: 'pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ',
            });

            if (tgeo.tokenMapbox === '********') {
                const warning = 'Please set your Mapbox API token in ThreeGeo constructor.';
                alert(warning);
                throw warning;
            }

            const terrain = await tgeo.getTerrainRgb(
                [latitude, longitude],
                MAP_RADIUS_KM,
                MAP_ZOOM_LEVEL
            );
            window.terrain = terrain;
            this.m_world.v_scene.add(terrain);
            terrain.setRotationFromEuler(new THREE.Euler(-1.57, 0, -1.57, "XYZ"));
            terrain.scale.x = MAP_RADIUS_KM * MAP_SCALE;
            terrain.scale.y = MAP_RADIUS_KM * MAP_SCALE;
            terrain.scale.z = 1;

            const c_body = c_PhysicsObject.fn_createBox(0, terrain);
            terrain.userData.m_physicsBody = c_body;
            this.m_world.v_physicsWorld.addRigidBody(c_body);
            this.m_world.v_rigidBodies.push(terrain);

            setTimeout(() => {
                this.m_world.v_height3D = getHeightOf3DPoint(0, 0);
                fn_adjustLocalCamerasBasedOnHeight();
            }, 1000);

            fn_onMapLoaded();
            currentMapCenter = { lat: latitude, lng: longitude };
        };

        // --- Initialization and Navigation Logic ---
        if (get_UrlParameter("lng") !== false) _map_lng = get_UrlParameter("lng");
        if (get_UrlParameter("lat") !== false) _map_lat = get_UrlParameter("lat");

        // Initial map load
        this.loadNewTerrain(_map_lat, _map_lng);

        // --- Navigation Check (Call this in your main animation loop) ---
        this.fn_checkAndLoadNewMap = () => {
            if (!this.m_world.v_camera || !window.terrain) return;

            const cameraPosition = this.m_world.v_camera.position;
            // Terrain is at 0,0,0 initially after setRotationFromEuler
            // Calculate distance from camera to the center of the currently loaded terrain.
            const distanceToTerrainCenter = cameraPosition.distanceTo(new THREE.Vector3(0, cameraPosition.y, 0));

            if (distanceToTerrainCenter > TILE_LOAD_THRESHOLD) {
                // Determine a new center for the map based on camera's movement direction
                // This is a simplified approach. A more robust solution would involve
                // converting the camera's world coordinates back to lat/lng.

                // Dummy conversion: assume 1 degree of lat/lng is roughly 111,000 meters
                // And calculate how many degrees the camera has moved
                const metersPerDegreeLat = 111000;
                const metersPerDegreeLng = 111000 * Math.cos(THREE.Math.degToRad(currentMapCenter.lat)); // Varies by latitude

                const deltaX_meters = cameraPosition.x; // In Three.js space, aligned with east/west
                const deltaZ_meters = cameraPosition.z; // In Three.js space, aligned with north/south

                const newLat = currentMapCenter.lat - (deltaZ_meters / metersPerDegreeLat); // Z in Three.js often maps to North/South
                const newLng = currentMapCenter.lng + (deltaX_meters / metersPerDegreeLng); // X in Three.js often maps to East/West

                this.loadNewTerrain(newLat, newLng);
            }
        };

        // Ensure p_XZero and p_YZero are initialized
        if (p_XZero === null) p_XZero = v_XZero; // Assuming v_XZero is available in the scope
        if (p_YZero === null) p_YZero = v_YZero; // Assuming v_YZero is available in the scope
    }


    setWorld (world)
    {
        this.m_world = world;
    }
}