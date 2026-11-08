import * as THREE from 'three';
import { makeFloater } from './floaterMeshes.js';
import { createRapierWaterBodyAdapter } from '../osmocean/rapier-ultra-water.js';

const MAX_BODIES = 28;
const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 6;
const WATER_DENSITY = 1025;
const GRAVITY = 9.81;
const MAX_QUERY_POINTS = 512;
const v3 = (v) => ({ x: v.x, y: v.y, z: v.z });
const rotationOf = (body) => { const q = body.rotation(); return new THREE.Quaternion(q.x, q.y, q.z, q.w); };
const positionOf = (body) => { const p = body.translation(); return new THREE.Vector3(p.x, p.y, p.z); };

function makeSurfaceSamples(size) {
  const x = size.x * 0.5, y = size.y * 0.5, z = size.z * 0.5;
  return [
    { position: { x, y: 0, z: 0 }, area: size.y * size.z },
    { position: { x: -x, y: 0, z: 0 }, area: size.y * size.z },
    { position: { x: 0, y, z: 0 }, area: size.x * size.z },
    { position: { x: 0, y: -y, z: 0 }, area: size.x * size.z },
    { position: { x: 0, y: 0, z }, area: size.x * size.y },
    { position: { x: 0, y: 0, z: -z }, area: size.x * size.y },
  ].map((sample) => ({ ...sample, dragCoefficient: 0.85 }));
}

function colliderFor(RAPIER, desc) {
  const size = desc.size;
  let collider;
  if (desc.kind === 'barrel') {
    const halfTurn = Math.SQRT1_2;
    collider = RAPIER.ColliderDesc.cylinder(size.x * 0.5, Math.max(size.y, size.z) * 0.5)
      .setRotation({ x: 0, y: 0, z: halfTurn, w: halfTurn });
  } else if (desc.kind === 'buoy') {
    collider = RAPIER.ColliderDesc.ball(0.5);
  } else if (desc.kind === 'boat') {
    const positions = desc.object.geometry.attributes.position.array;
    collider = RAPIER.ColliderDesc.convexHull(new Float32Array(positions));
  }
  if (!collider) collider = RAPIER.ColliderDesc.cuboid(size.x * 0.5, size.y * 0.5, size.z * 0.5);
  return collider.setMass(desc.density * desc.volume).setFriction(0.65).setRestitution(0.015);
}

export class RapierFloaters {
  constructor({ RAPIER, scene, heightAt, patchMaterial, query }) {
    if (!RAPIER || !query) throw new TypeError('Rapier and the upstream WaterQuery are required');
    this.RAPIER = RAPIER;
    this.query = query;
    this.heightAt = heightAt;
    this.patchMaterial = patchMaterial;
    this.scene = new THREE.Scene();
    scene.add(this.scene);
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.bodies = [];
    this.layout = 1;
    this.count = 0;
    this.points = new Float32Array(MAX_QUERY_POINTS * 2);
    this.params = Object.freeze({ engine: 'Rapier 3D', fixedTimestep: FIXED_DT });
    this.time = 0;
    this.queryTime = 0;
    this.accumulator = 0;
    this.impacts = [];
    this.adapters = [];
    this.addTerrainCollider();
  }

  addTerrainCollider() {
    const rows = 257, cols = 257, span = 2400, verticalScale = 160;
    const heights = new Float32Array(rows * cols);
    for (let col = 0; col < cols; col++) {
      const x = (col / (cols - 1) - 0.5) * span;
      for (let row = 0; row < rows; row++) {
        const z = (row / (rows - 1) - 0.5) * span;
        heights[col * rows + row] = this.heightAt(x, z) / verticalScale;
      }
    }
    const terrain = this.RAPIER.ColliderDesc.heightfield(
      rows, cols, heights, { x: span, y: verticalScale, z: span }
    ).setFriction(0.8);
    this.world.createCollider(terrain);
  }

