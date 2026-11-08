import test from "node:test";
import assert from "node:assert/strict";
import { quadraticDragFromWaterField } from "../src/physics/drag.js";
import { createUniformWaterField } from "../src/environment/water-field.js";

const base = {
  bodyVelocity: { x: 5, y: 0, z: 0 },
  position: { x: 12, y: -3, z: 2 },
  time: 4.5,
  dragCoefficient: 0.8,
  referenceArea: 1.25
};

test("samples local water velocity and computes relative drag", () => {
  const field = createUniformWaterField({
    velocity: { x: 2, y: 0, z: 0 },
    density: 1000
  });
  const result = quadraticDragFromWaterField({ ...base, waterField: field });
  assert.equal(result.valid, true);
  assert.deepEqual(result.sample.position, base.position);
  assert.equal(result.sample.time, base.time);
  assert.deepEqual(result.drag.relativeVelocity, { x: 3, y: 0, z: 0 });
  assert.ok(result.drag.force.x < 0);
});

test("field sampling is performed at the supplied body position and time", () => {
  let received;
  const field = {
    sample(position, time) {
      received = { position, time };
      return {
        position: { ...position }, time,
        velocity: { x: 1, y: 2, z: 3 },
        density: 1025,
        valid: true
      };
    }
  };
  quadraticDragFromWaterField({ ...base, waterField: field });
  assert.deepEqual(received, { position: base.position, time: base.time });
});

test("invalid spatial samples propagate without applying drag", () => {
  const field = {
    sample(position, time) {
      return { position, time, velocity: null, density: 1025, valid: false };
    }
  };
  const result = quadraticDragFromWaterField({ ...base, waterField: field });
  assert.equal(result.valid, false);
  assert.equal(result.drag, null);
  assert.equal(result.sample.velocity, null);
});

test("co-moving body and water produce no drag through the field adapter", () => {
  const field = createUniformWaterField({
    velocity: { x: 5, y: -2, z: 1 }
  });
  const result = quadraticDragFromWaterField({
    ...base,
    bodyVelocity: { x: 5, y: -2, z: 1 },
    waterField: field
  });
  assert.deepEqual(result.drag.force, { x: 0, y: 0, z: 0 });
});

test("malformed field interfaces and valid samples are rejected", () => {
  assert.throws(() => quadraticDragFromWaterField({ ...base, waterField: {} }), TypeError);
  assert.throws(() => quadraticDragFromWaterField({
    ...base,
    waterField: { sample: () => ({ valid: "yes" }) }
  }), TypeError);
  assert.throws(() => quadraticDragFromWaterField({
    ...base,
    waterField: {
      sample: () => ({
        valid: true, velocity: { x: Infinity, y: 0, z: 0 }, density: 1025
      })
    }
  }), TypeError);
});
