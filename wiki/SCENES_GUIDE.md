# Scenes Guide (for Developers)

This guide explains how scenes work and how to add or customize a scene. It references:
- `frontend/src/js/scenes/js_base_scene.js` (Base API)
- `frontend/src/js/scenes/js_green_scene.js` (Continuous tiles using local images)
- `frontend/src/js/scenes/js_map_box_scene.js` (Mapbox satellite tiles)
- `frontend/src/js/scenes/js_3d_real_blank.js` (3D terrain using Mapbox Terrain-RGB)

## Concepts

- A scene owns and manages ground tiles, lights, optional static objects (e.g., buildings), and the initial demo vehicle (car).
- Scenes subscribe to vehicle events and update visible tiles around the active vehicle.
- Scenes map between world meters (Three.js) and geographic coordinates (lat/lng) using helpers from `js_globals.js`.

## Base API: `CBaseScene`
File: `frontend/src/js/scenes/js_base_scene.js`

- Constructor:
  - `new CBaseScene(worldInstance, { homeLat = _map_lat, homeLng = _map_lng, tileRange = 2 })`
  - Sets home, displacement, internal tile map, and subscribes to events.
- Event subscriptions:
  - `EVT_VEHICLE_POS_CHANGED` → calls `updateTiles(x, -z)` when default vehicle moves.
  - `EVT_VEHICLE_HOME_CHANGED` → first time only, calls `loadMapFromHome(lat, lng)`.
- Methods you can override:
  - `init(p_XZero, p_YZero)`
  - `loadMapFromHome(latDegE7, lngDegE7, vehicleX = 0, vehicleY = 0)`
  - `updateTiles(droneX, droneY)`
  - `_adjustCameras(p_XZero, p_YZero)` (optional)
- Helpers provided:
  - `_clearTiles()`, `_disposeNode(node)`, `_addCar()`, `_addBuildings()`, `_addLights()`

## Example Scenes

### 1) Continuous Tiles (Local images): `CGrassScene`
File: `frontend/src/js/scenes/js_green_scene.js`
- Computes current Mapbox tile indices around the vehicle, but loads images from local folder `models/images/<env>/<env>_x_y.png`.
- Maintains a `tiles` map keyed by `"tileX,tileY"`.
- Adds/removes tile meshes as the vehicle moves.

### 2) Mapbox Satellite Tiles: `CFlatMapScene`
File: `frontend/src/js/scenes/js_map_box_scene.js`
- Fetches satellite imagery via Mapbox API:
  - `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{zoom}/{x}/{y}?access_token=...`
- Uses an `ImageCache` for caching.
- Debounces in-flight loads via `pendingTiles`.

### 3) 3D Terrain (Terrain-RGB): `C3DMapScene`
File: `frontend/src/js/scenes/js_3d_real_blank.js`
- Loads Terrain-RGB tiles from Mapbox and converts pixel RGB to elevation.
- Builds a `THREE.PlaneGeometry` mesh and displaces vertices by height.
- Overlays satellite texture.
- Tunables: `heightScale`, `terrainResolution`.

## Key Calculations (Web Mercator)
- Convert `lat/lng` to tile indices at `zoom`:
  - `x = floor((lng + 180) / 360 * 2^zoom)`
  - `y = floor((1 - ln(tan(lat*pi/180) + 1/cos(lat*pi/180))/pi)/2 * 2^zoom)`
- Convert tile region back to meters using `metersPerDegreeLat` and `getMetersPerDegreeLng(centerLat)`.

## Creating Your Own Scene

1) Create a new file under `frontend/src/js/scenes/`, e.g., `js_my_scene.js`.
2) Choose a base class:
   - Start from `CBaseScene` if you need a 2D ground plane.
   - Use `C3DMapScene` as a reference if you need 3D terrain.
3) Implement required methods:
   - `constructor(worldInstance, homeLat = _map_lat, homeLng = _map_lng) { super(worldInstance, { homeLat, homeLng, tileRange: 2 }); /* your fields */ }`
   - `init(p_XZero, p_YZero)`: add car, buildings, lights, and call `updateTiles` once.
   - `updateTiles(droneX, droneY)`: compute which tiles to show around the vehicle, add new tiles, and remove far ones.
   - Optional: `_adjustCameras(p_XZero, p_YZero)` to reposition cameras after map reload.
4) Add tiles:
   - Compute tile world coordinates and size in meters.
   - Create `THREE.PlaneGeometry(tileWidth, tileHeight)` and a material (e.g., `MeshBasicMaterial` or `MeshLambertMaterial`).
   - Set orientation: commonly `mesh.rotation.x = -PI/2; mesh.rotation.z = -PI/2`.
   - Add to `this.world.v_scene` and track in `this.tiles`.
5) Remove tiles:
   - Iterate `this.tiles`, and dispose of material/geometry before removing from the scene.
6) Hook the scene into entry points:
   - If your app selects scenes by query param, add mapping in the scene factory/initialization file (e.g., `index_4w.js`).
   - Or expose a function to instantiate your scene and wire it where the world is created.

## Performance Tips
- Keep `tileRange` modest (e.g., 2 or 3). Preload 1 extra radius if needed, and evict tiles > `tileRange + 2`.
- Use caching for remote images.
- Dispose textures and geometries when removing tiles to avoid memory leaks.
- Avoid excessive camera updates.

## Camera Adjustments
- Implement `_adjustCameras(p_XZero, p_YZero)` to re-center camera targets when home changes or on initial load.
- With OrbitControls, set `controls.target` and `controls.update()`.

## Coordinates and Displacement
- `displacementX`, `displacementY` are initial offsets applied to world coordinates, taken from `getInitialDisplacement()`.
- When converting between lat/lng and world meters, use the helpers from `js_globals.js`.

## Mapbox Tokens
- `CFlatMapScene` and `C3DMapScene` read `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN`.
- Provide `.env` in the `frontend` with a valid token when using remote tiles.

## Testing a New Scene
- Start the app (`npm start` or `npm run devall`).
- Use/extend the scene selection (e.g., URL param) to switch to your scene.
- Move the vehicle or feed live telemetry to verify `updateTiles` logic.

## Troubleshooting
- If tiles are misaligned, verify meters/degree conversions and rotations.
- If memory grows, ensure you dispose textures and geometries when removing tiles.
- For remote tiles, check CORS/authorization issues and network errors.
