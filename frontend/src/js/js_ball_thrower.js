import * as THREE from 'three';
import { PhysicsBall } from './js_ball.js';

/**
 * BallThrower attaches to a vehicle and spawns balls with configured
 * relative position and initial velocity.
 *
 * options:
 *  - offset: { x, y, z } position relative to vehicle (in vehicle local axes)
 *  - velocity: { x, y, z } initial velocity relative to vehicle (m/s)
 *              if omitted or all zeros => free fall (only drone velocity)
 *  - radius: number (default 0.2)
 *  - color: number (default 0xff5533)
 */
export class BallThrower {
  constructor(vehicle, options = {}) {
    this.vehicle = vehicle; // c_ArduVehicles
    const { offset, velocity, radius = 0.2, color = 0xff5533 } = options;
    this.offset = new THREE.Vector3(
      offset?.x || 0,
      offset?.y || 0,
      offset?.z || 0
    );
    this.velocity = new THREE.Vector3(
      velocity?.x || 0,
      velocity?.y || 0,
      velocity?.z || 0
    );
    this.radius = radius;
    this.color = color;
  }

  /**
   * Throws a ball using current config.
   * - world: C_World (provides cannonWorld and v_droneVel)
   */
  throw(world) {
    if (!this.vehicle || !world) return;

    // Vehicle world position and orientation
    const { x, y, z } = this.vehicle.fn_translateXYZ();
    const position = new THREE.Vector3(x, y, z);

    // Vehicle orientation quaternion (from last apply)
    // We rebuild it from vehicle roll/pitch/yaw similar to SimObject.fn_applyIMU
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _zAxis = new THREE.Vector3(0, 0, 1);
    const _xAxis = new THREE.Vector3(1, 0, 0);
    const q1 = new THREE.Quaternion().setFromAxisAngle(_yAxis, this.vehicle.m_yaw);
    const q2 = new THREE.Quaternion().setFromAxisAngle(_zAxis, this.vehicle.m_pitch);
    const q3 = new THREE.Quaternion().setFromAxisAngle(_xAxis, this.vehicle.m_roll);
    const vehicleQ = new THREE.Quaternion().multiplyQuaternions(q1, q2).multiply(q3);

    // Spawn position = vehicle pos + rotated offset
    const rel = this.offset.clone().applyQuaternion(vehicleQ);
    const spawn = position.clone().add(rel);

    // Initial velocity = drone velocity (from world) + rotated configured velocity
    const dv = world.v_droneVel?.[this.vehicle.sid] || { x: 0, y: 0, z: 0 };
    const velWorld = this.velocity.clone().applyQuaternion(vehicleQ);
    const initialVelocity = { vx: dv.x + velWorld.x, vy: dv.y + velWorld.y, vz: dv.z + velWorld.z };

    PhysicsBall.create(world, { x: spawn.x, y: spawn.y, z: spawn.z }, this.radius, this.color, initialVelocity);
  }
}
