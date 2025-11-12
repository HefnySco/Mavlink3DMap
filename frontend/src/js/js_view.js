import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
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
        // IMPORTANT: Enforce EVEN pixel dimensions for the offscreen canvas.
        // Many downstream pipelines (ffmpeg -> v4l2loopback -> OpenCV YUV420) require
        // even width and height to avoid chroma-subsampling and SIMD alignment errors.
        // Keeping these even prevents distorted frames and cv::cvtColor assertions.
        const dpr = window.devicePixelRatio;
        const initW = Math.floor(p_canvas.clientWidth * dpr) & ~1;
        const initH = Math.floor(p_canvas.clientHeight * dpr) & ~1;
        this.m_canvas.width = initW;
        this.m_canvas.height = initH;

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
        this.m_main_camera.m_controls.enabled = true;
        this.m_activeControls = this.m_main_camera.m_controls;

        // Per-view controls map for shared attached cameras (by THREE.Camera reference)
        // This prevents different views from enabling/disabling the same shared controls instance.
        this.controlsByCamera = new Map();

        // Per-view selected drone (set when user presses 1..9 while this view is active)
        this.selectedDroneId = null;


        // Add CSS2DRenderer for this view
        this.labelRenderer = new CSS2DRenderer();
        const container = this.m_canvas.parentNode;
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.left = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.labelRenderer.domElement.className = `label-renderer-${p_canvas.id}`; // Unique class for debugging
        container.appendChild(this.labelRenderer.domElement);
        console.log(`Initialized CSS2DRenderer for canvas ${p_canvas.id}, container size: ${container.clientWidth}x${container.clientHeight}`);

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
        const dpr = window.devicePixelRatio;
        const widthRaw = canvas.clientWidth * dpr;
        const heightRaw = canvas.clientHeight * dpr;
        // IMPORTANT: Keep resized dimensions EVEN to maintain compatibility
        // with YUV420/NV12 encoders and v4l2 sinks that expect even sizes.
        const width = Math.floor(widthRaw) & ~1;
        const height = Math.floor(heightRaw) & ~1;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            canvas.width = width;
            canvas.height = height;
            this.renderer.setSize(width, height, false);
            const container = canvas.parentNode;
            this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        }
        return needResize;
    };

    fn_selectWorldCamera() {
        this.fn_setSelectedCamera(this.m_main_camera);
    }

    fn_handleCameraSwitch(event) {

        const speed = 0.5; // Adjust this for faster/slower movement

        const allCams = this.m_world.m_objects_attached_cameras;
        const c_keyLength = allCams.length;
        if (c_keyLength == 0) return;

        // Build the list to cycle: either cameras of selected drone, or all
        let cycleList = allCams;
        const selectedId = this.selectedDroneId;
        if (selectedId && this.m_world.v_drone && this.m_world.v_drone[selectedId]) {
            const selectedVehicle = this.m_world.v_drone[selectedId];
            cycleList = allCams.filter(ctrl => ctrl && ctrl.m_ownerObject === selectedVehicle);
            if (cycleList.length === 0) cycleList = allCams; // fallback if no attached cams found
        }

        switch (event.keyCode) {
            case 65: /*A*/
                if (this.m_view_selected_camera === this.m_main_camera) {
                    this.m_main_camera.translateX(-speed);
                    break;
                }
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.0, 0, 0.1);
                break;

            case 68: /*D*/
                if (this.m_view_selected_camera === this.m_main_camera) {
                    this.m_main_camera.translateX(speed);
                    break;
                }
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
                if (cycleList.length === 0) break;
                this.v_droneIndex = (this.v_droneIndex + 1) % cycleList.length;
                {
                    const ctrl = cycleList[this.v_droneIndex];
                    if (ctrl.m_cameraThree != null) {
                        this.fn_setSelectedCamera(ctrl.m_cameraThree);
                    } else {
                        this.fn_setSelectedCamera(ctrl);
                    }
                    try {
                        const cam = this.m_view_selected_camera;
                        if (cam === this.m_main_camera) {
                            this.fn_displayMessage('<b>Camera:</b> World', 1000);
                        } else {
                            const tag = cam?.userData?.m_ownerObject?.m_camera_tag || 'attached';
                            this.fn_displayMessage(`<b>Drone:</b>${this.selectedDroneId}<b>   Camera:</b>${tag}`, 1000);
                        }
                    } catch (_) { }
                }
                break;

            case 80: /*P*/
                if (cycleList.length === 0) break;
                this.v_droneIndex = (this.v_droneIndex - 1);
                if (this.v_droneIndex < 0) this.v_droneIndex = cycleList.length - 1;
                {
                    const ctrl = cycleList[this.v_droneIndex];
                    if (ctrl.m_cameraThree != null) {
                        this.fn_setSelectedCamera(ctrl.m_cameraThree);
                    } else {
                        this.fn_setSelectedCamera(ctrl);
                    }
                    try {
                        const cam = this.m_view_selected_camera;
                        if (cam === this.m_main_camera) {
                            this.fn_displayMessage('<b>Camera:</b> World', 1000);
                        } else {
                            const tag = cam?.userData?.m_ownerObject?.m_camera_tag || 'attached';
                            this.fn_displayMessage(`<b>Drone:</b>${this.selectedDroneId}<b>   Camera:</b>${tag}`, 1000);
                        }
                    } catch (_) { }
                }
                break;

            case 81: /*Q*/
                if (this.m_view_selected_camera === this.m_main_camera) {
                    this.m_main_camera.position.set(5, 5, 0);
                    this.m_main_camera.lookAt(new THREE.Vector3(0, 0, 0));
                    break;
                }
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0.1, 0, 0);
                break;

            case 82: /*R*/
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraOrientation(0.0, 0, 0);
                break;

            case 83: /*S*/
                if (this.m_view_selected_camera === this.m_main_camera) {
                    this.m_main_camera.translateZ(speed);
                    break;
                }
                if (this.m_view_selected_camera.userData.m_ownerObject == null) break;
                this.m_view_selected_camera.userData.m_ownerObject.fn_setCameraDeltaOrientation(0, -0.1, 0);
                break;

            case 87: /*W*/
                if (this.m_view_selected_camera === this.m_main_camera) {
                    this.m_main_camera.translateZ(-speed);
                    break;
                }
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
    if (!this.renderer) {
        console.error('Renderer is undefined in C_View.fn_render');
        return;
    }

    const canvas = this.m_canvas;
    const container = canvas.parentNode;

    // Set viewport and scissor for WebGL
    const width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.clientHeight * window.devicePixelRatio;
    this.renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.renderer.setScissor(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.renderer.setScissorTest(true);

    // Resize if needed
    if (this.fn_resizeRendererToDisplaySize()) {
        this.m_view_selected_camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.m_view_selected_camera.updateProjectionMatrix();
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    }

    // Render WebGL scene
    if (this.m_activeControls && this.m_activeControls.update) {
        // If follow-me attached camera is selected, keep orbit center locked to the drone
        const cam = this.m_view_selected_camera;
        if (cam && cam.userData && cam.userData.m_ownerObject) {
            const controller = cam.userData.m_ownerObject;
            const isFollowMe = controller && controller.m_camera_tag === 'followme';
            const owner = controller && controller.m_ownerObject;
            if (isFollowMe && owner && this.m_activeControls.target) {
                const { x, y, z } = owner.fn_translateXYZ();
                this.m_activeControls.target.set(x, y, z);
            }
        }
        this.m_activeControls.update();
    }
    this.renderer.render(this.m_world.v_scene, this.m_view_selected_camera);

    // Render CSS2D labels
    this.labelRenderer.render(this.m_world.v_scene, this.m_view_selected_camera);

    this.v_context.drawImage(this.renderer.domElement, 0, 0);

    this.m_world.fn_setCameraHelperEnabled(this.v_droneIndex, this.m_world.m_global_camera_helper);

    // Stream if enabled
    this.m_skip++;
    if (this.m_skip % this.sendInterval === 0 && this.isStreamable && this.ws?.readyState === WebSocket.OPEN) {
        this.v_context.canvas.toBlob((blob) => {
            if (blob) {
                const reader = new FileReader();
                reader.onload = () => this.ws.send(reader.result);
                reader.readAsArrayBuffer(blob);
            }
        }, 'image/jpeg', 0.8);
    }

    this.renderer.setScissorTest(false);
}
}