  makeBody(kind, pos, yaw) {
    const desc = makeFloater(kind, this.patchMaterial);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.025)
      .setAngularDamping(0.08);
    const body = this.world.createRigidBody(bodyDesc);
    this.world.createCollider(colliderFor(this.RAPIER, desc), body);
    const object = desc.object;
    object.position.copy(pos);
    object.quaternion.copy(q);
    this.scene.add(object);
    return {
      kind, body, object, pos: pos.clone(), radius: desc.size.length() * 0.5,
      size: desc.size, volume: desc.volume, density: desc.density,
      cellHeight: desc.cellHeight,
      volumeSamples: desc.samples.map((point) => ({
        position: v3(point), volume: desc.volume / desc.samples.length, cellHeight: desc.cellHeight,
      })),
      surfaceSamples: makeSurfaceSamples(desc.size),
      wet: false, adapter: null, queryProxy: null, queryOffset: 0,
    };
  }

  rebuildAdapters() {
    this.adapters = [];
    let baseOffset = 0;
    for (const item of this.bodies) {
      const proxy = {
        submit() {},
        get resultTag() { return this.source.resultTag; },
        get resultTime() { return this.source.resultTime; },
        get resultCount() { return Math.max(0, this.source.resultCount - this.offset); },
        get result() { return this.source.result.subarray(this.offset * 4); },
        source: this.query,
        offset: 0,
      };
      const adapter = createRapierWaterBodyAdapter({
        body: item.body, waterQuery: proxy,
        volumeSamples: item.volumeSamples, surfaceSamples: item.surfaceSamples,
        density: WATER_DENSITY, gravity: GRAVITY,
        maxReadbackAge: 0.2, layoutTag: this.layout,
      });
      item.adapter = adapter;
      item.queryProxy = proxy;
      item.queryOffset = baseOffset;
      baseOffset += adapter.sampleCount;
      this.adapters.push(item);
    }
  }

  add(kind, pos, yaw = Math.random() * Math.PI * 2) {
    if (this.bodies.length >= MAX_BODIES) {
      const old = this.bodies.shift();
      this.world.removeRigidBody(old.body);
      this.scene.remove(old.object);
    }
    const item = this.makeBody(kind, pos, yaw);
    this.bodies.push(item);
    this.layout++;
    this.rebuildAdapters();
    return item;
  }

  clear() {
    for (const item of this.bodies) {
      this.world.removeRigidBody(item.body);
      this.scene.remove(item.object);
    }
    this.bodies.length = 0;
    this.impacts.length = 0;
    this.layout++;
    this.rebuildAdapters();
  }

  spawn(center, forward) {
    this.clear();
    const f = new THREE.Vector3().copy(forward).setY(0).normalize();
    const side = new THREE.Vector3(-f.z, 0, f.x);
    const at = (ahead, across) => new THREE.Vector3()
      .copy(center).addScaledVector(f, ahead).addScaledVector(side, across).setY(0.2);
    this.add('boat', at(22, -4), Math.atan2(f.x, f.z) + 1.2);
    this.add('buoy', at(38, 9));
    [[12, 3], [16, -9], [27, 6], [31, -1], [19, 12]].forEach(([a, c]) => this.add('crate', at(a, c)));
    [[14, -2], [24, 14], [34, -8]].forEach(([a, c]) => this.add('barrel', at(a, c)));
  }

  collectPoints(extra, time) {
    this.queryTime = time;
    const required = extra.length + this.bodies.reduce((sum, item) => sum + item.adapter.sampleCount, 0);
    if (required > MAX_QUERY_POINTS) throw new RangeError('Rapier floater query capacity exceeded');
    const points = new Float32Array(required * 2);
    let cursor = 0;
    for (const point of extra) { points[cursor++] = point.x; points[cursor++] = point.z; }
    for (const item of this.bodies) {
      item.adapter.submitQuery(time);
      const position = positionOf(item.body);
      const rotation = rotationOf(item.body);
      for (const sample of [...item.volumeSamples, ...item.surfaceSamples]) {
        const point = new THREE.Vector3(sample.position.x, sample.position.y, sample.position.z)
          .applyQuaternion(rotation).add(position);
        points[cursor++] = point.x;
        points[cursor++] = point.z;
      }
    }
    this.points = points;
    this.count = required;
    return points;
  }

  ingest(query, offset = 1) {
    for (const item of this.bodies) {
      item.queryProxy.offset = offset + item.queryOffset;
      item.adapter.ingestQuery();
    }
  }

  step(dt) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    this.time += dt;
    this.accumulator = Math.min(this.accumulator + dt, FIXED_DT * MAX_SUBSTEPS);
    let steps = 0;
    while (this.accumulator + 1e-9 >= FIXED_DT && steps < MAX_SUBSTEPS) {
      for (const item of this.bodies) item.adapter.applyForces(this.queryTime);
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    for (const item of this.bodies) {
      const position = positionOf(item.body);
      const rotation = rotationOf(item.body);
      item.pos.copy(position);
      item.object.position.copy(position);
      item.object.quaternion.copy(rotation);
      const water = item.adapter.latestQuery;
      let wet = false;
      if (water) {
        for (let i = 0; i < item.volumeSamples.length; i++) {
          const sample = item.volumeSamples[i].position;
          const p = new THREE.Vector3(sample.x, sample.y, sample.z).applyQuaternion(rotation).add(position);
          if (water.heights[i] > p.y) { wet = true; break; }
        }
      }
      const velocity = item.body.linvel();
      if (wet && !item.wet && velocity.y < -1.5) {
        this.impacts.push({
          x: position.x, z: position.z, t: this.time,
          amp: Math.min(0.35, 0.03 * -velocity.y * Math.min(item.size.x, item.size.z)),
          size: Math.max(item.size.x, item.size.z) * 0.5,
        });
        if (this.impacts.length > 8) this.impacts.shift();
      }
      item.wet = wet;
    }
  }
}
