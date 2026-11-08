import test from "node:test";
import assert from "node:assert/strict";
import { createGridWaterField } from "../src/environment/water-field.js";

const makeGrid = (nx, ny, nz, fn) => {
  const values = [];
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) values.push(fn(i, j, k));
    }
  }
  return values;
};

const near = (a, b, epsilon = 1e-11) =>
  assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

test("trilinear grid reproduces an affine vector field exactly", () => {
  const field = createGridWaterField({
    origin: { x: 10, y: -4, z: 2 },
    spacing: { x: 2, y: 0.5, z: 4 },
    dimensions: { x: 3, y: 3, z: 3 },
    velocities: makeGrid(3, 3, 3, (i, j, k) => ({
      x: 1 + 2 * i - 3 * j + 0.5 * k,
      y: -2 + i + 4 * j + 2 * k,
      z: 8 - i + 0.25 * j - 2 * k
    }))
  });
  const p = { x: 12.5, y: -3.25, z: 8 };
  const sample = field.sample(p);
  near(sample.velocity.x, 1 + 2.5 - 4.5 + 0.75);
  near(sample.velocity.y, -2 + 1.25 + 6 + 3);
  near(sample.velocity.z, 8 - 1.25 + 0.375 - 3);
  assert.equal(sample.valid, true);
});

test("grid nodes are reproduced exactly, including maximum faces and corners", () => {
  const field = createGridWaterField({
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    velocities: makeGrid(2, 2, 2, (i, j, k) => ({ x: i, y: j, z: k }))
  });
  assert.deepEqual(field.sample({ x: 0, y: 0, z: 0 }).velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(field.sample({ x: 1, y: 1, z: 1 }).velocity, { x: 1, y: 1, z: 1 });
  assert.deepEqual(field.sample({ x: 1, y: 0, z: 1 }).velocity, { x: 1, y: 0, z: 1 });
});

test("out-of-domain samples are invalid by default", () => {
  const field = createGridWaterField({
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    velocities: makeGrid(2, 2, 2, () => ({ x: 1, y: 2, z: 3 }))
  });
  const sample = field.sample({ x: -0.001, y: 0, z: 0 });
  assert.equal(sample.valid, false);
  assert.equal(sample.velocity, null);
});

test("clamp boundary mode extends nearest boundary values", () => {
  const field = createGridWaterField({
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    boundaryMode: "clamp",
    velocities: makeGrid(2, 2, 2, (i, j, k) => ({ x: i, y: j, z: k }))
  });
  assert.deepEqual(field.sample({ x: -10, y: 0.5, z: 10 }).velocity, {
    x: 0, y: 0.5, z: 1
  });
});

test("grid copies and freezes its input samples and returned samples", () => {
  const velocities = makeGrid(2, 2, 2, () => ({ x: 1, y: 2, z: 3 }));
  const field = createGridWaterField({
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    velocities
  });
  velocities[0].x = 999;
  const sample = field.sample({ x: 0, y: 0, z: 0 });
  assert.equal(sample.velocity.x, 1);
  assert.equal(Object.isFrozen(sample), true);
  assert.equal(Object.isFrozen(sample.position), true);
  assert.equal(Object.isFrozen(sample.velocity), true);
  assert.throws(() => { sample.velocity.x = 9; }, TypeError);
});

test("grid validates dimensions, spacing, boundary policy and data shape", () => {
  const base = {
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    velocities: makeGrid(2, 2, 2, () => ({ x: 0, y: 0, z: 0 }))
  };
  assert.throws(() => createGridWaterField({ ...base, dimensions: { x: 1, y: 2, z: 2 } }), RangeError);
  assert.throws(() => createGridWaterField({ ...base, spacing: { x: 1, y: 0, z: 1 } }), RangeError);
  assert.throws(() => createGridWaterField({ ...base, boundaryMode: "wrap" }), TypeError);
  assert.throws(() => createGridWaterField({ ...base, velocities: base.velocities.slice(1) }), TypeError);
  assert.throws(() => createGridWaterField({
    ...base,
    velocities: base.velocities.map((v, i) => i ? v : { x: Infinity, y: 0, z: 0 })
  }), TypeError);
});

test("grid rejects invalid sample coordinates and times", () => {
  const field = createGridWaterField({
    dimensions: { x: 2, y: 2, z: 2 },
    spacing: { x: 1, y: 1, z: 1 },
    velocities: makeGrid(2, 2, 2, () => ({ x: 0, y: 0, z: 0 }))
  });
  assert.throws(() => field.sample({ x: NaN, y: 0, z: 0 }), TypeError);
  assert.throws(() => field.sample({ x: 0, y: 0, z: 0 }, Infinity), TypeError);
});
