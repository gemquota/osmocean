# Engineering Principles

## Physical integrity

- Distinguish physical state, control intent, and rendered pose.
- Apply forces through a declared mechanics model; do not disguise animation offsets as forces.
- Use local water velocity when computing hydrodynamic response.
- Keep force, torque, mass, inertia, area, and coefficient units explicit.
- State the assumptions and validity range of every approximate model.
- Do not claim CFD, biological fidelity, or validation without corresponding evidence.

## Numerical integrity

- Fixed-step integration for authoritative state.
- Explicit integration method and stability limits.
- Bounded catch-up after frame stalls.
- Seeded randomness and reproducible scenarios.
- Tests for conservation, boundedness, symmetry, sign, and limiting cases where applicable.
- No NaN / infinity propagation; fail visibly in development builds.
- Avoid arbitrary clamps that hide unstable or incorrectly scaled models.

## Architecture

- Simulation does not import renderer modules.
- Behaviour does not directly overwrite physical state.
- Renderer does not own physical state.
- Each physical effect has one authority.
- External engines are adapters, not invisible global dependencies.
- Interfaces describe units, frames, timing, validity, and ownership.

## Performance

- Profile before optimizing.
- Measure simulation and rendering separately.
- Keep data-oriented hot paths possible without prematurely forcing ECS complexity.
- Avoid per-particle / per-body allocation in hot loops.
- Benchmark on representative mobile hardware as well as desktop.
- GPU implementations must preserve a testable reference path.

## Evidence and delivery

- Every PR states scope, tests, visual checks, and known limitations.
- Every roadmap item has atomic child tasks and acceptance criteria.
- Implemented, tested, visually inspected, and user-accepted are distinct statuses.
- Do not claim a deployment or test passed unless it was actually run.
