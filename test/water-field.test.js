import test from "node:test";
import assert from "node:assert/strict";
import { createUniformWaterField } from "../src/environment/water-field.js";

test("uniform field returns a stable world-space sample", () => {
  const field = createUniformWaterField({
    velocity: { x: 1.5, y: -0.2, z: 0.4 },
    density: 1025
  });
  const sample = field.sample({ x: 3, y: 2, z: -1 }, 4.5);
  assert.deepEqual(sample.velocity, { x: 1.5, y: -0.2, z: 0.4 });
  assert.equal(sample.density, 1025);
  assert.equal(sample.time, 4.5);
  assert.equal(sample.valid, true);
});

test("field does not expose mutable internal velocity", () => {
  const field = createUniformWaterField({ velocity: { x: 1, y: 2, z: 3 } });
  const sample = field.sample({ x: 0, y: 0, z: 0 });
  assert.equal(Object.isFrozen(sample.velocity), true);
  assert.throws(() => { sample.velocity.x = 99; }, TypeError);
  assert.equal(field.sample({ x: 0, y: 0, z: 0 }).velocity.x, 1);
});

test("invalid field parameters are rejected", () => {
  assert.throws(() => createUniformWaterField({ density: 0 }), RangeError);
  assert.throws(() => createUniformWaterField({ velocity: { x: Infinity, y: 0, z: 0 } }), TypeError);
  const field = createUniformWaterField();
  assert.throws(() => field.sample({ x: NaN, y: 0, z: 0 }), TypeError);
});
