# mavlink3dmap

Single-package CLI that serves the MAVLink 3D Map web UI, runs the UDP→WebSocket bridge, and (optionally, Linux-only) forwards video frames to a v4l2loopback device using ffmpeg.

## Install

- npx (no install):
  - `npx mavlink3dmap up --port 8080 --udp-port 16450`
  - `npx mavlink3dmap serve -p 8080`
- or global:
  - `npm i -g mavlink3dmap`

## Commands

- `npx mavlink3dmap serve [-p 8080]`
  - Serves the built web UI (default port 8080)
- `npx mavlink3dmap udp2ws [--udp-port 16450]`
  - Runs the UDP→WebSocket bridge (websocket at 8811)
- `npx mavlink3dmap ws2ws [--port-a 8811] [--port-b 8812]`
  - Runs the WebSocket↔WebSocket bridge between two WS ports (defaults 8811 and 8812)
- `npx mavlink3dmap stream`
  - Linux only. Starts streaming WS (8081) and pipes frames to v4l2loopback via ffmpeg
  - First time, create the virtual device: `sudo bash backend/src/create_virtual_video_linux.sh`
- `npx mavlink3dmap up [--port 8080] [--udp-port 16450] [--stream]`
  - Starts web UI and UDP bridge together; with `--stream` also starts streaming on Linux.

Aliases (after global install): you can use `mav3d ...` instead of `npx mavlink3dmap ...`.

## Ports

- Web server: 8080
- WebSocket bridge (udp2ws): 8811
- WebSocket bridge (ws2ws): 8811 (A) and 8812 (B) by default
- Streaming WS: 8081 (Linux only)

## Environment

- Node.js 18+
- For streaming on Linux: `ffmpeg` and `v4l2loopback`

## License

MIT
