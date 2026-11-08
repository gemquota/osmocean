# Osmocean Architecture

## 1. System shape

Osmocean is a layered simulation, not a renderer with fish attached.

```text
Application / Presentation
  ├─ Renderer and camera
  ├─ Input, inspection and debug overlays
  └─ UI / scenario controls
          │ read-only snapshots + commands
          ▼
Simulation Orchestrator
  ├─ Fixed-step clock
  ├─ Deterministic update schedule
  ├─ Entity lifecycle
  └─ Snapshot / interpolation boundary
          │
          ├────────────── Water Environment
          │                 ├─ Velocity field
          │                 ├─ Density / temperature / pressure fields
          │                 ├─ Surface and depth boundaries
          │                 └─ Sampling and temporal semantics
          │
          ├────────────── Creature Mechanics
          │                 ├─ Rigid / articulated state
          │                 ├─ Flexible body model
          │                 ├─ Propulsion and control surfaces
          │                 ├─ Hydrodynamic force models
          │                 └─ Contact / habitat constraints
          │
          └────────────── Behaviour
                            ├─ Intent and state machines
                            ├─ Navigation and manoeuvre planning
                            └─ Energy / feeding / interaction policies
```

The renderer consumes immutable or otherwise read-only snapshots. It must not mutate authoritative simulation state.

## 2. Coordinate and unit contract

The initial kernel contract is implemented in `src/core/units.js`:

- Right-handed world frame.
- +X points right, +Y points up, +Z points toward the viewer.
- Angles are radians at kernel boundaries.
- Physical quantities use SI: metres, kilograms, seconds, newtons, pascals, kg/m³, m² and N·m.
- World-space vectors are distinct from camera/view-space vectors. A renderer may transform between them but cannot redefine the simulation frame.

The contract is executable and covered by unit tests. Quaternion multiplication order, local body frames, and angular-velocity conventions remain explicit follow-up decisions; the world-axis declaration does not pretend to settle those separate questions.

No module may silently reinterpret units or coordinate frames.

## 3. Simulation update order

The initial authoritative tick contract:

1. Advance simulation time by fixed `dt`.
2. Update environmental fields to the tick's time.
3. Sample local water and environmental state at each relevant body / control-surface location.
4. Evaluate behaviour intent and control targets.
5. Evaluate anatomy, gait and actuator state.
6. Accumulate forces and torques from explicitly registered models.
7. Integrate linear and angular dynamics.
8. Resolve constraints and contacts using the selected authority.
9. Update energy and lifecycle state.
10. Publish a completed state snapshot.

The precise order may evolve, but it must remain explicit, tested, and deterministic for a fixed input sequence and seed. Coupled solvers may require substeps; those substeps must be declared rather than hidden.

The initial `createFixedStepClock` implementation owns the fixed-step accumulator and tick counter. It supplies a constant `dt`, monotonically increasing integer tick, and tick-derived simulation time. It bounds catch-up work and reports discarded wall time instead of silently increasing `dt`. It does not own simulation state or promise rollback of a caller's partially-mutated state if a step callback throws.

## 4. Water-field contract

The water environment is queried through a stable interface. At minimum, a sample must identify:

- world position,
- simulation time,
- water velocity,
- density,
- and validity / boundary information.

Temperature, pressure, salinity, turbulence descriptors, and wave state can be added as optional capabilities with explicit availability. Missing fields must not silently become physically meaningful zeroes.

A creature's local relative velocity is:

`v_relative = v_body - v_water(position, time)`

For a simple quadratic drag model:

`F_drag = -0.5 * rho * Cd * A * |v_relative| * v_relative`

This is a model component, not a universal whole-animal truth. Projected area, drag coefficient, flow direction, body articulation, and local flow sampling must be treated deliberately. Distributed bodies may require multiple local force samples.

## 5. Creature mechanics

Creature-specific mechanics remain native Osmocean domain logic unless a candidate library demonstrably provides the required model and can be integrated without surrendering state ownership.

Expected capabilities:

- rigid-body translation and rotation,
- articulated and flexible anatomy,
- travelling-wave body deformation,
- fin and tail kinematics,
- propulsion and manoeuvring forces,
- buoyancy and weight,
- drag and lift approximations,
- added-mass / fluid-inertia approximations where justified,
- energy cost and actuator limits.

Behaviour supplies intent and control targets. Mechanics determine the resulting movement. No behaviour module may teleport a creature or directly overwrite physical velocity to obtain a desired pose.

## 6. Third-party library policy

Candidate technologies are evaluated independently:

- **Three.js:** rendering and scene presentation only.
- **Rapier:** candidate rigid-body/contact adapter, not a fish locomotion or hydrodynamics model.
- **Ocean-surface techniques:** surface appearance and displacement; not automatically a volumetric fluid solver.
- **SPH / FLIP / lattice-Boltzmann implementations:** candidate local-fluid solvers only after browser, performance, numerical, and coupling prototypes.

No candidate is adopted solely because it is popular or visually impressive. Each evaluation records licence, maintenance, browser support, device performance, numerical behaviour, API fit, state ownership, and exit cost.

Never run two independent systems as authoritative owners of the same physical effect. A library may provide a force or field estimate to the kernel, but the integration contract must identify exactly who owns the resulting state.

## 7. Determinism and performance

- Fixed-step authoritative simulation, with bounded catch-up work.
- Render interpolation separated from simulation integration.
- Seeded random streams separated by subsystem/entity where practical.
- No frame-rate-dependent force or behaviour calculations.
- Explicit profiling of field sampling, neighbour queries, body deformation, and rendering.
- Mobile browser performance is a first-class constraint.
- GPU acceleration is an implementation option, not a prerequisite for correct simulation semantics.

## 8. Testing evidence

Every feature records its evidence level:

- **Implemented:** code exists.
- **Unit verified:** isolated numerical or behavioural tests pass.
- **Integration verified:** contracts work across modules.
- **Visual verified:** representative scenes inspected at target sizes/devices.
- **User accepted:** user explicitly accepts the result.

These states are not interchangeable.
