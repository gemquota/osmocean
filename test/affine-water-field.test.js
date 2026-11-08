import test from "node:test";
import assert from "node:assert/strict";
import {
  createAffineWaterField,
  createShearWaterField,
  createVortexWaterField
} from "../src/environment/water-field.js";

const near = (a, b, epsilon = 1e-12) =>
  assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

test("affine field evaluates a full 3D velocity-gradient tensor", () => {
  const field = createAffineWaterField({
    origin: { x: 1, y: 2, z: 3 },
    baseVelocity: { x: 4, y: 5, z: 6 },
    velocityGradient: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ],
    density: 998
  });
  const sample = field.sample({ x: 2, y: 4, z: 6 }, 2.5);
  assert.deepEqual(sample.velocity, { x: 17, y: 32, z: 47 });
  assert.equal(sample.density, 998);
  assert.equal(sample.time, 2.5);
  assert.equal(sample.valid, true);
});

test("zero gradient is exactly equivalent to a uniform field", () => {
  const field = createAffineWaterField({
    baseVelocity: { x: -2, y: 0.5, z: 7 }
  });
  for (const position of [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: -30, z: 4 },
    { x: -1e4, y: 2e3, z: -9 }
  ]) {
    assert.deepEqual(field.sample(position).velocity, { x: -2, y: 0.5, z: 7 });
  }
});

test("shear field changes only its configured velocity component", () => {
  const field = createShearWaterField({
    shearRate: 0.25,
    baseVelocity: { x: 1, y: 2, z: 3 }
  });
  assert.deepEqual(field.sample({ x: 10, y: 4, z: -5 }).velocity, {
    x: 2, y: 2, z: 3
  });
  assert.deepEqual(field.sample({ x: 10, y: 0, z: 0 }).velocity, {
    x: 1, y: 2, z: 3
  });
});

test("planar vortex has tangential velocity and zero radial component", () => {
  const field = createVortexWaterField({ angularRate: 2 });
  const p = { x: 3, y: 4, z: 0 };
  const v = field.sample(p).velocity;
  near(v.x, -8);
  near(v.y, 6);
  near(v.x * p.x + v.y * p.y, 0);
});

test("affine field is deterministic and samples are immutable", () => {
  const field = createShearWaterField({ shearRate: -0.1 });
  const position = { x: 2, y: 3, z: 4 };
  const a = field.sample(position, 8);
  const b = field.sample(position, 8);
  assert.deepEqual(a, b);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.position), true);
  assert.equal(Object.isFrozen(a.velocity), true);
  assert.throws(() => { a.velocity.x = 99; }, TypeError);
});

test("invalid affine field configuration and sample inputs are rejected", () => {
  assert.throws(() => createAffineWaterField({ velocityGradient: [[0, 0, 0]] }), TypeError);
  assert.throws(() => createAffineWaterField({ velocityGradient: [
    [0, 0, 0], [0, Infinity, 0], [0, 0, 0]
  ] }), TypeError);
  assert.throws(() => createAffineWaterField({ density: 0 }), RangeError);
  assert.throws(() => createShearWaterField({ shearRate: NaN }), TypeError);
  assert.throws(() => createVortexWaterField({ angularRate: Infinity }), TypeError);
  const field = createAffineWaterField();
  assert.throws(() => field.sample({ x: NaN, y: 0, z: 0 }), TypeError);
  assert.throws(() => field.sample({ x: 0, y: 0, z: 0 }, Infinity), TypeError);
});

test("overflowing affine evaluation is explicitly marked invalid", () => {
  const field = createAffineWaterField({
    velocityGradient: [
      [1e308, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  });
  const sample = field.sample({ x: 2, y: 0, z: 0 });
  assert.equal(sample.valid, false);
  assert.equal(sample.velocity, null);
});
