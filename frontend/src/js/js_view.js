import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {targetFps} from './js_config.js';

class C_View {
    constructor(p_world, p_canvas, p_XZero, p_YZero, isStreamable = false) {

        this.p_world = p_world;
        this.m_canvas = p_canvas;
        this.v_droneIndex = 0;
        this.v_localCameras = [];
        this.v_localActiveCamera = null;
        this.isStreamable = isStreamable;
        this.ws = null;
       
        this.m_skip = 0;
        this.targetFps = targetFps; // Target streaming FPS
        this.sendInterval = Math.ceil(60 / this.targetFps); // e.g., 2 for 30 FPS at 60Hz render

        // Set canvas dimensions
        this.m_canvas.width = p_canvas.clientWidth * window.devicePixelRatio;
        this.m_canvas.height = p_canvas.clientHeight * window.devicePixelRatio;

        this.v_context = p_canvas.getContext('2d');

        // Use shared renderer from C_World
        this.renderer = p_world.renderer;

        this.m_main_camera = new THREE.PerspectiveCamera(
            75, // FOV
            p_canvas.width / p_canvas.height, // Aspect Ratio
            0.1, // Near Clipping Plane
            5000 // Far Clipping Plane
        );

        this.v_localActiveCamera = this.m_main_camera;
        this.v_localCameras.push(this.m_main_camera);

        this.m_main_camera.position.set(5, 5, 0);
        this.m_main_camera.lookAt(new THREE.Vector3(p_XZero + 0, 0, p_YZero + 0));

        this.m_main_camera.m_controls = new OrbitControls(this.m_main_camera, p_canvas);


        // Event listeners
        this.fn_onMouseDown = this.fn_onMouseDown.bind(this);
        this.fn_onMouseDoubleClick = this.fn_onMouseDoubleClick.bind(this);
        this.m_canvas.addEventListener('click', this.fn_onMouseDown, false);
        this.m_canvas.addEventListener('dblclick', this.fn_onMouseDoubleClick, false);

        // If streamable, initialize WebSocket
        try {
            if (this.isStreamable) {
                this.initWebSocket();
            }
        }
        catch (e) {

        }
    }

