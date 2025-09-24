import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { targetFps } from './js_config.js';

class C_View {
    constructor(p_world, p_canvas, p_XZero, p_YZero, isStreamable = false) {

        this.m_world = p_world;
        this.m_canvas = p_canvas;
        this.v_droneIndex = 0;
        this.m_view_selected_camera = null;
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

        this.m_view_selected_camera = this.m_main_camera;
        
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
        this.m_world.v_selectedView = this;

        // New: Remove 'selected' class from all containers
        const containers = document.querySelectorAll('.map3D_container');
        containers.forEach(container => container.classList.remove('selected'));

        // New: Add 'selected' class to the clicked container
        event.currentTarget.parentNode.classList.add('selected');
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

    fn_selectWorldCamera() {
        this.m_view_selected_camera = this.m_main_camera;
    }

    fn_handleCameraSwitch(event) {
        const c_keyLength = this.m_world.m_objects_attached_cameras.length;
        if (c_keyLength == 0) return;

        switch (event.keyCode) {
            case 65: /*A*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, 0.1);
                break;

            case 68: /*D*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, -0.1);
                break;

            case 69: /*E*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(-0.1, 0, 0);
                break;

            case 72: /*H*/
                if (this.m_main_camera == null) break;
                this.m_main_camera.lookAt(0.0, 0, 0.1);
                break;

            case 79: /*O*/
                this.m_world.fn_setCameraHelperEnabled(this.v_droneIndex, false);

                this.v_droneIndex += 1;
                this.v_droneIndex = this.v_droneIndex % c_keyLength;
                if (this.m_world.m_objects_attached_cameras[this.v_droneIndex].m_cameraThree != null) {
                    this.m_view_selected_camera = this.m_world.m_objects_attached_cameras[this.v_droneIndex].m_cameraThree;
                    this.m_world.fn_setCameraHelperEnabled(this.v_droneIndex, true);
                } else {
                    this.m_view_selected_camera = this.m_world.m_objects_attached_cameras[this.v_droneIndex];
                }
                break;

            case 80: /*P*/
                this.m_world.fn_setCameraHelperEnabled(this.v_droneIndex, false);

                this.v_droneIndex -= 1;
                if (this.v_droneIndex < 0) this.v_droneIndex = c_keyLength - 1;
                if (this.m_world.m_objects_attached_cameras[this.v_droneIndex].m_cameraThree != null) {
                    this.m_view_selected_camera = this.m_world.m_objects_attached_cameras[this.v_droneIndex].m_cameraThree;
                    this.m_world.fn_setCameraHelperEnabled(this.v_droneIndex, true);
                } else {
                    this.m_view_selected_camera = this.m_world.m_objects_attached_cameras[this.v_droneIndex];
                }
                break;

            case 81: /*Q*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.1, 0, 0);
                break;

            case 82: /*R*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraOrientation(0.0, 0, 0);
                break;

            case 83: /*S*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, -0.1, 0);
                break;
            
            case 87: /*W*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, 0.1, 0);
                break;

            case 112: /*F1*/
                const helpDlg = document.getElementById('help_dlg');
                helpDlg.style.display = helpDlg.style.display === 'none' ? 'block' : 'none';
                event.preventDefault();
                break;
        }
    };

    // Render method (call this per frame from C_World.fn_animate)
    fn_render() {
        const c_renderer = this.renderer;

        if (!this.renderer) {
            console.error('Renderer is undefined in C_View.fn_render');
            return;
        }

        const c_world = this.m_world;
        const canvas = this.m_canvas;
        c_renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
        c_renderer.setScissor(0, 0, canvas.clientWidth, canvas.clientHeight);
        c_renderer.setScissorTest(true);

        if (this.fn_resizeRendererToDisplaySize()) {
            this.m_view_selected_camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.m_view_selected_camera.updateProjectionMatrix();
        }

        c_renderer.render(c_world.v_scene, this.m_view_selected_camera);
        this.v_context.drawImage(c_renderer.domElement, 0, 0);

        c_world.fn_setCameraHelperEnabled(this.v_droneIndex, c_world.m_global_camera_helper );

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

        c_renderer.setScissorTest(false);
    }
}

export default C_View;




