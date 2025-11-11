import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PhysicalBox {
  static create(world, position, size, color = 0x888888, hitColor) {
    const { x = 0, y = 0, z = 0 } = position || {};
    const { w = 1, h = 1, d = 1 } = size || {};
    const mat = new THREE.MeshPhongMaterial({ color });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);

    let body = null;
    if (world && world.cannonWorld) {
      const halfExtents = new CANNON.Vec3(w / 2, h / 2, d / 2);
      const shape = new CANNON.Box(halfExtents);
      body = new CANNON.Body({ mass: 0.5, shape }); // dynamic; set 0 for static
      body.position.set(x, y, z);

      // Optional: some friction/restitution tuning
      body.material = world.cannonWorld.defaultContactMaterial?.material;

      // Collision: on any collide, if the other body is a ball, change color
      body.addEventListener('collide', (e) => {
        const other = e.body;
        if (other && other._isBall) {
          const newColor = hitColor != null ? hitColor : Math.floor(Math.random() * (1 << 24));
          if (mesh.material && mesh.material.color) {
            mesh.material.color.setHex(newColor);
            mesh.material.needsUpdate = true;
          }
        }
      });

      world.cannonWorld.addBody(body);
      world._physicsObjects.push({ mesh, body });
      mesh.userData.m_physicsBody = body;
    } else {
      mesh.userData.m_physicsBody = null;
    }

    if (world && world.v_scene) world.v_scene.add(mesh);
    return { mesh, body };
  }
}