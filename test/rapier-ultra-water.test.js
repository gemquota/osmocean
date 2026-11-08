import test from "node:test";
import assert from "node:assert/strict";
import { createRapierWaterBodyAdapter } from "../src/adapters/rapier-ultra-water.js";

const near = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

function fakeBody() {
  const calls = [];
  return {
    calls,
    translation: () => ({ x: 0, y: 0, z: 0 }),
    rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
    linvel: () => ({ x: 0, y: 0, z: 0 }),
    angvel: () => ({ x: 0, y: 0, z: 0 }),
    addForceAtPoint: (force, point, wake) => calls.push({ force, point, wake })
  };
}

function fakeQuery() {
  return {
    resultTag: -1, resultTime: 0, resultCount: 0, result: new Float32Array(),
    submissions: [],
    submit(xz, count, tag, time) {
      this.submissions.push({ xz: new Float32Array(xz), count, tag, time });
    },
    resolve(time, values, tag = 7) {
      this.resultTag = tag;
      this.resultTime = time;
      this.resultCount = values.length / 4;
      this.result = new Float32Array(values);
    }
  };
}

const volume = [{ position: { x: 0, y: -0.25, z: 0 }, volume: 0.01, cellHeight: 0.5 }];
const surface = [{ position: { x: 1, y: 0, z: 0 }, area: 0.2, dragCoefficient: 1 }];
const makeAdapter = (body = fakeBody(), query = fakeQuery(), overrides = {}) => ({
  body, query,
  adapter: createRapierWaterBodyAdapter({
    body, waterQuery: query, volumeSamples: volume, surfaceSamples: surface,
    layoutTag: 7, ...overrides
  })
});

test("submits ordered body-local samples as world XZ points", () => {
  const { adapter, query } = makeAdapter();
  const result = adapter.submitQuery(1);
  assert.equal(result.count, 2);
  assert.deepEqual([...query.submissions[0].xz], [0, 0, 1, 0]);
});

test("ingests matching async results and applies buoyancy at its sample point", () => {
  const { adapter, body, query } = makeAdapter();
  adapter.submitQuery(1);
  query.resolve(1, [1, 0, 0, 1, 1, 0, 0, 1]);
  assert.equal(adapter.ingestQuery().valid, true);
  const result = adapter.applyForces(1.01);
  assert.equal(result.applied, true);
  assert.equal(body.calls.length, 1);
  near(body.calls[0].force.y, 1025 * 9.81 * 0.01);
  assert.deepEqual(body.calls[0].point, { x: 0, y: -0.25, z: 0 });
  assert.equal(body.calls[0].wake, true);
});

test("drag opposes relative point velocity and is applied at the surface sample", () => {
  const body = fakeBody();
  body.linvel = () => ({ x: 2, y: 0, z: 0 });
  const query = fakeQuery();
  const { adapter } = makeAdapter(body, query);
  adapter.submitQuery(1);
  query.resolve(1, [1, 0, 0, 1, 1, 0, 0, 1]);
  adapter.ingestQuery();
  const result = adapter.applyForces(1);
  assert.ok(result.dragForce.x < 0);
  assert.deepEqual(body.calls[1].point, { x: 1, y: 0, z: 0 });
});

test("rejects stale GPU readbacks instead of applying stale forces", () => {
  const { adapter, body, query } = makeAdapter();
  adapter.submitQuery(1);
  query.resolve(1, [1, 0, 0, 1, 1, 0, 0, 1]);
  adapter.ingestQuery();
  assert.equal(adapter.applyForces(2).reason, "stale-water-query");
  assert.equal(body.calls.length, 0);
});

test("ignores mismatched layout tags and unknown timestamps", () => {
  const { adapter, query } = makeAdapter();
  adapter.submitQuery(1);
  query.resolve(1, [1, 0, 0, 1, 1, 0, 0, 1], 99);
  assert.equal(adapter.ingestQuery().reason, "no-matching-query");
  query.resolve(2, [1, 0, 0, 1, 1, 0, 0, 1], 7);
  assert.equal(adapter.ingestQuery().reason, "unknown-query-timestamp");
});

test("derives water velocity from successive displacement readbacks", () => {
  const { adapter, query } = makeAdapter();
  adapter.submitQuery(1);
  query.resolve(1, [0, 0, 0, 1, 0, 0, 0, 1]);
  adapter.ingestQuery();
  adapter.submitQuery(1.1);
  query.resolve(1.1, [0.2, 0.3, -0.1, 1, 0.2, 0.3, -0.1, 1]);
  adapter.ingestQuery();
  near(adapter.latestQuery.waterVelocity[0].x, 3);
  near(adapter.latestQuery.waterVelocity[0].y, 2);
  near(adapter.latestQuery.waterVelocity[0].z, -1);
});

test("rejects malformed sample descriptors and invalid physical parameters", () => {
  const body = fakeBody(), query = fakeQuery();
  assert.throws(() => createRapierWaterBodyAdapter({
    body, waterQuery: query, volumeSamples: [{ position: { x: 0, y: 0, z: 0 }, volume: 0, cellHeight: 1 }]
  }), RangeError);
  assert.throws(() => createRapierWaterBodyAdapter({
    body, waterQuery: query, volumeSamples: volume, density: -1
  }), RangeError);
});
