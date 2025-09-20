//node ./websocket_streaming.js | ffmpeg -framerate 30 -f image2pipe -vcodec mjpeg -s 801x600 -i - -pix_fmt yuv420p -f v4l2 /dev/video1

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', ws => {
    console.log('Client connected!');
    ws.on('message', message => {
        // Here you would receive the binary data of each video frame.
        // In this simple example, we'll just forward it to stdout.
        process.stdout.write(message);
    });

    ws.on('close', () => {
        console.log('Client disconnected!');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

console.log('WebSocket server started on port 8081');