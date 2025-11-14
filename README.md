# MAVLink 3D Visualizer

[![App Logo](resources/app_logo.png)](resources/app_logo.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project provides a bridge between a Software-In-The-Loop (SITL) simulator (e.g., ArduPilot SITL) and a web-based 3D visualization tool. It enables real-time rendering of MAVLink-enabled vehicles (drones, planes, VTOLs) in a 3D environment using Three.js for graphics, Ammo.js for physics, and MAVLink for telemetry parsing. The bridge converts UDP packets from the simulator to WebSocket messages for the browser, allowing interactive 3D maps with optional real-world terrain (via Mapbox or Three-Geo).


[![Mavlink3DMap Demo](https://img.youtube.com/vi/bCMPW9wn-Js/0.jpg)](https://youtu.be/bCMPW9wn-Js)

The visualization supports multiple vehicle types, camera views, physics simulations, and dynamic terrain loading based on vehicle position.

## Documentation

- Project Wiki: [wiki/](wiki/)  
  This folder contains developer and user docs. Link here stays stable as docs evolve.

# Mavlink3DMap

Mavlink3DMap is a Node.js‑based tool for visualizing MAVLink telemetry on an interactive 3D map in the browser.  
It provides:

- **Backend**: Bridges MAVLink data received over UDP into WebSocket streams.
- **Frontend**: A WebGL/3D scene that renders the vehicle and environment in real time.
- **SITL Helpers**: Convenience scripts for running ArduPilot SITL (plane / quad / VTOL) with preconfigured parameters.

> This README describes the project based on the current repository structure and script names.  
> If your local setup differs, adjust paths/commands accordingly.

---

## Features

- **UDP → WebSocket bridge**  
  - Backend listens to MAVLink‑compatible UDP telemetry.
  - Forwards selected data to browser clients via WebSocket.

- **3D visualization in the browser**  
  - Frontend uses JavaScript 3D scenes (under `frontend/src/js/scenes`) to render:
    - Vehicle attitude and position.
    - World reference / environment objects (depending on chosen scene).

- **Multiple scenes / views**  
  - Modular scene files in `frontend/src/js/scenes`.
  - View controller in `frontend/src/js/js_view.js`.
  - World / environment logic in `frontend/src/js/js_world.js`.

- **Streaming utilities**  
  - `backend/src/udp2websocket.js`: Bridge for UDP → WebSocket.
  - `backend/src/websocket_streaming.js`: Manages streaming data to clients.

- **SITL integration helpers**  
  - Root scripts like:
    - `runSITLPlane.sh`
    - `runSITLQuad.sh`
  - Parameter files:
    - `VTOL_TRI.parm`
    - `quadPlus_2.parm`

- **Simple local run scripts**  
  - `run_web.sh` to start the web frontend.
  - `run.sh` as a generic entry point (depending on how you use it).

---

## Project Structure

High‑level overview:

```text
.
├── backend/
│   ├── public/
│   ├── scripts/
│   │   └── prepack.js
│   ├── src/
│   │   ├── cli.js
│   │   ├── mavlink.js
│   │   ├── udp2websocket.js
│   │   └── websocket_streaming.js
│   └── package.json   (backend dependencies)
├── frontend/
│   ├── public/
│   │   ├── models/
│   │   ├── app_logo.png
│   │   └── favicon.ico
│   ├── src/
│   │   ├── index.js
│   │   ├── index_4w.js
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── js_view.js
│   │   │   ├── js_world.js
│   │   │   └── scenes/
│   │   │       └── ... (3D scene definitions)
│   │   └── textures/
│   ├── index.html
│   └── package.json   (frontend dependencies, if present)
├── resources/
│   ├── app_logo.png
│   └── fav.ico
├── wiki/
│   ├── DEV_DATAFLOW.md
│   └── SCENES_GUIDE.md
├── run.sh
├── run_web.sh
├── runSITLPlane.sh
├── runSITLQuad.sh
├── VTOL_TRI.parm
├── quadPlus_2.parm
└── package.json       (root metadata / scripts)
```

Key pieces:

- **Backend** (`backend/src`): MAVLink parsing and streaming utilities.
- **Frontend** (`frontend/src`): 3D visualization logic and UI.
- **Wiki** (`wiki/`): Additional developer documentation (dataflow, scenes).
- **Scripts** (root): Helper scripts for running SITL and the web server.

---

## Requirements

- **OS**: Linux (scripts are `.sh` and project is developed/tested on Linux).
- **Node.js**: LTS version (e.g. 18.x or later).
- **npm** or **yarn**.
- **MAVLink data source**:
  - ArduPilot SITL or a real autopilot streaming MAVLink over UDP.

---

## Using via npm (CLI)

You can run Mavlink3DMap without cloning the repository by using the published npm package `mavlink3dmap`.  
This single CLI package can:

- Serve the web UI
- Run the UDP → WebSocket bridge
- (Linux only) Stream video frames to a `v4l2loopback` virtual camera via `ffmpeg`

### Quick usage (no install)

Use `npx` to run directly:

```bash
# Start everything: web UI + UDP→WS bridge
npx mavlink3dmap up --port 8080 --udp-port 16450

# Serve the built web UI only
npx mavlink3dmap serve -p 8080

# Run only the UDP→WebSocket bridge (WS on 8811)
npx mavlink3dmap udp2ws --udp-port 16450
```

### Install globally

```bash
npm i -g mavlink3dmap
```

### Usage

```bash
# Start everything: web UI + UDP→WS bridge
mavlink3dmap up --port 8080 --udp-port 16450

# Serve the built web UI only
mavlink3dmap serve -p 8080

# Run only the UDP→WebSocket bridge (WS on 8811)
mavlink3dmap udp2ws --udp-port 16450
```

---

## Code Installation

### 1. Clone the repository

```bash
git clone https://github.com/HefnySco/Mavlink3DMap.git
cd Mavlink3DMap
```

### 2. Install backend dependencies

If the backend has its own `package.json`:

```bash
cd backend
npm install
# or
yarn install
```

### 3. Install frontend dependencies

If the frontend has its own `package.json`:

```bash
cd ../frontend
npm install
# or
yarn install
```

If there is a root‑level dependency setup, follow the scripts defined in the root `package.json`.

---

## Running the Backend

The backend typically:

- Listens on a UDP port for MAVLink telemetry.
- Opens a WebSocket server for browser clients.

From the `backend` directory (or using root scripts if provided):

```bash
cd backend
npm start
# or a specific script, e.g.
# node src/udp2websocket.js
# node src/websocket_streaming.js
```

Check `backend/package.json` for the exact script names (`start`, `dev`, etc.), and adjust the command accordingly.

Configuration such as UDP port and WebSocket port is usually defined either:

- In environment variables, or  
- In the backend source files (e.g. `udp2websocket.js`, `websocket_streaming.js`).

---

## Running the Frontend

From the `frontend` directory:

```bash
cd frontend
npm start
# or
npm run dev
# or
npm run build && npm run serve
```

Refer to `frontend/package.json` for the exact commands.

Alternatively, you may use the provided root script (if configured that way):

```bash
cd <project-root>
./run_web.sh
```

This script typically:

- Builds/serves the frontend.
- Optionally starts a static server.

---

## Using with SITL (ArduPilot)

The repository includes convenience scripts and parameter files for SITL:

- **Scripts**:
  - `runSITLPlane.sh`
  - `runSITLQuad.sh`

- **Parameter files**:
  - `VTOL_TRI.parm`
  - `quadPlus_2.parm`

A typical workflow:

1. **Start SITL** with one of the provided scripts:

   ```bash
   ./runSITLPlane.sh
   # or
   ./runSITLQuad.sh
   ```

2. **Ensure SITL is configured** to stream MAVLink telemetry to the UDP port expected by `udp2websocket.js`.

3. **Start the backend** (UDP → WebSocket bridge).

4. **Start the frontend** and open it in a browser.

If needed, adjust SITL parameters and UDP endpoints so that the backend receives the telemetry.

---

## Frontend Scenes and Views

The 3D visualization is broken into several components:

- `frontend/src/js/js_view.js`  
  Manages overall view logic, initializing the renderer, handling WebSocket connections, and orchestrating scenes.

- `frontend/src/js/js_world.js`  
  Contains world/environment‑level objects (ground, axes, skybox, etc., depending on scene implementation).

- `frontend/src/js/scenes/`  
  Contains specific 3D scene definitions. Each file typically:
  - Sets up cameras, lights, and meshes.
  - Defines update loops for vehicle pose and telemetry.

For more details, consult:

- `wiki/DEV_DATAFLOW.md` – data flow and architecture.
- `wiki/SCENES_GUIDE.md` – information about each scene and how to add new ones.

---

## Development Notes

- **Code style**:
  - Plain JavaScript in both frontend and backend.
  - Scenes are modular under `frontend/src/js/scenes`.

- **Extending the viewer**:
  - Add new scenes under `frontend/src/js/scenes`.
  - Add new telemetry fields into `mavlink.js` and forward them via `websocket_streaming.js` and frontend WebSocket handlers.
  - Modify `js_view.js` / `js_world.js` to integrate new visual elements.

- **Logging & debugging**:
  - Use browser DevTools for frontend console logs and network/WebSocket inspection.
  - Use `console.log` (or your logger of choice) in backend scripts for telemetry and connection debugging.

---

## Troubleshooting

- **No data in the 3D view**:
  - Verify SITL or flight controller is sending MAVLink to the correct UDP port.
  - Check that `udp2websocket.js` is running and that the WebSocket server is reachable.
  - Confirm the frontend is connecting to the correct WebSocket URL (hostname, port, protocol).

- **Frontend cannot connect to WebSocket**:
  - Check backend logs for errors.
  - Ensure ports are open and not blocked by firewall.
  - Confirm that the URL used in `js_view.js` or related config matches the backend address.

- **Performance issues**:
  - Reduce the number of rendered objects in the active scene.
  - Throttle update frequency from backend if very high.

---

## License

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of this software and any derivative works, for any purpose, including commercial and non‑commercial use.

The only conditions are:

- **Attribution**:  
  Any use, redistribution, or derivative work must clearly mention the original project and author, for example:  
  “Based on the Mavlink3DMap project by Mohammad Hefny(mhefny@github.com).”

- **No Liability / No Warranty**:  
  This software is provided “as is”, without any warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non‑infringement.  
  In no event shall the author or copyright holder be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

By using this software, you agree that the author is **not responsible** for how you use this system or for any consequences of its use.