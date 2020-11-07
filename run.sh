#!/bin/bash

xterm -title "UDP2WebSocket"  -e "node udp2websocket.js" &

pushd static

xterm -title "Mavlink3DMap"  -e "http-server -c0 -p 9080" &

popd
