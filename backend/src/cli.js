#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { program } = require("commander");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { startServer } = require("./server");
const pkg = require("../package.json");

const DEFAULT_LOOPBACK_LABEL = "SIM-CAM1";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.resolve(__dirname, "create_virtual_video_linux.sh");
const VIDEO_CLASS_PATH = "/sys/class/video4linux";

const findVideoDeviceByLabel = (label) => {
  try {
    const entries = fs.readdirSync(VIDEO_CLASS_PATH, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.name.startsWith("video")) {
        continue;
      }
      const namePath = path.join(VIDEO_CLASS_PATH, entry.name, "name");
      try {
        const content = fs.readFileSync(namePath, "utf8").trim();
        if (content === label) {
          return path.join("/dev", entry.name);
        }
      } catch (readErr) {
        // Ignore files we cannot read and continue scanning.
      }
    }
  } catch (err) {
    // If the class path is not accessible we return null and handle later.
  }
  return null;
};

const ensureVideoDevice = (label = DEFAULT_LOOPBACK_LABEL) => {
  const targetLabel = label || DEFAULT_LOOPBACK_LABEL;
  let videoDevice = findVideoDeviceByLabel(targetLabel);
  if (videoDevice) {
    return { videoDevice, created: false, label: targetLabel };
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return {
      error: `Error: ${SCRIPT_PATH} not found. Unable to create video device.`,
      exitCode: 1,
      label: targetLabel,
    };
  }

  console.log(`[mav3d] Attempting to create virtual video device with label '${targetLabel}'...`);
  const result = spawnSync("bash", [SCRIPT_PATH], {
    stdio: "inherit",
    cwd: PROJECT_ROOT,
  });

  if (result.status !== 0) {
    return {
      error: "Error: Failed to create virtual video device.",
      exitCode: result.status ?? 1,
      label: targetLabel,
    };
  }

  videoDevice = findVideoDeviceByLabel(targetLabel);

  if (!videoDevice) {
    return {
      error: `Error: Device with label ${targetLabel} not found even after attempting creation.`,
      exitCode: 1,
      label: targetLabel,
    };
  }

  return { videoDevice, created: true, label: targetLabel };
};

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
  .command("ws2ws")
  .description("Run WebSocket-to-WebSocket bridge (default ports 8811 and 8812)")
  .option("--port-a <port>", "WebSocket server A port", "8811")
  .option("--port-b <port>", "WebSocket server B port", "8812")
  .action((opts) => {
    const portA = String(opts.portA || opts.porta || opts["port-a"] || "8811");
    const portB = String(opts.portB || opts.portb || opts["port-b"] || "8812");
    const args = [
      "./src/websocket_bridge.js",
      "-a",
      portA,
      "-b",
      portB,
    ];
    spawn(process.execPath, args, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  });

program
  .command("stream")
  .description("Run streaming WebSocket (8081) and pipe frames to v4l2loopback using ffmpeg (Linux only)")
  .option("--width <w>", "Frame width", "940")
  .option("--height <h>", "Frame height", "486")
  .option("--label <name>", "v4l2loopback card label", DEFAULT_LOOPBACK_LABEL)
  .action((opts) => {
    if (process.platform !== "linux") {
      console.error("Error: streaming is supported only on Linux");
      process.exit(1);
    }
    const label = opts.label || DEFAULT_LOOPBACK_LABEL;
    const width = parseInt(opts.width, 10) || 940;
    const height = parseInt(opts.height, 10) || 486;
    const size = `${width}x${height}`;

    const ensureResult = ensureVideoDevice(label);
    if (ensureResult.error) {
      console.error(ensureResult.error);
      process.exit(ensureResult.exitCode ?? 1);
    }

    const { videoDevice, created } = ensureResult;
    if (created) {
      console.log(`[mav3d] Virtual device ${videoDevice} ready.`);
    }

    const cmd = `GREEN=\x1b[1;32m; YELLOW=\x1b[1;33m; RESET=\x1b[0m; VIDEO_DEVICE="${videoDevice}"; echo "======="; echo -e "$GREEN[mav3d] WebSocket streaming on ws://localhost:8081 -> $VIDEO_DEVICE$RESET"; echo -e "$YELLOW[mav3d] View with: ffplay $VIDEO_DEVICE$RESET"; echo "======="; node ./src/websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s ${size} -i - -pix_fmt yuv420p -f v4l2 "$VIDEO_DEVICE"`;

    spawn("sh", ["-c", cmd], { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  });

program
  .command("loopback")
  .description("Ensure the SIM-CAM1 v4l2loopback device exists (Linux only)")
  .option("--label <name>", "v4l2loopback card label", DEFAULT_LOOPBACK_LABEL)
  .action((opts) => {
    if (process.platform !== "linux") {
      console.error("Error: loopback management is supported only on Linux");
      process.exit(1);
    }

    const label = opts.label || DEFAULT_LOOPBACK_LABEL;
    const result = ensureVideoDevice(label);

    if (result.error) {
      console.error(result.error);
      process.exit(result.exitCode ?? 1);
    }

    const { videoDevice, created } = result;
    if (created) {
      console.log(`[mav3d] Created virtual device ${videoDevice} with label '${label}'.`);
    } else {
      console.log(`[mav3d] Virtual device ${videoDevice} with label '${label}' already exists.`);
    }
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
      // Reuse the same streaming pipeline as the backend dev:stream script
      spawn("npm", ["run", "dev:stream"], { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
    }
  });


program
  .command("de")
  .description(
    "Serve the web UI and run WebSocket-to-WebSocket bridge (default ports 8811 and 8812)"
  )
  .option("-p, --port <port>", "Web server port", "8080")
  .option("--port-a <port>", "WebSocket server A port", "8811")
  .option("--port-b <port>", "WebSocket server B port", "8812")
  .action((opts) => {
    // Start HTTP server (same as `serve`)
    const port = parseInt(opts.port, 10) || 8080;
    startServer({ port });

    // Start WS-to-WS bridge (same as `ws2ws`)
    const portA = String(opts.portA || opts.porta || opts["port-a"] || "8811");
    const portB = String(opts.portB || opts.portb || opts["port-b"] || "8812");
    const args = [
      "./src/websocket_bridge.js",
      "-a",
      portA,
      "-b",
      portB,
    ];
    spawn(process.execPath, args, {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
  });


program.parse(process.argv);
