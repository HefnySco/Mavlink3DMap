#!/bin/bash

# Find camera named DE-SIM1
FIRST_VIDEO_DEVICE=""
for syspath in /sys/devices/virtual/video4linux/video*; do
    if [ -d "$syspath" ]; then
        # Get the device node name (e.g., video1)
        dev_node=$(basename "$syspath")
        # Read the label assigned to this virtual device
        label=$(cat "$syspath/name")
        
        printf "/dev/%-8s : %s\n" "$dev_node" "$label"
        
        # Check if this is the DE-SIM1 camera
        if [ "$label" = "DE-SIM1" ]; then
            FIRST_VIDEO_DEVICE="$dev_node"
            break
        fi
    fi
done

if [ -z "$FIRST_VIDEO_DEVICE" ]; then
  echo "Error: No camera named SIM-1 found in /sys/devices/virtual/video4linux/"
  exit 1
fi
VIDEO_DEVICE="/dev/$FIRST_VIDEO_DEVICE"

# Run UDP2WebSocket in a new xterm
xterm -title "UDP2WebSocket" -e "node ./backend/src/udp2websocket.js" &

# Run WebSocket Streaming and redirect to the first virtual video device
xterm -title "WebSocket Streaming" -e "node ./backend/src/websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 940x486 -i - -pix_fmt yuv420p -f v4l2 $VIDEO_DEVICE" &

# Navigate to frontend and start the development server
pushd frontend
npm run dev
popd