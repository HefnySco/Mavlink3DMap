#!/bin/bash

xterm -title "UDP2WebSocket" -e "node ./backend/src/udp2websocket.js" &


pushd frontend
npm run dev
popd
