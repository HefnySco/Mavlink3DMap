#!/usr/bin/env node
if (process.platform !== 'linux') {
    console.error('Error: mav3d-stream is supported only on Linux.');
    process.exit(1);
}

//node ./websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 801x600 -i - -pix_fmt yuv420p -f v4l2 /dev/video1

const WebSocket = require('ws');

// Optimization: Disable perMessageDeflate since we are streaming pre-compressed JPEGs.
// This saves significant CPU and reduces latency.
const wss = new WebSocket.Server({ 
    port: 8081,
    perMessageDeflate: false
});

// Handle broken pipe (e.g., if ffmpeg stops) without crashing
process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') {
        process.exit(0);
    }
    console.error('Stdout error:', err);
});

wss.on('connection', ws => {
    // Log to stderr so we don't corrupt the image stream on stdout
    console.error('Client connected!');
    let frameCount = 0;

    ws.on('message', message => {
        // frameCount++;
        // if (frameCount % 30 === 0) {
        //     console.error(`[Backend] Processed ${frameCount} frames`);
        // }

        // Directly write binary buffer to stdout
        try {
            process.stdout.write(message);
        } catch (err) {
            // Ignore write errors if pipe is closed, mostly handled by stdout 'error' event
        }
    });

    ws.on('close', () => {
        console.error('Client disconnected!');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

console.error('WebSocket server started on port 8081');