# MAVLink 3D Visualizer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project provides a bridge between a Software-In-The-Loop (SITL) simulator (e.g., ArduPilot SITL) and a web-based 3D visualization tool. It enables real-time rendering of MAVLink-enabled vehicles (drones, planes, VTOLs) in a 3D environment using Three.js for graphics, Ammo.js for physics, and MAVLink for telemetry parsing. The bridge converts UDP packets from the simulator to WebSocket messages for the browser, allowing interactive 3D maps with optional real-world terrain (via Mapbox or Three-Geo).

The visualization supports multiple vehicle types, camera views, physics simulations, and dynamic terrain loading based on vehicle position.

## Features

- **UDP to WebSocket Bridge**: Bi-directional communication between UDP (from SITL) and WebSocket (for the browser).
- **MAVLink Parsing**: Handles MAVLink v2 messages (e.g., HEARTBEAT, ATTITUDE, LOCAL_POSITION_NED, RC_CHANNELS, SERVO_OUTPUT_RAW).
- **3D Rendering**: Uses Three.js to render vehicles, scenes, and cameras in multiple canvas views.
- **Physics Simulation**: Integrates Ammo.js for rigid body physics, collisions, and breakable objects.
- **Vehicle Support**: Custom models for quadcopters (X/Plus frames), planes, VTOL planes, and unknown types.
- **Camera Controls**: Multiple attachable cameras with switching (e.g., via keys: P/O for switch, W/A/S/D/Q/E/R for adjustments).
- **Dynamic Maps**: 
  - Green grass scene.
  - Real map integration with Three-Geo (DEM-based terrain).
  - Mapbox satellite imagery for tiled ground textures.
- **Event System**: Custom event emitter for vehicle position changes and other updates.
- **Simulation Extras**: Animated objects (e.g., cars, buildings), lights, and shadows.
- **Modular Architecture**: Separate modules for world, views, vehicles, physics, and communication.

## Quickstart (Monorepo)

This repo is a monorepo with `frontend` and `backend` workspaces. Use the root scripts:

```bash
npm install

# Start UDP bridge + frontend (no camera stream)
npm run dev

# Start UDP bridge + camera streaming pipeline + frontend
npm run devall
```

Notes:
- `dev` launches `backend` UDP bridge and the `frontend` dev server.
- `devall` also launches the streaming pipeline: `websocket_streaming.js | ffmpeg` to a virtual video device (Linux).

## Requirements

- **Node.js**: v12+ (for running the UDP-WebSocket bridge).
- **Browser**: Modern browser with WebGL support (e.g., Chrome, Firefox).
- **Dependencies**:
  - Three.js (included via imports).
  - Ammo.js (for physics; loaded asynchronously).
  - UUID (for unique IDs).
  - Commander (for CLI options in bridge).
  - WS (WebSocket server).
  - Dgram (UDP handling).
  - Other libs: jQuery, ConvexHull, etc. (bundled in the JS files).
- **Optional**: Mapbox access token for satellite maps (set in `js_map_box_scene.js`).
- **SITL Simulator**: ArduPilot SITL or similar, configured to send UDP telemetry.

For camera streaming on Linux, ensure:
- `ffmpeg` is installed.
- A virtual video device exists (e.g., via `v4l2loopback`). The backend auto-detects the first device under `/sys/devices/virtual/video4linux/`.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/MAVLink-3D-Visualizer.git
   cd MAVLink-3D-Visualizer
   ```

2. Install dependencies (root workspaces):
   ```bash
   npm install
   ```

3. (Optional) For Mapbox integration, replace the placeholder access token in `js_map_box_scene.js` with your own:
   ```javascript
   this.mapboxAccessToken = 'your-mapbox-token-here';
   ```
   Get a free token from [Mapbox](https://account.mapbox.com/access-tokens/).

4. Ensure models and assets are in place (e.g., JSON models in `./models/vehicles/`).

## Usage

### Map Modes

- **Continuous tiles (Mapbox)**: `frontend/index_4w_map_box.html`
  - Satellite imagery tiles for continuous map coverage.
- **3D mapping (DEM terrain)**: `frontend/index_4w_real_map.html`
  - Real-world elevation and 3D terrain.
- **Custom images**: `frontend/index_4w.html`
  - Use your own ground image as the map background.

### Running the UDP-WebSocket Bridge

The bridge listens for UDP packets from the SITL simulator and forwards them via WebSocket to the browser.

1. Start the bridge:
   ```bash
   node udp2websocket.js --udp_target_port 16450
   ```
   - `--udp_target_port`: UDP port for SITL (default: 16450).
   - WebSocket listens on `ws://127.0.0.1:8811` (configurable in `udp2websocket.js`).

