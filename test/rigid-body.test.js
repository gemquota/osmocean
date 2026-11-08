import test from "node:test";
import assert from "node:assert/strict";
import {
  createRigidBodyState, integrateRigidBody, rigidBodyAngularVelocity, rigidBodyKineticEnergy
} from "../src/physics/rigid-body.js";

const inertia = [[2, 0, 0], [0, 3, 0], [0, 0, 4]];
const zeroWrench = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } };
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, a + " != " + b);
const body = overrides => createRigidBodyState({ mass: 2, inertiaBody: inertia, ...overrides });

test("constant force uses semi-implicit translation and preserves mass properties", () => {
  const initial = body();
  const next = integrateRigidBody(initial, { force: { x: 4, y: 0, z: 0 }, torque: zeroWrench.torque }, 0.5);
  near(next.linearVelocity.x, 1);
  near(next.position.x, 0.5);
  assert.equal(next.mass, initial.mass);
  assert.deepEqual(next.position, { x: 0.5, y: 0, z: 0 });
});

test("torque updates world angular momentum and rotates orientation", () => {
  const next = integrateRigidBody(body(), {
    force: zeroWrench.force, torque: { x: 0, y: 0, z: 4 }
  }, 0.5);
  near(next.angularMomentum.z, 2);
  const omega = rigidBodyAngularVelocity(next);
  near(omega.z, 0.5);
  near(next.orientation.z, Math.sin(0.125));
  near(next.orientation.w, Math.cos(0.125));
});

test("full symmetric inertia tensors are accepted and affect angular response", () => {
  const state = createRigidBodyState({
    mass: 1,
    inertiaBody: [[2, 0.2, 0], [0.2, 3, 0], [0, 0, 4]],
    angularVelocity: { x: 1, y: 0, z: 0 }
  });
  const omega = rigidBodyAngularVelocity(state);
  near(omega.x, 1);
  near(omega.y, 0);
  near(omega.z, 0);
});

test("torque-free asymmetric rotation conserves world angular momentum", () => {
  let state = createRigidBodyState({
    mass: 1,
    inertiaBody: [[2, 0, 0], [0, 3, 0], [0, 0, 4]],
    orientation: { x: 0, y: 0, z: Math.sin(0.2), w: Math.cos(0.2) },
    angularVelocity: { x: 1, y: 0.4, z: -0.2 }
  });
  const initialMomentum = { ...state.angularMomentum };
  for (let i = 0; i < 100; i++) state = integrateRigidBody(state, zeroWrench, 0.001);
  near(state.angularMomentum.x, initialMomentum.x);
  near(state.angularMomentum.y, initialMomentum.y);
  near(state.angularMomentum.z, initialMomentum.z);
  near(Math.hypot(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w), 1);
  assert.notDeepEqual(rigidBodyAngularVelocity(state), rigidBodyAngularVelocity({
    ...state, orientation: { x: 0, y: 0, z: 0, w: 1 }
  }));
});

test("zero wrench preserves linear and angular momentum", () => {
  const initial = body({
    linearVelocity: { x: 1, y: -2, z: 0.5 },
    angularVelocity: { x: 0.2, y: 0.3, z: -0.1 }
  });
  const next = integrateRigidBody(initial, zeroWrench, 0.01);
  assert.deepEqual(next.linearVelocity, initial.linearVelocity);
  assert.deepEqual(next.angularMomentum, initial.angularMomentum);
  near(Math.hypot(next.orientation.x, next.orientation.y, next.orientation.z, next.orientation.w), 1);
});

test("kinetic energy is non-negative and zero for a stationary body", () => {
  assert.equal(rigidBodyKineticEnergy(body()), 0);
  const moving = body({ linearVelocity: { x: 2, y: 0, z: 0 } });
  near(rigidBodyKineticEnergy(moving), 4);
});

test("rejects non-positive mass, asymmetric and non-positive-definite inertia, and invalid dt", () => {
  assert.throws(() => createRigidBodyState({ mass: 0, inertiaBody: inertia }), RangeError);
  assert.throws(() => createRigidBodyState({ mass: 1, inertiaBody: [[1, 1, 0], [0, 1, 0], [0, 0, 1]] }), RangeError);
  assert.throws(() => createRigidBodyState({ mass: 1, inertiaBody: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] }), RangeError);
  assert.throws(() => integrateRigidBody(body(), zeroWrench, 0), RangeError);
});

test("rejects non-finite force and integration overflow", () => {
  assert.throws(() => integrateRigidBody(body(), {
    force: { x: NaN, y: 0, z: 0 }, torque: zeroWrench.torque
  }, 0.1), TypeError);
  assert.throws(() => integrateRigidBody(body({
    linearVelocity: { x: 1e308, y: 0, z: 0 }
  }), { force: zeroWrench.force, torque: zeroWrench.torque }, 1e308), RangeError);
});
