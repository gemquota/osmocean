import test from "node:test";
import assert from "node:assert/strict";
import { quadraticDrag } from "../src/physics/drag.js";

const near = (actual, expected, epsilon = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const params = {
  bodyVelocity: { x: 4, y: 0, z: 0 },
  waterVelocity: { x: 0, y: 0, z: 0 },
  density: 1000,
  dragCoefficient: 0.5,
  referenceArea: 2
};

test("zero relative velocity produces zero drag", () => {
  const result = quadraticDrag({
    ...params,
    bodyVelocity: { x: 3, y: -1, z: 2 },
    waterVelocity: { x: 3, y: -1, z: 2 }
  });
  assert.deepEqual(result.relativeVelocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(result.force, { x: 0, y: 0, z: 0 });
});

test("drag opposes motion relative to water", () => {
  const result = quadraticDrag(params);
  assert.ok(result.force.x < 0);
  near(result.force.y, 0);
  near(result.force.z, 0);
});

test("co-moving water removes drag even when world velocity is non-zero", () => {
  const result = quadraticDrag({
    ...params,
    bodyVelocity: { x: 4, y: 0, z: 0 },
    waterVelocity: { x: 4, y: 0, z: 0 }
  });
  assert.deepEqual(result.force, { x: 0, y: 0, z: 0 });
});

test("doubling relative speed quadruples quadratic drag magnitude", () => {
  const one = quadraticDrag(params);
  const two = quadraticDrag({
    ...params,
    bodyVelocity: { x: 8, y: 0, z: 0 }
  });
  near(Math.abs(two.force.x), Math.abs(one.force.x) * 4);
});

test("moving water changes drag direction according to relative flow", () => {
  const result = quadraticDrag({
    ...params,
    bodyVelocity: { x: 1, y: 0, z: 0 },
    waterVelocity: { x: 3, y: 0, z: 0 }
  });
  assert.ok(result.force.x > 0);
});

test("invalid physical parameters are rejected", () => {
  assert.throws(() => quadraticDrag({ ...params, density: 0 }), RangeError);
  assert.throws(() => quadraticDrag({ ...params, dragCoefficient: -1 }), RangeError);
  assert.throws(() => quadraticDrag({ ...params, referenceArea: -1 }), RangeError);
  assert.throws(() => quadraticDrag({ ...params, bodyVelocity: { x: NaN, y: 0, z: 0 } }), TypeError);
});
