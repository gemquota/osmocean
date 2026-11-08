import test from "node:test";
import assert from "node:assert/strict";
import { transformSurfaceQuadrature } from "../src/physics/surface-quadrature.js";
import { quatFromAxisAngle } from "../src/core/quaternion.js";

test("transforms local surface points through translation and rotation", () => {
  const samples = transformSurfaceQuadrature({
    transform: {
      position: { x: 10, y: 0, z: 0 },
      rotation: quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2)
    },
    samples: [{ position: { x: 1, y: 0, z: 0 }, area: 2, dragCoefficient: 0.8 }]
  });
  assert.ok(Math.abs(samples[0].position.x - 10) < 1e-9);
  assert.ok(Math.abs(samples[0].position.y - 1) < 1e-9);
  assert.equal(samples[0].area, 2);
  assert.equal(samples[0].dragCoefficient, 0.8);
  assert.ok(Object.isFrozen(samples));
  assert.ok(Object.isFrozen(samples[0].position));
});

test("rejects invalid local geometry and area weights", () => {
  const transform = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  assert.throws(() => transformSurfaceQuadrature({ transform, samples: [] }), RangeError);
  assert.throws(() => transformSurfaceQuadrature({
    transform, samples: [{ position: { x: 0, y: 0, z: 0 }, area: 0, dragCoefficient: 1 }]
  }), RangeError);
});
