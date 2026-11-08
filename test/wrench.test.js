import test from "node:test";
import assert from "node:assert/strict";
import { createWrenchAccumulator } from "../src/physics/wrench.js";

test("accumulates forces and moments about the declared origin", () => {
  const wrench = createWrenchAccumulator({origin:{x:1,y:0,z:0}});
  wrench.addForce({x:0,y:2,z:0},{x:1,y:0,z:3});
  const result = wrench.snapshot();
  assert.deepEqual(result.force,{x:0,y:2,z:0});
  assert.deepEqual(result.torque,{x:-6,y:0,z:0});
  assert.equal(result.forceCount,1);
});

test("direct torque and multiple force contributions add linearly", () => {
  const wrench = createWrenchAccumulator();
  wrench.addForce({x:1,y:0,z:0});
  wrench.addForce({x:-1,y:0,z:0},{x:0,y:0,z:2});
  wrench.addTorque({x:0,y:3,z:0});
  assert.deepEqual(wrench.snapshot().force,{x:0,y:0,z:0});
  assert.deepEqual(wrench.snapshot().torque,{x:0,y:1,z:0});
});

test("reset clears accumulators and counts without mutating prior snapshots", () => {
  const wrench = createWrenchAccumulator();
  wrench.addForce({x:1,y:0,z:0});
  const prior = wrench.snapshot();
  wrench.reset();
  assert.deepEqual(wrench.snapshot().force,{x:0,y:0,z:0});
  assert.equal(wrench.snapshot().forceCount,0);
  assert.deepEqual(prior.force,{x:1,y:0,z:0});
});

test("non-finite contributions are rejected", () => {
  const wrench = createWrenchAccumulator();
  assert.throws(()=>wrench.addForce({x:NaN,y:0,z:0}),TypeError);
  assert.throws(()=>wrench.addTorque({x:0,y:Infinity,z:0}),TypeError);
});
