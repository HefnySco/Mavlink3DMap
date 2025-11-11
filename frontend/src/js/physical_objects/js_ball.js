import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * PhysicsBall encapsulates a THREE Mesh + CANNON Body sphere.
 * Usage: PhysicsBall.create(world, { x, y, z }, radius, color, { vx, vy, vz })
 */
export class PhysicsBall {
  static create(world, position, radius = 0.2, color = 0xff5533, initialVelocity) {
    // Visual
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshPhongMaterial({ color })
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    mesh.position.set(position.x, position.y, position.z);

    // Physics (if world has cannon enabled)
    let body = null;
    if (world && world.cannonWorld) {
      const shape = new CANNON.Sphere(radius);
      body = new CANNON.Body({ mass: 1, shape });
      body._isBall = true; // tag for collision checks
      body.position.set(position.x, position.y, position.z);
      if (initialVelocity) {
        const { vx = 0, vy = 0, vz = 0 } = initialVelocity;
        body.velocity.set(vx, vy, vz);
      }
      world.cannonWorld.addBody(body);
      world._physicsObjects.push({ mesh, body });
      mesh.userData.m_physicsBody = body;
      mesh.userData.type = 'ball';
    } else {
      mesh.userData.m_physicsBody = null;
    }

    if (world && world.v_scene) world.v_scene.add(mesh);

    return { mesh, body };
  }
}