// Enable OrbitControls for the selected camera and disable them for the previously selected one
C_View.prototype.fn_setSelectedCamera = function (camera) {
    if (!camera) return;

    // Disable previous controls if any
    if (this.m_view_selected_camera) {
        if (this.m_view_selected_camera === this.m_main_camera) {
            if (this.m_main_camera.m_controls) this.m_main_camera.m_controls.enabled = false;
        } else {
            const prevCtrl = this.controlsByCamera.get(this.m_view_selected_camera);
            if (prevCtrl) prevCtrl.enabled = false;
        }
    }

    // If previous camera was an attached helper follow-me, decrement manual control ref count
    if (this.m_view_selected_camera && this.m_view_selected_camera.userData && this.m_view_selected_camera.userData.m_ownerObject) {
        const prevCtrlOwner = this.m_view_selected_camera.userData.m_ownerObject;
        const wasFollowMe = prevCtrlOwner && prevCtrlOwner.m_camera_tag === 'followme';
        if (wasFollowMe) {
            const ud = this.m_view_selected_camera.userData;
            ud.manualControlRefs = (ud.manualControlRefs || 0) - 1;
            if (ud.manualControlRefs < 0) ud.manualControlRefs = 0;
            ud.manualControl = ud.manualControlRefs > 0;
        } else {
            this.m_view_selected_camera.userData.manualControl = false;
        }
    }

    const isAttached = !!(camera.userData && camera.userData.m_ownerObject);
    const isFollowMe = isAttached && camera.userData.m_ownerObject.m_camera_tag === 'followme';

    // Ensure selectedDroneId is aligned with the attached camera's owner vehicle
    if (isAttached) {
        try {
            const controller = camera.userData.m_ownerObject;
            const owner = controller && controller.m_ownerObject;
            if (owner && this.m_world && this.m_world.v_drone) {
                const ids = Object.keys(this.m_world.v_drone);
                const foundId = ids.find(k => this.m_world.v_drone[k] === owner);
                if (foundId) {
                    this.selectedDroneId = foundId;
                }
            }
        } catch (_) { }
    }

    // Main (world) camera uses its own dedicated controls
    if (camera === this.m_main_camera) {
        if (!this.m_main_camera.m_controls) {
            this.m_main_camera.m_controls = new OrbitControls(this.m_main_camera, this.m_canvas);
        }
        this.m_main_camera.m_controls.enabled = true;
        this.m_activeControls = this.m_main_camera.m_controls;
    } else {
        // Attached drone cameras: keep OrbitControls per view
        let ctrl = this.controlsByCamera.get(camera);
        if (!ctrl) {
            ctrl = new OrbitControls(camera, this.m_canvas);
            this.controlsByCamera.set(camera, ctrl);
        }

        if (isFollowMe) {
            ctrl.enabled = true;
            this.m_activeControls = ctrl;
            const ud = camera.userData;
            ud.manualControlRefs = (ud.manualControlRefs || 0) + 1;
            ud.manualControl = ud.manualControlRefs > 0;
            try {
                const controller = camera.userData.m_ownerObject;
                const owner = controller && controller.m_ownerObject;
                if (owner && this.m_activeControls && this.m_activeControls.target) {
                    const { x, y, z } = owner.fn_translateXYZ();
                    this.m_activeControls.target.set(x, y, z);
                }
            } catch (_) { }
        } else {
            // Front/down cameras: no mouse orbital control in this view
            ctrl.enabled = false;
            this.m_activeControls = null;
            if (isAttached) {
                camera.userData.manualControl = false;
            }
        }
    }

    this.m_view_selected_camera = camera;
};