    initWebSocket() {
        try {
            this.ws = new WebSocket('ws://localhost:8081');
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('Streaming WebSocket connected');
            };

            this.ws.onclose = () => {
                console.log('Streaming WebSocket closed');
            };

            this.ws.onerror = (error) => {
                console.error('Streaming WebSocket error:', error);
            };
        }
        catch (e) {
            return;
        }
    }


    // Stub for downloadImage function (used in onMouseDoubleClick)
    downloadImage(dataURL, filename) {
        console.warn(`downloadImage not implemented: would save ${filename} from ${dataURL}`);
        // Implement if needed: e.g., create a link element to trigger download
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        link.click();
    }

    fn_onMouseDown(event) {
        event.preventDefault();
        this.p_world.v_eventMouseClick = event;
        this.p_world.v_selectedView = this;
    };

    fn_onMouseDoubleClick(event) {
        event.preventDefault();
        var dataURL = event.currentTarget.toDataURL();
        var v_image_counter = new Date();
        this.downloadImage(dataURL, 'image' + v_image_counter.getSeconds() + '_' + v_image_counter.getMilliseconds() + '.png');
    };


    fn_resizeRendererToDisplaySize(renderer) {
        if (!this.renderer) {
            console.error('Renderer is undefined in C_View.fn_resizeRendererToDisplaySize');
            return false;
        }
        const canvas = this.m_canvas;
        const width = canvas.clientWidth * window.devicePixelRatio;
        const height = canvas.clientHeight * window.devicePixelRatio;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            canvas.width = width;
            canvas.height = height;
        }
        return needResize;
    };

    fn_selectWorldCamera()
    {
        this.v_localActiveCamera = this.v_localCameras[0];
    }

    fn_setCameraHelperEnabled(droneIndex, enable)
    {
if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localCameras[this.v_droneIndex].fn_setCameraHelperEnabled(enable);
                }
    }

    fn_handleCameraSwitch(event) {
        const c_keyLength = this.v_localCameras.length;
        if (c_keyLength == 0) return;

        switch (event.keyCode) {
            case 112: /*F1*/
                const helpDlg = document.getElementById('help_dlg');
                helpDlg.style.display = helpDlg.style.display === 'none' ? 'block' : 'none';
                event.preventDefault();
                break;

            case 79: /*O*/
                this.fn_setCameraHelperEnabled(this.v_droneIndex, false);
                
                if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localCameras[this.v_droneIndex].fn_setCameraHelperEnabled(false);
                }
                this.v_droneIndex += 1;
                this.v_droneIndex = this.v_droneIndex % c_keyLength;
                if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex].m_cameraThree;
                    this.fn_setCameraHelperEnabled(this.v_droneIndex, true);
                } else {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex];
                }
                break;

            case 80: /*P*/
                this.fn_setCameraHelperEnabled(this.v_droneIndex, false);
                
                this.v_droneIndex -= 1;
                if (this.v_droneIndex < 0) this.v_droneIndex = c_keyLength - 1;
                if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex].m_cameraThree;
                    this.fn_setCameraHelperEnabled(this.v_droneIndex, true);
                } else {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex];
                }
                break;

            case 87: /*W*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, 0.1, 0);
                break;

            case 83: /*S*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, -0.1, 0);
                break;

            case 69: /*E*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(-0.1, 0, 0);
                break;

            case 81: /*Q*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.1, 0, 0);
                break;

            case 68: /*D*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, -0.1);
                break;

            case 65: /*A*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, 0.1);
                break;

            case 72: /*H*/
                if (this.m_main_camera == null) break;
                this.m_main_camera.lookAt(0.0, 0, 0.1);
                break;

            case 82: /*R*/
                if (this.v_localActiveCamera.userData.m_ownerObject == null) break;
                this.v_localActiveCamera.userData.m_ownerObject.fn_setCameraOrientation(0.0, 0, 0);
                break;
        }
    };

    // Render method (call this per frame from C_World.fn_animate)
    fn_render() {
    if (!this.renderer) {
        console.error('Renderer is undefined in C_View.fn_render');
        return;
    }

    const canvas = this.m_canvas;
    this.renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.renderer.setScissor(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.renderer.setScissorTest(true);

    if (this.fn_resizeRendererToDisplaySize()) {
        this.v_localActiveCamera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.v_localActiveCamera.updateProjectionMatrix();
    }

    this.renderer.render(this.p_world.v_scene, this.v_localActiveCamera);
    this.v_context.drawImage(this.renderer.domElement, 0, 0);

    // Optional: Cap resolution for streaming to reduce bandwidth
    // const streamWidth = 640;
    // const streamHeight = 480;
    // const tempCanvas = document.createElement('canvas');
    // tempCanvas.width = streamWidth;
    // tempCanvas.height = streamHeight;
    // const tempCtx = tempCanvas.getContext('2d');
    // tempCtx.drawImage(canvas, 0, 0, streamWidth, streamHeight);
    // Use tempCtx.canvas instead of this.v_context.canvas below if enabled

    // Send JPEG every N frames for ~30 FPS
    this.m_skip++;
    if (this.m_skip % this.sendInterval === 0 && this.isStreamable && this.ws?.readyState === WebSocket.OPEN) {
        this.v_context.canvas.toBlob((blob) => {
            if (blob) {
                const reader = new FileReader();
                reader.onload = () => this.ws.send(reader.result); // Binary JPEG
                reader.readAsArrayBuffer(blob);
            }
        }, 'image/jpeg', 0.8); // 80% quality; adjust 0.5-0.9 for size vs. quality
    }

    this.renderer.setScissorTest(false);
}
}

export default C_View;




