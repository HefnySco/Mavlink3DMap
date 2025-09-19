import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class C_View {
    constructor(p_world, p_canvas, p_XZero, p_YZero) {

        this.p_world = p_world;
        this.m_canvas = p_canvas;
        this.v_droneIndex = 0;
        this.v_localCameras = [];
        this.v_localActiveCamera = null;
        this.m_canvas.width = p_canvas.clientWidth * window.devicePixelRatio;
        this.m_canvas.height = p_canvas.clientHeight * window.devicePixelRatio;

        this.v_context = p_canvas.getContext('2d');

        this.m_main_camera = new THREE.PerspectiveCamera(
            75, // FOV
            p_canvas.width / p_canvas.height, // Aspect Ratio
            0.1, // Near Clipping Plane
            5000 // Far Clipping Plane
        );

        this.v_localActiveCamera = this.m_main_camera ;
        this.v_localCameras.push(this.m_main_camera );

        this.m_main_camera.position.set(5, 5, 0);
        this.m_main_camera.lookAt(new THREE.Vector3(p_XZero + 0, 0, p_YZero + 0));

        this.m_main_camera.m_controls = new OrbitControls(this.m_main_camera , p_canvas);


        this.fn_onMouseDown = this.fn_onMouseDown.bind(this);
        this.fn_onMouseDoubleClick = this.fn_onMouseDoubleClick.bind(this);

        this.m_canvas.addEventListener('click', this.fn_onMouseDown, false);
        this.m_canvas.addEventListener('dblclick', this.fn_onMouseDoubleClick, false);


    }

    // Stub for downloadImage function (used in onMouseDoubleClick)
    //TODO: move to helpers
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
        const c_canvas = this.renderer.domElement;
        const width = c_canvas.clientWidth;
        const height = c_canvas.clientHeight;
        const needResize = c_canvas.width !== width || c_canvas.height !== height;
        if (needResize) {
            this.renderer.setSize(width, height, false);
        }
        return needResize;
    };

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
                this.v_droneIndex += 1;
                this.v_droneIndex = this.v_droneIndex % c_keyLength;
                if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex].m_cameraThree;
                } else {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex];
                }
                break;

            case 80: /*P*/
                this.v_droneIndex -= 1;
                if (this.v_droneIndex < 0) this.v_droneIndex = c_keyLength - 1;
                if (this.v_localCameras[this.v_droneIndex].m_cameraThree != null) {
                    this.v_localActiveCamera = this.v_localCameras[this.v_droneIndex].m_cameraThree;
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

}

export default C_View;




