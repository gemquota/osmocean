import test from "node:test";
import assert from "node:assert/strict";
import { rigidBodyState, integrateRigidBody } from "../src/physics/rigid-body.js";

const inertia = {x:2,y:3,z:4};
const near = (a,b,e=1e-9) => assert.ok(Math.abs(a-b)<=e, `${a} != ${b}`);

test("semi-implicit translation integrates constant force", () => {
  const state = rigidBodyState();
  const next = integrateRigidBody({state,mass:2,inertia,force:{x:4,y:0,z:0},torque:{x:0,y:0,z:0},dt:.5});
  near(next.linearVelocity.x,1);
  near(next.position.x,.5);
});

test("torque changes world angular momentum and rotates the body", () => {
  const state = rigidBodyState();
  const next = integrateRigidBody({state,mass:1,inertia,force:{x:0,y:0,z:0},torque:{x:0,y:0,z:4},dt:.25});
  near(next.angularMomentum.z,1);
  assert.ok(next.orientation.z > 0);
  near(Math.hypot(next.orientation.x,next.orientation.y,next.orientation.z,next.orientation.w),1);
});

test("zero wrench preserves a stationary body", () => {
  const state = rigidBodyState({position:{x:2,y:3,z:4}});
  const next = integrateRigidBody({state,mass:5,inertia,force:{x:0,y:0,z:0},torque:{x:0,y:0,z:0},dt:.01});
  assert.deepEqual(next.position,state.position);
  assert.deepEqual(next.orientation,state.orientation);
});

test("invalid mass, inertia and timestep are rejected", () => {
  const state = rigidBodyState();
  const args = {state,mass:1,inertia,force:{x:0,y:0,z:0},torque:{x:0,y:0,z:0},dt:.01};
  assert.throws(()=>integrateRigidBody({...args,mass:0}),RangeError);
  assert.throws(()=>integrateRigidBody({...args,inertia:{x:1,y:0,z:1}}),RangeError);
  assert.throws(()=>integrateRigidBody({...args,dt:0}),RangeError);
});
