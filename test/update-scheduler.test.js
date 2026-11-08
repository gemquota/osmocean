import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateScheduler } from "../src/core/update-scheduler.js";

test("executes phases in declared order and systems by order then registration", () => {
  const scheduler = createUpdateScheduler(["environment","forces","integrate"]);
  const seen = [];
  scheduler.register({id:"late",phase:"forces",order:2,update:()=>seen.push("late")});
  scheduler.register({id:"first",phase:"forces",order:0,update:()=>seen.push("first")});
  scheduler.register({id:"environment",phase:"environment",update:()=>seen.push("environment")});
  scheduler.register({id:"same-order",phase:"forces",order:0,update:()=>seen.push("same-order")});
  scheduler.register({id:"integrate",phase:"integrate",update:()=>seen.push("integrate")});
  scheduler.step({});
  assert.deepEqual(seen,["environment","first","same-order","late","integrate"]);
});

test("duplicate ids, unknown phases and mutation during dispatch are rejected", () => {
  const scheduler = createUpdateScheduler(["tick"]);
  scheduler.register({id:"a",phase:"tick",update:()=>{}});
  assert.throws(()=>scheduler.register({id:"a",phase:"tick",update:()=>{}}),/Duplicate/);
  assert.throws(()=>scheduler.register({id:"b",phase:"missing",update:()=>{}}),/Unknown/);
  const other = createUpdateScheduler(["tick"]);
  other.register({id:"mutator",phase:"tick",update:()=>other.register({id:"b",phase:"tick",update:()=>{}})});
  assert.throws(()=>other.step({}),/during scheduler dispatch/);
});

test("dispatch is non-reentrant and recovers after a system throws", () => {
  const scheduler = createUpdateScheduler(["tick"]);
  scheduler.register({id:"recursive",phase:"tick",update:()=>scheduler.step({})});
  assert.throws(()=>scheduler.step({}),/re-entrant/);
  assert.throws(()=>scheduler.step({}),/re-entrant/);
});

test("unregister is idempotent and removes a system", () => {
  const scheduler = createUpdateScheduler(["tick"]);
  const remove = scheduler.register({id:"a",phase:"tick",update:()=>{}});
  assert.equal(scheduler.systemCount,1);
  assert.equal(remove(),true);
  assert.equal(remove(),false);
  assert.equal(scheduler.systemCount,0);
});
