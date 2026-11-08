import test from "node:test";
import assert from "node:assert/strict";
import { calculateBuoyancyWrench } from "../src/physics/buoyancy.js";

const field = density => ({
  sample(position, time) {
    return { valid: true, position, time, velocity: { x: 0, y: 0, z: 0 }, density };
  }
});
const identity = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
const common = {
  centerOfMass: { x: 0, y: 0, z: 0 },
  transform: identity,
  waterSurface: { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
  gravity: { x: 0, y: -9.81, z: 0 },
  waterField: field(1000),
  time: 2
};
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, a + " != " + b);

test("fully submerged volume quadrature obeys Archimedes' principle", () => {
  const result = calculateBuoyancyWrench({
    ...common,
    volumeSamples: [{ position: { x: 0, y: -1, z: 0 }, volume: 0.01 }]
  });
  assert.equal(result.valid, true);
  near(result.submergedVolume, 0.01);
  near(result.submergedFraction, 1);
  near(result.wrench.force.y, 98.1);
});

test("volume samples above the water plane do not contribute buoyancy", () => {
  const result = calculateBuoyancyWrench({
    ...common,
    volumeSamples: [{ position: { x: 0, y: 1, z: 0 }, volume: 1 }]
  });
  near(result.submergedVolume, 0);
  near(result.wrench.force.y, 0);
  assert.equal(result.wrench.forceCount, 0);
});

test("partial submersion is estimated from submerged quadrature weights", () => {
  const result = calculateBuoyancyWrench({
    ...common,
    volumeSamples: [
      { position: { x: 0, y: -1, z: 0 }, volume: 0.25 },
      { position: { x: 0, y: 1, z: 0 }, volume: 0.75 }
    ]
  });
  near(result.submergedFraction, 0.25);
  near(result.wrench.force.y, 2452.5);
});

test("off-centre displaced volume produces the expected moment", () => {
  const result = calculateBuoyancyWrench({
    ...common,
    volumeSamples: [{ position: { x: 1, y: -1, z: 0 }, volume: 0.1 }]
  });
  near(result.wrench.torque.z, 981);
});

test("invalid water samples reject the whole buoyancy wrench", () => {
  const result = calculateBuoyancyWrench({
    ...common,
    waterField: { sample: () => ({ valid: false, reason: "outside" }) },
    volumeSamples: [{ position: { x: 0, y: -1, z: 0 }, volume: 1 }]
  });
  assert.equal(result.valid, false);
  assert.equal(result.wrench, null);
  assert.equal(result.submergedVolume, null);
});

test("validates sample volumes and surface normal", () => {
  assert.throws(() => calculateBuoyancyWrench({
    ...common, volumeSamples: [{ position: { x: 0, y: 0, z: 0 }, volume: 0 }]
  }), RangeError);
  assert.throws(() => calculateBuoyancyWrench({
    ...common, waterSurface: { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } },
    volumeSamples: [{ position: { x: 0, y: -1, z: 0 }, volume: 1 }]
  }), RangeError);
});
