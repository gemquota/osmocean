import {
  assertFiniteNumber,
  assertPositiveFinite
} from "./units.js";

/**
 * Fixed-step accumulator for authoritative simulation updates.
 *
 * The callback runs once per completed simulation tick and receives the
 * end-of-step simulation time. Excess wall time is explicitly discarded
 * after bounded catch-up; it is never silently converted into a larger dt.
 */
export function createFixedStepClock({
  stepSeconds = 1 / 60,
  maxFrameSeconds = 0.25,
  maxStepsPerAdvance = 8
} = {}) {
  assertPositiveFinite(stepSeconds, "stepSeconds");
  assertPositiveFinite(maxFrameSeconds, "maxFrameSeconds");
  if (maxFrameSeconds < stepSeconds) {
    throw new RangeError("maxFrameSeconds must be at least stepSeconds");
  }
  if (!Number.isSafeInteger(maxStepsPerAdvance) || maxStepsPerAdvance < 1) {
    throw new RangeError("maxStepsPerAdvance must be a positive safe integer");
  }

  let tick = 0;
  let accumulator = 0;
  let droppedSecondsTotal = 0;
  let advancing = false;

  function snapshot(steps = 0, droppedSeconds = 0) {
    return Object.freeze({
      tick,
      timeSeconds: tick * stepSeconds,
      steps,
      alpha: accumulator / stepSeconds,
      droppedSeconds,
      droppedSecondsTotal
    });
  }

  return Object.freeze({
    stepSeconds,

    advance(frameSeconds, step) {
      assertFiniteNumber(frameSeconds, "frameSeconds");
      if (frameSeconds < 0) {
        throw new RangeError("frameSeconds must be non-negative");
      }
      if (typeof step !== "function") {
        throw new TypeError("step must be a function");
      }
      if (advancing) {
        throw new Error("Fixed-step clock cannot be advanced re-entrantly");
      }

      const acceptedSeconds = Math.min(frameSeconds, maxFrameSeconds);
      let droppedSeconds = frameSeconds - acceptedSeconds;
      accumulator += acceptedSeconds;
      let steps = 0;
      advancing = true;

      try {
        while (
          accumulator + stepSeconds * 1e-12 >= stepSeconds &&
          steps < maxStepsPerAdvance
        ) {
          const nextTick = tick + 1;
          step(Object.freeze({
            dt: stepSeconds,
            tick: nextTick,
            timeSeconds: nextTick * stepSeconds
          }));
          tick = nextTick;
          accumulator = Math.max(0, accumulator - stepSeconds);
          steps += 1;
        }
      } finally {
        advancing = false;
      }

      // Do not accumulate an unbounded backlog after a long stall.
      if (accumulator + stepSeconds * 1e-12 >= stepSeconds) {
        const wholeSteps = Math.floor(
          (accumulator + stepSeconds * 1e-12) / stepSeconds
        );
        const discarded = wholeSteps * stepSeconds;
        accumulator = Math.max(0, accumulator - discarded);
        droppedSeconds += discarded;
      }

      droppedSecondsTotal += droppedSeconds;
      return snapshot(steps, droppedSeconds);
    },

    reset() {
      if (advancing) {
        throw new Error("Cannot reset the clock during a simulation step");
      }
      tick = 0;
      accumulator = 0;
      droppedSecondsTotal = 0;
      return snapshot();
    },

    getSnapshot() {
      return snapshot();
    }
  });
}
