import * as THREE from 'three';
import { makeFloater } from './floaterMeshes.js';
import { createRapierWaterBodyAdapter } from '../adapters/rapier-ultra-water.js';

const GRAVITY = 9.81;
const FIXED_DT = 1 / 120;
const MAX_FRAME_DT = 1 / 20;
const MAX_STEPS = 8;
const MAX_BODIES = 12;
const MAX_QUERY_POINTS = 512;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Runtime bridge for the existing Osmocean Rapier/Ultra-Water core adapter.
 * Each body's adapter receives a virtual query view. This class multiplexes
 * those views into the single bounded GPU WaterQuery pass owned by Ultra-Water.
 */
export class RapierFloaters {
  constructor({ RAPIER, scene, patchMaterial }) {
    if (!RAPIER?.World) throw new Error('Rapier must be initialized before RapierFloaters');
    this.RAPIER = RAPIER;
    this.scene = new THREE.Scene();
    scene.add(this.scene);
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.bodies = [];
    this.layout = 0;
    this.points = new Float32Array(MAX_QUERY_POINTS * 2);
    this.count = 0;
    this.time = 0;
    this.accumulator = 0;
    this.impacts = [];
    this.lastResultTime = undefined;
    this.batches = new Map();
    this.patchMaterial = patchMaterial;
    this.hud = document.createElement('div');
    Object.assign(this.hud.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '20',
      padding: '8px 10px', color: '#b8f5e5', background: '#06131cdd',
      border: '1px solid #39796d', borderRadius: '4px',
      font: '10px/1.5 monospace', pointerEvents: 'none',
    });
    document.body.appendChild(this.hud);
    this.hud.textContent = 'OSMOCEAN · RAPIER 3D';
    window.osmoceanRapier = { world: this.world, floaters: this, engine: 'Rapier 3D' };
  }

  add(kind, pos, yaw = Math.random() * Math.PI * 2) {
    if (this.bodies.length >= MAX_BODIES) {
      const removed = this.bodies.shift();
      this.world.removeRigidBody(removed.rigidBody);
      this.scene.remove(removed.object);
    }
    const desc = makeFloater(kind, this.patchMaterial);
    const mass = desc.density * desc.volume;
    const rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setLinearDamping(0.03)
      .setAngularDamping(0.8);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const half = desc.size.clone().multiplyScalar(0.5);
    const collider = this.RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setMass(mass).setFriction(0.65).setRestitution(0.08);
    this.world.createCollider(collider, rigidBody);

    const n = desc.samples.length;
    const volumeSamples = desc.samples.map(p => ({
      position: { x: p.x, y: p.y, z: p.z },
      volume: desc.volume / n,
      cellHeight: desc.cellHeight,
    }));
    // The upstream mesh descriptor has no surface quadrature. Use its existing
    // volume sample locations with an equal share of the proxy cuboid's area.
    const sx = desc.size.x, sy = desc.size.y, sz = desc.size.z;
    const sampleArea = 2 * (sx * sy + sy * sz + sz * sx) / n;
    const surfaceSamples = desc.samples.map(p => ({
      position: { x: p.x, y: p.y, z: p.z },
      area: sampleArea,
      dragCoefficient: 1,
    }));

    const proxy = {
      resultTag: -1, resultTime: -1, resultCount: 0,
      result: new Float32Array(),
      pending: null,
      submit: (xz, count, tag, time) => {
        proxy.pending = { xz: new Float32Array(xz), count, tag, time };
      },
    };
    const adapter = createRapierWaterBodyAdapter({
      body: rigidBody,
      waterQuery: proxy,
      volumeSamples,
      surfaceSamples,
      layoutTag: this.bodies.length + 1,
      maxReadbackAge: 0.18,
    });
    const body = {
      ...desc, rigidBody, adapter, queryProxy: proxy, mass,
      pos: new THREE.Vector3(pos.x, pos.y, pos.z),
      radius: desc.size.length() / 2,
      wet: false,
      previousVerticalVelocity: 0,
    };
    body.object.position.copy(body.pos);
    body.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.scene.add(body.object);
    this.bodies.push(body);
    this.layout++;
    return body;
  }

  clear() {
    for (const body of this.bodies) {
      this.world.removeRigidBody(body.rigidBody);
      this.scene.remove(body.object);
    }
    this.bodies.length = 0;
    this.batches.clear();
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

  syncBody(body) {
    const p = body.rigidBody.translation(), q = body.rigidBody.rotation();
    body.pos.set(p.x, p.y, p.z);
    body.object.position.copy(body.pos);
    body.object.quaternion.set(q.x, q.y, q.z, q.w);
  }

  collectPoints(extra, time) {
    let cursor = 0;
    for (const p of extra) {
      if (cursor >= MAX_QUERY_POINTS) break;
      this.points[cursor * 2] = p.x;
      this.points[cursor * 2 + 1] = p.z;
      cursor++;
    }
    const offsets = [];
    for (const body of this.bodies) {
      body.adapter.submitQuery(time);
      const pending = body.queryProxy.pending;
      if (!pending || cursor + pending.count > MAX_QUERY_POINTS) continue;
      offsets.push({ body, offset: cursor, count: pending.count });
      this.points.set(pending.xz.subarray(0, pending.count * 2), cursor * 2);
      cursor += pending.count;
    }
    this.count = cursor;
    this.batches.set(time, offsets);
    while (this.batches.size > 8) this.batches.delete(this.batches.keys().next().value);
    return this.points;
  }

  ingest(query) {
    if (query.resultTag !== this.layout || query.resultTime === this.lastResultTime) return;
    const batch = this.batches.get(query.resultTime);
    if (!batch || query.resultCount < this.count || !query.result) return;
    for (const { body, offset, count } of batch) {
      const proxy = body.queryProxy;
      proxy.resultTag = proxy.pending?.tag ?? body.adapter.sampleCount; // overwritten below with the adapter's stable tag
      proxy.resultTag = body.layoutTag;
      proxy.resultTime = query.resultTime;
      proxy.resultCount = count;
      proxy.result = query.result.slice(offset * 4, (offset + count) * 4);
      body.adapter.ingestQuery();
    }
    this.lastResultTime = query.resultTime;
    for (const time of this.batches.keys()) if (time <= query.resultTime) this.batches.delete(time);
  }

  step(dt) {
    dt = clamp(dt, 0, MAX_FRAME_DT);
    this.time += dt;
    this.accumulator = Math.min(this.accumulator + dt, FIXED_DT * MAX_STEPS);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      for (const body of this.bodies) {
        const result = body.adapter.applyForces(this.time);
        const vy = body.rigidBody.linvel().y;
        if (result.applied && !body.wet && vy < -1.5) {
          const size = body.size;
          const p = body.rigidBody.translation();
          this.impacts.push({
            x: p.x, z: p.z, t: this.time,
            amp: Math.min(0.35, 0.03 * -vy * Math.min(size.x, size.z)),
            size: Math.max(size.x, size.z) * 0.5,
          });
          if (this.impacts.length > 8) this.impacts.shift();
        }
        body.wet = Boolean(result.applied && result.forceCount > 0);
      }
      this.world.timestep = FIXED_DT;
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    for (const body of this.bodies) this.syncBody(body);
    this.hud.textContent = `OSMOCEAN · RAPIER 3D · ${this.bodies.length} BODIES · ${steps} FIXED STEPS/FRAME`;
  }

  dispose() {
    this.clear();
    this.world.free();
    this.hud.remove();
    delete window.osmoceanRapier;
  }
}
