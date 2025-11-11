import * as THREE from 'three';

/**
 * Car helper: loads a vehicle model and constrains its size to moderate car dimensions.
 * Default real-world size (meters): length 4.5, width 1.8, height 1.4
 *
 * Usage:
 *   const obj = await Car.load({
 *     url: '../../models/vehicles/car1.json',
 *     position: { x: 0, y: 0, z: 0 },
 *     rotationZ: 0,
 *     size: { length: 4.5, width: 1.8, height: 1.4 }
 *   });
 */
export class Vehicle {
  static load({ url, position = {}, rotationZ = 0, size = {} } = {}) {
    const { x = 0, y = 0, z = 0 } = position;
    const {
      length = 4.5, // along Z
      width = 1.8,  // along X
      height = 1.4  // along Y
    } = size;

    return new Promise((resolve, reject) => {
      const loader = new THREE.ObjectLoader();
      loader.load(
        url,
        (obj) => {
          try {
            obj.position.set(x, y, z);
            if (rotationZ) obj.rotateZ(rotationZ);

            // Constrain to target size (meters): X=width, Y=height, Z=length
            const bbox = new THREE.Box3().setFromObject(obj);
            const dims = new THREE.Vector3();
            bbox.getSize(dims);
            // Model uses X as forward (length) and Z as lateral (width)
            const sx = dims.x > 0 ? (length / dims.x) : 1;
            const sy = dims.y > 0 ? (height / dims.y) : 1;
            const sz = dims.z > 0 ? (width / dims.z) : 1;
            obj.scale.multiply(new THREE.Vector3(sx, sy, sz));

            resolve(obj);
          } catch (e) {
            reject(e);
          }
        },
        undefined,
        (err) => reject(err)
      );
    });
  }


  static create_car (p_x, p_y, p_z)
  {
    return Vehicle.load({
      url: '../../models/vehicles/car1.json',
      position: { x: p_x, y: p_y, z: p_z },
      rotationZ: 0,
      size: { length: 4.5, width: 1.8, height: 1.4 }
    });
  }

  static create_plane (p_x, p_y, p_z)
  {
    return Vehicle.load({
      url: '../../models/vehicles/plane_model1.json',
      position: { x: p_x, y: p_y, z: p_z },
      rotationZ: 0,
      size: { length: 4.5, width: 1.8, height: 1.4 }
    });
  }
}