// Dispose per-view resources to avoid leaks and cross-view interference
C_View.prototype.dispose = function () {
    // Disable and dispose world camera controls
    if (this.m_main_camera && this.m_main_camera.m_controls) {
        this.m_main_camera.m_controls.enabled = false;
        if (this.m_main_camera.m_controls.dispose) {
            this.m_main_camera.m_controls.dispose();
        }
    }

    // Disable and dispose attached camera controls for this view
    if (this.controlsByCamera) {
        for (const [cam, ctrl] of this.controlsByCamera.entries()) {
            if (ctrl) {
                ctrl.enabled = false;
                if (ctrl.dispose) ctrl.dispose();
            }
        }
        this.controlsByCamera.clear();
    }

    // Decrement manual control refs if selected camera is follow-me
    const prevCam = this.m_view_selected_camera;
    if (prevCam && prevCam.userData && prevCam.userData.m_ownerObject) {
        const ownerCtrl = prevCam.userData.m_ownerObject;
        if (ownerCtrl && ownerCtrl.m_camera_tag === 'followme') {
            const ud = prevCam.userData;
            ud.manualControlRefs = (ud.manualControlRefs || 0) - 1;
            if (ud.manualControlRefs < 0) ud.manualControlRefs = 0;
            ud.manualControl = ud.manualControlRefs > 0;
        }
    }

    // Remove event listeners
    if (this.m_canvas && this.fn_onMouseDown) {
        this.m_canvas.removeEventListener('click', this.fn_onMouseDown, false);
    }
    if (this.m_canvas && this.fn_onMouseDoubleClick) {
        this.m_canvas.removeEventListener('dblclick', this.fn_onMouseDoubleClick, false);
    }

    // Remove CSS2DRenderer element
    if (this.labelRenderer && this.labelRenderer.domElement && this.labelRenderer.domElement.parentNode) {
        this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement);
    }
    this.labelRenderer = null;

    // Close streaming websocket if open
    try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    } catch (_) { }
    this.ws = null;

    // Null references to help GC
    this.m_activeControls = null;
    this.m_view_selected_camera = null;
};

