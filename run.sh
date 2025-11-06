#!/bin/bash

# Find the first virtual video device
FIRST_VIDEO_DEVICE=$(ls /sys/devices/virtual/video4linux/ | head -n 1)
if [ -z "$FIRST_VIDEO_DEVICE" ]; then
  echo "Error: No virtual video devices found in /sys/devices/virtual/video4linux/"
  exit 1
fi
VIDEO_DEVICE="/dev/$FIRST_VIDEO_DEVICE"

# Run UDP2WebSocket in a new xterm
xterm -title "UDP2WebSocket" -e "node ./backend/src/udp2websocket.js" &

# Run WebSocket Streaming and redirect to the first virtual video device
xterm -title "WebSocket Streaming" -e "node ./backend/src/websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 800x600 -i - -pix_fmt yuv420p -f v4l2 $VIDEO_DEVICE" &

# Navigate to frontend and start the development server
pushd frontend
npm run dev
popd