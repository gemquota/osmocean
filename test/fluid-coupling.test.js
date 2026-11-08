import test from "node:test";
import assert from "node:assert/strict";
import { createRigidBodyState, rigidBodyKineticEnergy } from "../src/physics/rigid-body.js";
import { calculateBodyFluidWrench, stepRigidBodyInWater } from "../src/physics/fluid-coupling.js";
import { createUniformWaterField } from "../src/environment/water-field.js";

const body = overrides => createRigidBodyState({
  mass: 10,
  inertiaBody: [[2, 0, 0], [0, 2, 0], [0, 0, 2]],
  ...overrides
});
const surfaceSamples = [
  { position: { x: 0.5, y: 0, z: 0 }, area: 0.5, dragCoefficient: 1 },
  { position: { x: -0.5, y: 0, z: 0 }, area: 0.5, dragCoefficient: 1 }
];
const volumeSamples = [
  { position: { x: 0, y: -0.25, z: 0 }, volume: 0.005 },
  { position: { x: 0, y: 0.25, z: 0 }, volume: 0.005 }
];
const waterSurface = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } };
const gravity = { x: 0, y: -9.81, z: 0 };
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, a + " != " + b);

test("body-local drag and buoyancy assemble into one world-space wrench", () => {
  const state = body({ position: { x: 0, y: 0, z: 0 }, linearVelocity: { x: 1, y: 0, z: 0 } });
  const result = calculateBodyFluidWrench({
    bodyState: state, surfaceSamples, volumeSamples, waterSurface,
    waterField: createUniformWaterField({ density: 1000 }), gravity
  });
  assert.equal(result.valid, true);
  assert.ok(result.wrench.force.x < 0);
  near(result.wrench.force.y, 49.05);
  assert.equal(result.drag.valid, true);
  assert.equal(result.buoyancy.valid, true);
});

test("neutral buoyancy balances body weight in a stationary step", () => {
  const state = body({ position: { x: 0, y: -1, z: 0 } });
  const volumes = [{ position: { x: 0, y: 0, z: 0 }, volume: 0.01 }];
  const result = stepRigidBodyInWater({
    bodyState: state,
    surfaceSamples,
    volumeSamples: volumes,
    waterSurface,
    waterField: createUniformWaterField({ density: 1000 }),
    gravity,
    dt: 0.01
  });
  assert.equal(result.valid, true);
  near(result.state.linearVelocity.y, 0);
  near(result.state.position.y, -1);
});

test("drag dissipates translational kinetic energy for a stable small step", () => {
  const state = body({ linearVelocity: { x: 1, y: 0, z: 0 } });
  const before = rigidBodyKineticEnergy(state);
  const result = stepRigidBodyInWater({
    bodyState: state, surfaceSamples, volumeSamples: [
      { position: { x: 0, y: -0.5, z: 0 }, volume: 0.01 }
    ],
    waterSurface: { point: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
    waterField: createUniformWaterField({ density: 1000 }),
    gravity: { x: 0, y: 0, z: 0 },
    dt: 0.001
  });
  assert.equal(result.valid, true);
  assert.ok(rigidBodyKineticEnergy(result.state) < before);
});

test("invalid water coverage prevents body integration rather than applying partial loads", () => {
  const state = body({ linearVelocity: { x: 1, y: 0, z: 0 } });
  const result = stepRigidBodyInWater({
    bodyState: state, surfaceSamples, volumeSamples, waterSurface,
    waterField: {
      sample(position) {
        return position.x > 0.4
          ? { valid: false, reason: "outside" }
          : { valid: true, velocity: { x: 0, y: 0, z: 0 }, density: 1000 };
      }
    },
    gravity, dt: 0.01
  });
  assert.equal(result.valid, false);
  assert.equal(result.state, null);
});
