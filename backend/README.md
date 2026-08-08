# mavlink3dmap

Single-package CLI that serves the MAVLink 3D Map web UI, runs the UDP→WebSocket bridge, and (optionally, Linux-only) forwards video frames to a v4l2loopback device using ffmpeg.

For DroneEngage setups, the DroneEngage WebConnector now includes a built-in MAVLink hub on port 8811, so the separate WebSocket↔WebSocket bridge (`ws2ws`) is no longer needed — Mavlink3DMap2's frontend connects directly to the WebConnector's :8811 port. The `ws2ws` and `de` commands are still available for standalone use without the WebConnector.

## Install

- npx (no install):
  - `npx mavlink3dmap up --port 8080 --udp-port 16450`
  - `npx mavlink3dmap serve -p 8080`
  - `npx mavlink3dmap de --port 8080 --port-a 8811 --port-b 8812`
- or global:
  - `npm i -g mavlink3dmap`

## Commands

- `npx mavlink3dmap serve [-p 8080]`
  - Serves the built web UI (default port 8080)
- `npx mavlink3dmap udp2ws [--udp-port 16450]`
  - Runs the UDP→WebSocket bridge (websocket at 8811)
- `npx mavlink3dmap ws2ws [--port-a 8811] [--port-b 8812]`
  - Runs the WebSocket↔WebSocket bridge between two WS ports (defaults 8811 and 8812)
  - **Note:** When using the DroneEngage WebConnector, this is not needed — the WebConnector
    provides a MAVLink hub on :8811 directly. See "DroneEngage Integration" below.
- `npx mavlink3dmap stream`
  - Linux only. Starts streaming WS (8081) and pipes frames to v4l2loopback via ffmpeg
  - First time, create the virtual device: `sudo bash backend/src/create_virtual_video_linux.sh`
- `npx mavlink3dmap up [--port 8080] [--udp-port 16450] [--stream]`
  - Starts web UI and UDP bridge together; with `--stream` also starts streaming on Linux.
- `npx mavlink3dmap de [--port 8080] [--port-a 8811] [--port-b 8812]`
  - Starts the web UI and WebSocket↔WebSocket bridge together (no UDP bridge).
  - Internally equivalent to running `serve` and `ws2ws` with the same port options.
  - **Note:** When using the DroneEngage WebConnector, prefer `serve` instead of `de`
    since the WebConnector already provides the MAVLink hub on :8811.

Aliases (after global install): you can use `mav3d ...` instead of `npx mavlink3dmap ...`.

## Ports

- Web server: 8080
- WebSocket bridge (udp2ws): 8811
- WebSocket bridge (ws2ws / de): 8811 (A) and 8812 (B) by default
- Streaming WS: 8081 (Linux only)

> **DroneEngage note:** When using the DroneEngage WebConnector, port 8811 is
> provided by the WebConnector's MAVLink hub. Do not also run `ws2ws` or `de`
> — that would conflict on port 8811. Use `serve` to start only the web UI.

## DroneEngage Integration

When using the [DroneEngage WebConnector](https://github.com/DroneEngage/droneengage_webclient_react/tree/master/webconnector),
the WebConnector extracts raw MAVLink from Andruav binary frames and serves
them on `ws://127.0.0.1:8811`. Mavlink3DMap2's frontend already defaults to
this URL, so no configuration change is needed.

### Setup with WebConnector

```bash
# Terminal 1: Start the WebConnector (provides :9212 for webclient, :8811 for MAVLink)
droneengage-webconnector

# Terminal 2: Start Mavlink3DMap2 web UI only (no bridge needed)
npx mavlink3dmap serve -p 8080

# (Optional) Terminal 3: Start video streaming to /dev/videoX (Linux only)
npx mavlink3dmap stream
```

The frontend at `http://localhost:8080` connects to `ws://127.0.0.1:8811`
and receives MAVLink telemetry directly from the WebConnector. No browser
tab running the WebClient is required for the 3D map to display telemetry.

### Setup without WebConnector (standalone)

```bash
# Option A: UDP source (e.g. SITL / Mission Planner)
npx mavlink3dmap up --port 8080 --udp-port 16450

# Option B: WebSocket↔WebSocket bridge (legacy)
npx mavlink3dmap de --port 8080 --port-a 8811 --port-b 8812
```

## Environment

- Node.js 18+
- For streaming on Linux: `ffmpeg` and `v4l2loopback`

## License

MIT
