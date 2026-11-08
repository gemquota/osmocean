# Gate 0: executable kernel contracts

## Scope

This change moves the first two foundation decisions out of prose and into tested code:

1. Canonical world axes and SI unit names.
2. Fixed-step authoritative time with bounded catch-up.

It deliberately does not add a renderer, rigid-body solver, creature model, or general simulation scheduler.

## World frame and units

`src/core/units.js` declares a right-handed world frame:

- +X: right
- +Y: up
- +Z: toward the viewer

Kernel physical quantities use SI units. Angles are radians. Camera/view transforms are downstream transforms and cannot redefine the world frame.

The module also exports finite, positive-finite, and non-negative-finite scalar guards for physical parameter validation.

Not yet settled: quaternion multiplication order, local creature/body frames, angular velocity sign conventions, and any species-specific parameter calibration. Those require explicit decisions and tests rather than assumptions smuggled into a generic units module.

## Fixed-step clock

`createFixedStepClock` provides:

- constant `dt` per callback,
- monotonically increasing integer ticks,
- simulation time derived from `tick * dt`,
- an accumulator and interpolation alpha,
- a maximum accepted frame delta,
- a maximum number of updates per advance,
- explicit per-call and cumulative dropped-time accounting,
- reset and immutable snapshots,
- rejection of invalid deltas and re-entrant advancement.

If a callback throws, that tick is not committed by the clock and the unconsumed accumulator remains available for a later retry. The clock cannot roll back external state partially mutated by the callback; production integration callbacks must therefore be designed as atomic steps or treat exceptions as fatal.

Excess whole-step backlog is discarded after the configured work budget. This is an explicit responsiveness policy, not a claim that discarded simulation time has been physically simulated. Callers must inspect dropped-time telemetry in diagnostics and tests.

## Verification

New automated coverage checks:

- axis declarations and immutability,
- SI unit declarations,
- scalar validation boundaries,
- fixed-step cadence and tick-derived time,
- equivalent elapsed-time tick sequences,
- bounded catch-up and dropped-time reporting,
- frame-delta clamping,
- invalid inputs,
- callback failure semantics,
- re-entrancy protection,
- reset semantics.

The PR's CI run is the authoritative test result. No visual verification is applicable to these non-rendering contracts.

## Acceptance still required

- Confirm +Z toward viewer is the desired world convention for Osmocean.
- Confirm the initial default step and catch-up limits are suitable for target simulation workloads.
- Decide whether dropped-time policy should remain discard-with-telemetry or become configurable per application mode.
- Complete quaternion, local-frame, state ownership, scheduler, and deterministic-random contracts before Gate 0 closes.
