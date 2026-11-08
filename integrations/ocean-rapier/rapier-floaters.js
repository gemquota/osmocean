import * as THREE from 'three';
import { makeFloater } from './floaterMeshes.js';

// Rapier owns every rigid-body pose, velocity, collision and integration step.
// Ultra-Water remains the authoritative rendered water surface and supplies delayed
// GPU height/displacement samples. Forces are evaluated at the floater's sample points.
const RHO_WATER = 1025;
const GRAVITY = 9.81;
const FIXED_DT = 1 / 120;
const MAX_FRAME_DT = 1 / 20;
const MAX_BODIES = 28;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });

function pointVelocity(linear, angular, point, origin) {
  const rx = point.x - origin.x, ry = point.y - origin.y, rz = point.z - origin.z;
  return {
    x: linear.x + angular.y * rz - angular.z * ry,
    y: linear.y + angular.z * rx - angular.x * rz,
    z: linear.z + angular.x * ry - angular.y * rx,
  };
}

export class RapierFloaters {
  constructor({ RAPIER, scene, heightAt, patchMaterial }) {
    if (!RAPIER?.World) throw new Error('RapierFloaters requires initialized Rapier 3D');
    this.RAPIER = RAPIER;
    this.scene = new THREE.Scene();
    scene.add(this.scene);
    this.heightAt = heightAt;
    this.patchMaterial = patchMaterial;
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.bodies = [];
    this.layout = 0;
    this.points = new Float32Array(1024);
    this.count = 0;
    this.params = { drag: 1.6, angularDrag: 0.8, buoyancy: 1 };
    this.time = 0;
    this.accumulator = 0;
    this.impacts = [];
    this.lastResultTime = undefined;
    this.hud = document.createElement('div');
    Object.assign(this.hud.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '20',
      padding: '8px 10px', color: '#b8f5e5', background: '#06131cdd',
      border: '1px solid #39796d', borderRadius: '4px',
      font: '10px/1.5 monospace', pointerEvents: 'none',
    });
    this.hud.textContent = 'OSMOCEAN · RAPIER 3D FLOATERS';
    document.body.appendChild(this.hud);
    window.osmoceanRapier = { world: this.world, floaters: this, engine: 'Rapier 3D' };
  }

  add(kind, pos, yaw = Math.random() * Math.PI * 2) {
    if (this.bodies.length >= MAX_BODIES) {
      const old = this.bodies.shift();
      this.world.removeRigidBody(old.rigidBody);
      this.scene.remove(old.object);
    }
    const desc = makeFloater(kind, this.patchMaterial);
    const mass = desc.density * desc.volume;
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setLinearDamping(0.03)
      .setAngularDamping(this.params.angularDrag);
    const rigidBody = this.world.createRigidBody(bodyDesc);
    // A stable cuboid proxy is deliberately used for all procedural props. The
    // rendered boat hull is non-convex; a cuboid proxy avoids unsupported dynamic
    // trimesh behaviour and is documented as a collision approximation.
    const half = desc.size.clone().multiplyScalar(0.5);
    const collider = this.RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setMass(mass).setFriction(0.65).setRestitution(0.08);
    this.world.createCollider(collider, rigidBody);
    const n = desc.samples.length;
    const body = {
      ...desc, rigidBody, mass, radius: desc.size.length() / 2,
      cellVolume: desc.volume / n, cellMass: mass / n,
      world: desc.samples.map(() => new THREE.Vector3()),
      water: new Float32Array(n * 4),
      lastDisp: new Float32Array(n * 3).fill(NaN),
      pos: new THREE.Vector3(), wet: false,
    };
    body.object.position.copy(pos);
    body.object.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    this.scene.add(body.object);
    this.bodies.push(body);
    this.updateBody(body);
    this.layout++;
    return body;
  }

  clear() {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body.rigidBody);
      this.scene.remove(body.object);
    }
    this.bodies.length = 0;
    this.layout++;
  }

  spawn(center, forward) {
    this.clear();
    const f = new THREE.Vector3().copy(forward).setY(0).normalize();
    const side = new THREE.Vector3(-f.z, 0, f.x);
    const at = (ahead, across) => new THREE.Vector3().copy(center)
      .addScaledVector(f, ahead).addScaledVector(side, across).setY(0.2);
    this.add('boat', at(22, -4), Math.atan2(f.x, f.z) + 1.2);
    this.add('buoy', at(38, 9));
    [[12, 3], [16, -9], [27, 6], [31, -1], [19, 12]].forEach(([a, c]) => this.add('crate', at(a, c)));
    [[14, -2], [24, 14], [34, -8]].forEach(([a, c]) => this.add('barrel', at(a, c)));
  }

  updateBody(body) {
    const t = body.rigidBody.translation(), q = body.rigidBody.rotation();
    body.pos.set(t.x, t.y, t.z);
    body.object.position.copy(body.pos);
    body.object.quaternion.set(q.x, q.y, q.z, q.w);
    for (let i = 0; i < body.world.length; i++) {
      body.world[i].copy(body.samples[i]).applyQuaternion(body.object.quaternion).add(body.pos);
    }
  }

  collectPoints(extra) {
    let k = 0;
    for (const p of extra) { this.points[k++] = p.x; this.points[k++] = p.z; }
    for (const b of this.bodies) for (const p of b.world) {
      this.points[k++] = p.x; this.points[k++] = p.z;
    }
    this.count = k / 2;
    return this.points;
  }

  ingest(query, offset) {
    if (query.resultTag !== this.layout || query.resultTime === this.lastResultTime) return;
    const dt = this.lastResultTime === undefined ? 0 : query.resultTime - this.lastResultTime;
    this.lastResultTime = query.resultTime;
    let k = offset;
    for (const b of this.bodies) for (let i = 0; i < b.world.length; i++, k++) {
      if (k >= query.resultCount) return;
      const h = query.result[k * 4], dx = query.result[k * 4 + 1], dz = query.result[k * 4 + 2];
      const w = b.water, last = b.lastDisp;
      w[i * 4] = h;
      if (dt > 1e-4 && !Number.isNaN(last[i * 3])) {
        w[i * 4 + 1] = clamp((dx - last[i * 3]) / dt, -3, 3);
        w[i * 4 + 2] = clamp((h - last[i * 3 + 1]) / dt, -0.8, 0.8);
        w[i * 4 + 3] = clamp((dz - last[i * 3 + 2]) / dt, -3, 3);
      }
      last[i * 3] = dx; last[i * 3 + 1] = h; last[i * 3 + 2] = dz;
    }
  }

  applyHydrodynamics(body) {
    const { drag, buoyancy } = this.params;
    this.updateBody(body);
    const t = body.rigidBody.translation();
    const linear = body.rigidBody.linvel(), angular = body.rigidBody.angvel();
    let wet = false;
    for (let i = 0; i < body.world.length; i++) {
      const p = body.world[i], water = body.water, h = water[i * 4];
      const submerged = clamp((h - p.y) / body.cellHeight + 0.5, 0, 1);
      const v = pointVelocity(linear, angular, p, t);
      if (submerged > 0) {
        wet = true;
        const k = drag * body.cellMass * submerged;
        const force = vec(
          -(v.x - water[i * 4 + 1]) * k,
          RHO_WATER * GRAVITY * body.cellVolume * submerged * buoyancy
            - (v.y - water[i * 4 + 2]) * k * 1.5,
          -(v.z - water[i * 4 + 3]) * k,
        );
        body.rigidBody.addForceAtPoint(force, { x: p.x, y: p.y, z: p.z }, true);
      }
      // Keep the upstream terrain contact response as a force model, not a second
      // rigid-body integrator. Rapier still owns all resulting pose/contact updates.
      const ground = this.heightAt(p.x, p.z);
      const penetration = ground - p.y;
      if (penetration > 0) {
        body.rigidBody.addForceAtPoint({
          x: -v.x * body.cellMass * 6,
          y: penetration * body.cellMass * 900 - v.y * body.cellMass * 40,
          z: -v.z * body.cellMass * 6,
        }, { x: p.x, y: p.y, z: p.z }, true);
      }
    }
    if (wet && !body.wet && linear.y < -1.5) {
      const size = body.size;
      this.impacts.push({
        x: t.x, z: t.z, t: this.time,
        amp: Math.min(0.35, 0.03 * -linear.y * Math.min(size.x, size.z)),
        size: Math.max(size.x, size.z) * 0.5,
      });
      if (this.impacts.length > 8) this.impacts.shift();
    }
    body.wet = wet;
  }

  step(dt) {
    dt = clamp(dt, 0, MAX_FRAME_DT);
    this.time += dt;
    this.accumulator = Math.min(this.accumulator + dt, FIXED_DT * 8);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 8) {
      for (const body of this.bodies) this.applyHydrodynamics(body);
      this.world.timestep = FIXED_DT;
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    for (const body of this.bodies) this.updateBody(body);
    this.hud.textContent = `OSMOCEAN · RAPIER 3D · ${this.bodies.length} BODIES · ${steps} FIXED STEPS/FRAME`;
  }

  dispose() {
    this.clear();
    this.world.free();
    this.hud.remove();
    delete window.osmoceanRapier;
  }
}
