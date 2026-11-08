import test from "node:test";
import assert from "node:assert/strict";
import { calculateHydrodynamicWrench } from "../src/physics/hydrodynamics.js";

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const field = (velocity = { x: 0, y: 0, z: 0 }, density = 1000) => ({
  sample(position, time) {
    return Object.freeze({ valid: true, position, time, velocity, density });
  }
});
const point = (position, area = 1, dragCoefficient = 1) => ({
  position, area, dragCoefficient
});
const base = {
  centerOfMass: { x: 0, y: 0, z: 0 },
  linearVelocity: { x: 2, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  surfaceSamples: [point({ x: 0, y: 0, z: 0 })],
  waterField: field()
};

test("single surface sample reproduces the quadratic drag model", () => {
  const result = calculateHydrodynamicWrench(base);
  assert.equal(result.valid, true);
  near(result.wrench.force.x, -2000);
  near(result.wrench.force.y, 0);
  near(result.wrench.force.z, 0);
  assert.deepEqual(result.wrench.torque, { x: 0, y: 0, z: 0 });
});

test("a body co-moving with a uniform current experiences no drag", () => {
  const result = calculateHydrodynamicWrench({
    ...base,
    linearVelocity: { x: 3, y: -1, z: 2 },
    waterField: field({ x: 3, y: -1, z: 2 })
  });
  assert.deepEqual(result.wrench.force, { x: 0, y: 0, z: 0 });
});

test("sample position and simulation time are forwarded to the water field", () => {
  const position = { x: 1, y: 2, z: 3 };
  let observed;
  const waterField = {
    sample(p, time) {
      observed = { p, time };
      return { valid: true, velocity: { x: 0, y: 0, z: 0 }, density: 1000 };
    }
  };
  calculateHydrodynamicWrench({
    ...base, surfaceSamples: [point(position)], waterField, time: 12.5
  });
  assert.equal(observed.p, position);
  assert.equal(observed.time, 12.5);
});

test("angular point velocity changes drag direction on opposite sides", () => {
  const result = calculateHydrodynamicWrench({
    ...base,
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 2 },
    surfaceSamples: [point({ x: 1, y: 0, z: 0 })]
  });
  const contribution = result.contributions[0];
  near(contribution.pointVelocity.x, 0);
  near(contribution.pointVelocity.y, 2);
  assert.ok(contribution.force.y < 0);
});

test("symmetric samples cancel torque under uniform translation", () => {
  const result = calculateHydrodynamicWrench({
    ...base,
    surfaceSamples: [
      point({ x: 0, y: 1, z: 0 }),
      point({ x: 0, y: -1, z: 0 })
    ]
  });
  near(result.wrench.force.x, -4000);
  near(result.wrench.torque.z, 0);
});

test("asymmetric samples produce the expected moment about the centre", () => {
  const result = calculateHydrodynamicWrench({
    ...base,
    surfaceSamples: [point({ x: 0, y: 1, z: 0 })]
  });
  near(result.wrench.force.x, -2000);
  near(result.wrench.torque.z, 2000);
});

test("area scales force and moment linearly", () => {
  const one = calculateHydrodynamicWrench(base);
  const two = calculateHydrodynamicWrench({
    ...base, surfaceSamples: [point({ x: 0, y: 1, z: 0 }, 2)]
  });
  near(two.wrench.force.x, 2 * one.wrench.force.x);
  near(two.wrench.torque.z, 2 * 2000);
});

test("invalid field samples reject the whole wrench without partial output", () => {
  const waterField = {
    sample(position) {
      return position.y > 0
        ? { valid: false, reason: "outside-domain" }
        : { valid: true, velocity: { x: 0, y: 0, z: 0 }, density: 1000 };
    }
  };
  const result = calculateHydrodynamicWrench({
    ...base,
    surfaceSamples: [point({ x: 0, y: -1, z: 0 }), point({ x: 0, y: 1, z: 0 })],
    waterField
  });
  assert.equal(result.valid, false);
  assert.equal(result.sampleIndex, 1);
  assert.equal(result.wrench, null);
  assert.deepEqual(result.contributions, []);
});

test("invalid geometry and malformed field contracts are rejected", () => {
  assert.throws(() => calculateHydrodynamicWrench({
    ...base, surfaceSamples: [point({ x: 0, y: 0, z: 0 }, 0)]
  }), RangeError);
  assert.throws(() => calculateHydrodynamicWrench({
    ...base, surfaceSamples: [{ ...point({ x: 0, y: 0, z: 0 }), position: { x: NaN, y: 0, z: 0 } }]
  }), TypeError);
  assert.throws(() => calculateHydrodynamicWrench({
    ...base, waterField: { sample: () => ({ valid: true, velocity: { x: 0, y: 0, z: 0 } }) }
  }), RangeError);
  assert.throws(() => calculateHydrodynamicWrench({
    ...base, waterField: { sample: () => null }
  }), TypeError);
});

test("returned wrench and contribution snapshots are immutable", () => {
  const result = calculateHydrodynamicWrench(base);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.wrench));
  assert.ok(Object.isFrozen(result.wrench.force));
  assert.ok(Object.isFrozen(result.contributions));
  assert.ok(Object.isFrozen(result.contributions[0]));
  assert.ok(Object.isFrozen(result.contributions[0].pointVelocity));
});

test("finite inputs that overflow force accumulation are rejected", () => {
  assert.throws(() => calculateHydrodynamicWrench({
    ...base,
    linearVelocity: { x: 1e200, y: 0, z: 0 }
  }), RangeError);
});
