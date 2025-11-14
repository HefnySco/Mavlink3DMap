#!/usr/bin/env node
"use strict";

const { program } = require("commander");
const path = require("path");
const { spawn } = require("child_process");
const { startServer } = require("./server");
const pkg = require("../package.json");

program
  .name("mav3d")
  .description("Mavlink3DMap CLI")
  .version(pkg.version);

program
  .command("serve")
  .description("Serve the web UI (static frontend)")
  .option("-p, --port <port>", "Web server port", "8080")
  .action((opts) => {
    const port = parseInt(opts.port, 10) || 8080;
    startServer({ port });
  });

program
  .command("udp2ws")
  .description("Run the UDP to WebSocket bridge (port 8811)")
  .option("--udp-port <port>", "MAVLink UDP target port", "16450")
  .action((opts) => {
    const args = ["./src/udp2websocket.js", "-p", String(opts.udpPort || opts.udpport || opts["udp-port"])];
    spawn(process.execPath, args, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  });

program
  .command("stream")
  .description("Run streaming WebSocket (8081) and pipe frames to v4l2loopback using ffmpeg (Linux only)")
  .option("--width <w>", "Frame width", "940")
  .option("--height <h>", "Frame height", "486")
  .option("--label <name>", "v4l2loopback card label", "SIM-CAM1")
  .action((opts) => {
    if (process.platform !== "linux") {
      console.error("Error: streaming is supported only on Linux");
      process.exit(1);
    }
    const width = parseInt(opts.width, 10) || 940;
    const height = parseInt(opts.height, 10) || 486;
    const size = `${width}x${height}`;

    const cmd = `GREEN=\\033[1;32m; YELLOW=\\033[1;33m; RESET=\\033[0m; TARGET_LABEL=${opts.label}; DEV=$(grep -l \"^$TARGET_LABEL$\" /sys/class/video4linux/*/name 2>/dev/null | head -n 1 | sed -E \"s#.*/(video[0-9]+)/name#\\1#\"); if [ -z \"$DEV\" ]; then echo \"Error: Device with label $TARGET_LABEL not found\"; exit 1; fi; VIDEO_DEVICE=\"/dev/$DEV\"; echo \"=======\"; echo -e \"$GREEN[mav3d] WebSocket streaming on ws://localhost:8081 -> $VIDEO_DEVICE$RESET\"; echo -e \"$YELLOW[mav3d] View with: ffplay $VIDEO_DEVICE$RESET\"; echo \"=======\"; node ./src/websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s ${size} -i - -pix_fmt yuv420p -f v4l2 \"$VIDEO_DEVICE\"`;

    spawn("sh", ["-c", cmd], { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  });

program
  .command("up")
  .description("Start web UI and UDP bridge together. Add --stream on Linux to include streaming.")
  .option("-p, --port <port>", "Web server port", "8080")
  .option("--udp-port <port>", "MAVLink UDP target port", "16450")
  .option("--stream", "Enable Linux-only streaming pipeline")
  .action((opts) => {
    // Start server
    const port = parseInt(opts.port, 10) || 8080;
    startServer({ port });

    // Start udp bridge
    const udpArgs = ["./src/udp2websocket.js", "-p", String(opts.udpPort || opts.udpport || opts["udp-port"])];
    spawn(process.execPath, udpArgs, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });

    if (opts.stream) {
      if (process.platform !== "linux") {
        console.error("--stream is Linux-only");
        return;
      }
      const cmd = `TARGET_LABEL=SIM-CAM1; DEV=$(grep -l "^$TARGET_LABEL$" /sys/class/video4linux/*/name 2>/dev/null | head -n 1 | sed -E "s#.*/(video[0-9]+)/name#\\1#"); if [ -z "$DEV" ]; then echo "Error: Device with label $TARGET_LABEL not found"; exit 1; fi; VIDEO_DEVICE="/dev/$DEV"; node ./src/websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 940x486 -i - -pix_fmt yuv420p -f v4l2 "$VIDEO_DEVICE"`;
      spawn("sh", ["-c", cmd], { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
    }
  });

program.parse(process.argv);