// Show a temporary, centered message overlay within this view's container
// HTML_TEXT can include simple HTML; duration is in ms (default 2000)
C_View.prototype.fn_displayMessage = function (HTML_TEXT, duration = 2000) {
    try {
        const container = this.m_canvas && this.m_canvas.parentNode ? this.m_canvas.parentNode : null;
        if (!container) return;

        // Create overlay element lazily
        if (!this.messageOverlay) {
            const el = document.createElement('div');
            el.className = 'view-message-overlay';
            // Basic centered overlay styling
            el.style.position = 'absolute';
            el.style.top = '50%';
            el.style.left = '50%';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.padding = '10px 14px';
            el.style.background = 'rgba(0,0,0,0.7)';
            el.style.color = '#fff';
            el.style.borderRadius = '6px';
            el.style.fontSize = '13px';
            el.style.textAlign = 'center';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '1000';
            el.style.opacity = '0';
            el.style.transition = 'opacity 200ms ease';
            container.appendChild(el);
            this.messageOverlay = el;
        }

        // Update content and show
        this.messageOverlay.innerHTML = HTML_TEXT || '';
        this.messageOverlay.style.opacity = '1';
        this.messageOverlay.style.visibility = 'visible';

        // Clear existing timers
        if (this.messageHideTimer) {
            clearTimeout(this.messageHideTimer);
            this.messageHideTimer = null;
        }
        if (this.messageCleanupTimer) {
            clearTimeout(this.messageCleanupTimer);
            this.messageCleanupTimer = null;
        }

        // Schedule hide
        const hideAfter = Math.max(0, Number(duration) || 0);
        this.messageHideTimer = setTimeout(() => {
            if (!this.messageOverlay) return;
            this.messageOverlay.style.opacity = '0';
            // After transition, hide visibility to avoid focus issues
            this.messageCleanupTimer = setTimeout(() => {
                if (this.messageOverlay) {
                    this.messageOverlay.style.visibility = 'hidden';
                }
            }, 220);
        }, hideAfter);
    } catch (_) { }
};

export default C_View;




