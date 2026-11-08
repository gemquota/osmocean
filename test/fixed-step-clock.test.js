import test from "node:test";
import assert from "node:assert/strict";
import { createFixedStepClock } from "../src/core/fixed-step-clock.js";

test("advances only in fixed increments and reports interpolation alpha", () => {
  const clock = createFixedStepClock({ stepSeconds: 0.1 });
  const calls = [];
  const first = clock.advance(0.25, state => calls.push(state));
  assert.equal(first.steps, 2);
  assert.equal(first.tick, 2);
  assert.equal(first.timeSeconds, 0.2);
  assert.ok(Math.abs(first.alpha - 0.5) < 1e-10);
  assert.deepEqual(calls.map(call => call.tick), [1, 2]);
  assert.ok(calls.every(call => call.dt === 0.1));
});

test("equivalent elapsed time produces the same authoritative tick sequence", () => {
  const a = createFixedStepClock({ stepSeconds: 0.01 });
  const b = createFixedStepClock({ stepSeconds: 0.01 });
  const ticksA = [];
  const ticksB = [];
  for (let i = 0; i < 10; i += 1) a.advance(0.01, state => ticksA.push(state.tick));
  b.advance(0.1, state => ticksB.push(state.tick));
  assert.deepEqual(ticksA, ticksB);
});

test("bounds work and explicitly accounts for discarded stall time", () => {
  const clock = createFixedStepClock({
    stepSeconds: 0.01,
    maxFrameSeconds: 1,
    maxStepsPerAdvance: 3
  });
  let calls = 0;
  const result = clock.advance(0.5, () => { calls += 1; });
  assert.equal(calls, 3);
  assert.equal(result.steps, 3);
  assert.ok(result.droppedSeconds > 0.45);
  assert.ok(result.alpha >= 0 && result.alpha < 1);
  assert.equal(result.droppedSecondsTotal, result.droppedSeconds);
});

test("clamps excessive frame delta and accumulates dropped time", () => {
  const clock = createFixedStepClock({
    stepSeconds: 0.1,
    maxFrameSeconds: 0.3,
    maxStepsPerAdvance: 8
  });
  const result = clock.advance(2, () => {});
  assert.equal(result.steps, 3);
  assert.ok(Math.abs(result.droppedSeconds - 1.7) < 1e-10);
});

test("zero frame delta performs no work", () => {
  const clock = createFixedStepClock();
  const result = clock.advance(0, () => assert.fail("unexpected step"));
  assert.equal(result.steps, 0);
  assert.equal(result.tick, 0);
  assert.equal(result.alpha, 0);
});

test("rejects invalid configuration and frame deltas", () => {
  assert.throws(() => createFixedStepClock({ stepSeconds: 0 }), RangeError);
  assert.throws(() => createFixedStepClock({ maxFrameSeconds: 0 }), RangeError);
  assert.throws(() => createFixedStepClock({
    stepSeconds: 0.1, maxFrameSeconds: 0.05
  }), RangeError);
  assert.throws(() => createFixedStepClock({ maxStepsPerAdvance: 0 }), RangeError);
  const clock = createFixedStepClock();
  assert.throws(() => clock.advance(-1, () => {}), RangeError);
  assert.throws(() => clock.advance(NaN, () => {}), TypeError);
  assert.throws(() => clock.advance(0.1, null), TypeError);
});

test("failed step is not committed to the clock", () => {
  const clock = createFixedStepClock({ stepSeconds: 0.1 });
  assert.throws(() => clock.advance(0.1, () => {
    throw new Error("integration failed");
  }), /integration failed/);
  assert.equal(clock.getSnapshot().tick, 0);
  assert.equal(clock.getSnapshot().timeSeconds, 0);
  const recovered = clock.advance(0, () => {});
  assert.equal(recovered.tick, 1);
});

test("prevents re-entrant advance and reset during a step", () => {
  const clock = createFixedStepClock({ stepSeconds: 0.1 });
  assert.throws(() => clock.advance(0.1, () => {
    assert.throws(() => clock.advance(0, () => {}), /re-entrantly/);
    assert.throws(() => clock.reset(), /during a simulation step/);
  }), undefined);
  assert.equal(clock.getSnapshot().tick, 1);
});

test("reset clears tick, remainder and dropped-time accounting", () => {
  const clock = createFixedStepClock({ stepSeconds: 0.1 });
  clock.advance(0.25, () => {});
  const reset = clock.reset();
  assert.equal(reset.tick, 0);
  assert.equal(reset.timeSeconds, 0);
  assert.equal(reset.alpha, 0);
  assert.equal(reset.droppedSecondsTotal, 0);
});
