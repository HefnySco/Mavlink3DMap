# Data Flow: UDP → WebSocket → Web (and Streaming)

This document explains how telemetry and video data move through the system across backend and frontend components.

## Overview

- Telemetry path (binary MAVLink):
  - UDP (from SITL or ground station)
  - Backend UDP client parses MAVLink
  - Backend WebSocket server broadcasts to browser
  - Frontend consumes telemetry and renders 3D scene

- Streaming path (video frames):
  - Frontend publishes frames over a WebSocket
  - Backend streaming server writes frames to stdout
  - ffmpeg consumes stdout and writes to a virtual video device (Linux)

## Components and Ports

- UDP listener: configurable (default 16450)
- Telemetry WebSocket server: `127.0.0.1:8811` (binary messages)
- Streaming WebSocket server: `0.0.0.0:8081` (binary frames → stdout)

## Telemetry Path (SITL → Browser)

1) UDP → Backend (udp2websocket)
- File: `backend/src/udp2websocket.js`
- Responsibilities:
  - Parse CLI args (commander), set `udp_target_port` (default 16450)
  - Start UDP server and WebSocket server
  - Glue callbacks between UDP and WebSocket

2) MAVLink parsing
- File: `backend/src/mavlink.js`
- Responsibilities:
  - Exposes `MAVLink20Processor` and message types
  - UDP payloads are parsed to MAVLink messages (e.g., HEARTBEAT, ATTITUDE, LOCAL_POSITION_NED)
  - Parsed messages are forwarded for broadcast

3) WebSocket broadcast (telemetry)
- File: `backend/src/websocket.js`
- Responsibilities:
  - Start a WebSocket server at `127.0.0.1:8811`
  - Maintain the active client socket
  - Expose `sendMessageBinary(message)` for binary frames/messages to the browser

4) Frontend consumption
- Files: `frontend/src/js/js_websocket.js`, `frontend/src/index_4w.js`, `frontend/src/js/js_world.js`, `frontend/src/js/js_view.js`
- Responsibilities:
  - Connect to `ws://127.0.0.1:8811`
  - Parse incoming binary messages as MAVLink
  - Update world state (vehicle pose, attitude, etc.)
  - Render the scene via Three.js views/cameras

Sequence (telemetry):
```
SITL/GS → UDP port 16450 → udpclient → MAVLink20Processor → websocket.sendMessageBinary →
Browser (js_websocket) → world/view update → Three.js render
```

## Streaming Path (Frontend → ffmpeg → v4l2)

1) Frontend → Streaming WebSocket
- The frontend (e.g., a camera or canvas capture) encodes frames (e.g., MJPEG) and sends binary frames to `ws://<host>:8081`.

2) Backend streaming server → stdout
- File: `backend/src/websocket_streaming.js`
- Responsibilities:
  - Start WebSocket server on port 8081
  - For each `message` (binary frame), write to `process.stdout`
  - Log client connect/disconnect

3) ffmpeg → virtual video device
- The backend script is typically piped to ffmpeg:
```
node ./backend/src/websocket_streaming.js \
  | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 940x486 -i - \
           -pix_fmt yuv420p -f v4l2 /dev/videoX
```
- The dev script auto-detects a device by scanning `/sys/devices/virtual/video4linux/` and uses the first one.

Sequence (streaming):
```
Frontend frames → WebSocket 8081 → websocket_streaming (stdout) → ffmpeg → /dev/videoX (v4l2)
```

## Runtime Commands

- Telemetry + frontend (no streaming):
```
npm start         # alias for npm run dev
```

- Telemetry + streaming + frontend:
```
npm run devall
```

- Backend only:
```
npm run -w backend dev:udp     # UDP bridge only
npm run -w backend dev         # UDP bridge + streaming pipeline (with ffmpeg)
```

## Error Handling and Notes

- If no virtual video device exists, streaming pipeline will print an error and exit.
- Telemetry WebSocket only has a single active client (`websocket.js` tracks the last connection as active).
- Ports can be adjusted in `udp2websocket.js` and frontend connection code if needed.

## Extending the Pipeline

- Additional frontend metrics/messages can be embedded in the telemetry stream (MAVLink custom messages) or sent over a separate channel.
- To support multiple streaming consumers, replace single stdout with a broadcasting mechanism or switch to an RTP/RTSP/UDS sink in ffmpeg.
- To support Windows/macOS, consider alternative sinks (file output, window preview) or OS-specific virtual camera drivers.
