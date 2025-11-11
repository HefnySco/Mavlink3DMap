import * as THREE from 'three';

/**
 * Building helper: loads a model and constrains its size to target meters.
 * API:
 *   Building.create(world, {
 *     url: './models/building2.json',
 *     position: { x: 0, y: 0, z: 0 },
 *     width: 10,      // meters (optional)
 *     height: 15,     // meters (optional)
 *     depth: null,    // meters (optional). If null, depth scales proportionally to width
 *     rotationY: 0    // radians, optional
 *   })
 */
export class Building {
  static create(world, { url, position = {}, width = null, height = null, depth = null, rotationY = 0 } = {}) {
    const { x = 0, y = 0, z = 0 } = position;

    const loader = new THREE.ObjectLoader();
    loader.load(url, (obj) => {
      obj.position.set(x, y, z);
      if (rotationY) obj.rotateY(rotationY);

      // Constrain size if targets provided
      if (width != null || height != null || depth != null) {
        const bbox = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        // Avoid division by zero
        const sx = width != null && size.x > 0 ? (width / size.x) : 1;
        const sy = height != null && size.y > 0 ? (height / size.y) : 1;
        let sz;
        if (depth != null) {
          sz = size.z > 0 ? (depth / size.z) : 1;
        } else {
          // Keep depth proportional to width scaling if width provided, else 1
          sz = width != null ? sx : 1;
        }
        obj.scale.multiply(new THREE.Vector3(sx, sy, sz));
      }

      world?.v_scene?.add(obj);
    });
  }
}