2. Configure your SITL simulator (e.g., ArduPilot):
   - Set UDP output to `127.0.0.1:16450` (or the bridge's UDP port).
   - Example: Run ArduPilot SITL with `sim_vehicle.py --console --map` and enable UDP telemetry.

### Running the Web Visualizer

1. Open `index_4w_map_box.html` in a browser (or serve it via a local server for better performance):
   ```bash
   # Using Python's simple server
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000/index_4w_map_box.html`.

2. URL Parameters (optional):
   - `?sceneType=greengrass`: Use a simple grass scene.
   - `?sceneType=realmap`: Use DEM-based real map (requires Three-Geo).
   - `?sceneType=map_box`: Use Mapbox satellite tiles (default).
   - `?lat=30.3632621&lng=30.165230`: Set initial map center (for real maps).
   - `?vtol=true`: Enable VTOL plane mode.

3. Controls:
   - **F1**: Toggle help dialog.
   - **P/O**: Switch between cameras.
   - **W/A/S/D/Q/E**: Adjust camera orientation (for vehicle-attached cameras).
   - **R**: Reset camera view.
   - Mouse: Orbit controls for free cameras.
   - Double-click canvas: Download screenshot.

### How It Works

- **Bridge (`udp2websocket.js`, `websocket.js`, `udpclient.js`)**: Converts UDP MAVLink packets to WebSocket binary messages and vice versa.
- **Web Client (`index_4w.js`, `js_websocket.js`)**: Connects to WebSocket, parses MAVLink, updates vehicle positions/rotations.
- **3D World (`js_world.js`, `js_view.js`)**: Manages Three.js scene, multiple canvas views, physics loop.
- **Vehicles (`js_arduVehicles.js`, `js_vehicle.js`)**: Loads JSON models, handles RC/servo inputs, animations.
- **Physics (`js_physicsObject.js`)**: Creates rigid bodies, handles collisions/breakables.
- **Scenes (`js_real_map.js`, `js_map_box_scene.js`, `js_green_scene.js`)**: Dynamic terrain loading, Mapbox tiles, or simple grass.
- **Cameras (`js_camera.js`)**: Attachable cameras with independent rotations.

Vehicles appear dynamically based on MAVLink HEARTBEAT messages. Positions update via LOCAL_POSITION_NED, attitudes via ATTITUDE.

## Why this simulator

- **See drone location in real time**: Visualize pose and movement on continuous or 3D maps to validate navigation and control algorithms.
- **Stream camera for tracking**: The camera streaming pipeline helps develop and test tracking/vision algorithms by writing frames to a virtual video device.

## Configuration

- **Ports/IPs**: Edit `udp2websocket.js` for UDP/WebSocket ports (default: UDP 16450, WS 8811).
- **Vehicle Models**: Add/edit JSON models in `./models/vehicles/`.
- **Map Settings**: Adjust `tileSize`, `tileRange`, `zoomLevel` in `js_map_box_scene.js`.
- **Physics**: Tune margins, masses in `js_physicsObject.js`.
- **Custom Scenes**: Extend `initWorld` in `index_4w.js` for new scene types.

## Troubleshooting

- **No Connection**: Ensure bridge is running and SITL sends to correct UDP port. Check console for WebSocket errors.
- **No Models**: Verify JSON files load (CORS issues if not served via server).
- **Performance**: Reduce `tileRange` or zoom level for slower devices.
- **Mapbox Errors**: Invalid token? Sign up for a free Mapbox account.
- **Physics Issues**: Ammo.js must load before simulation starts (handled in `index_4w.js`).

## Contributing

Contributions welcome! Fork the repo, create a branch, and submit a PR. Focus areas:
- More vehicle types (e.g., rovers, boats).
- Better map integrations (e.g., OpenStreetMap).
- Multi-vehicle support improvements.
- Mobile optimizations.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.