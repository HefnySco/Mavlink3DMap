# mavlink3dmap

Single-package CLI that serves the MAVLink 3D Map web UI, runs the UDP→WebSocket bridge, and (optionally, Linux-only) forwards video frames to a v4l2loopback device using ffmpeg.

## Install

- npx (no install):
  - `npx mavlink3dmap mav3d serve -p 8080`
- or global:
  - `npm i -g mavlink3dmap`

## Commands

- `mav3d serve [-p 8080]`
  - Serves the built web UI (default port 8080)
- `mav3d udp2ws [--udp-port 16450]`
  - Runs the UDP→WebSocket bridge (websocket at 8811)
- `mav3d stream`
  - Linux only. Starts streaming WS (8081) and pipes frames to v4l2loopback via ffmpeg
  - First time, create the virtual device: `sudo bash backend/src/create_virtual_video_linux.sh`
- `mav3d up [--port 8080] [--udp-port 16450] [--stream]`
  - Starts web UI and UDP bridge together; with `--stream` also starts streaming on Linux.

## Ports

- Web server: 8080
- WebSocket bridge (udp2ws): 8811
- Streaming WS: 8081 (Linux only)

## Environment

- Node.js 18+
- For streaming on Linux: `ffmpeg` and `v4l2loopback`

## License

MIT
