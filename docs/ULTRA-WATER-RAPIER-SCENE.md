# Live Ultra-Water + Rapier scene

The /ultra-water/ Pages build is patched at build time from the pinned
upstream Ultra-Water commit. The upstream repository remains untouched.

## Runtime ownership

- Ultra-Water owns the FFT ocean, shore-wave rendering and asynchronous
  WaterQuery GPU pass.
- Rapier 3D (pinned to @dimforge/rapier3d-compat 0.21.0) owns every floater's
  rigid-body transform, linear/angular velocity, collision response, gravity,
  and integration.
- Osmocean supplies the body-to-water adapter and batches all query points
  into the existing WaterQuery pass. The camera remains query slot zero;
  each body adapter reads its own stable slice of the completed readback.
- Rapier runs at a fixed 1/120 s step with a bounded six-step catch-up budget.
  The upstream custom Floaters.step() integrator is not instantiated.

## Bodies and collision

The existing upstream crate, barrel, buoy and boat meshes are retained.
Rapier colliders use cuboid, rotated cylinder, ball and convex-hull shapes
respectively. Collider mass is set from each upstream descriptor's density
and volume; inertia is computed from the collision proxy shape.

The island and seabed collision surface is sampled from the upstream
islandHeight function into a 257 x 257 sample matrix (256 x 256 Rapier
subdivisions) spanning 2.4 km. Rapier's API takes subdivision counts, not
sample counts; the helper enforces the required +1 matrix dimensions and
column-major storage. This is a collision approximation, not a replacement
for the rendered terrain. The surface grid spacing is about 9.4 m, so small
rocks and fine shoreline features are not represented in the rigid-body
collision surface.

## Hydrodynamic loading

- Buoyancy uses the upstream body's volume sample locations and distributes
  the body's displaced volume equally among them.
- Quadratic drag uses six area-weighted points on the body's axis-aligned
  bounding box. These are practical first-pass quadrature points, not exact
  mesh-surface integration.
- Forces are applied at world-space sample positions with Rapier
  addForceAtPoint, so torque comes from the physics engine.
- Water velocity is estimated from successive GPU displacement readbacks.
  It is not a direct Eulerian velocity measurement and includes some spatial
  sampling error as bodies move.
- Water readback is one to three frames delayed. Unknown layouts and stale
  results are rejected by the adapter.

## Startup diagnostics

The build patch installs visible error reporting for uncaught exceptions and
unhandled promise rejections before Rapier initialization. It exposes a
window-level boot status (`rapier-initializing`, `rapier-ready`,
`rapier-world-ready`, `scene-initialized`, or `error`) and displays startup
stacks in an on-page panel. The document and GUI titles identify the Rapier
integration rather than the upstream-only demo.

The shared GPU query capacity is 1024 points, matching the adapter's bound.
The Rapier step receives the current render simulation time when checking
readback age, rather than the previous frame's timestamp.

## Current limits

This is a real one-way water-to-body integration, not two-way fluid coupling.
Rapier reaction impulses do not modify the FFT ocean spectrum or create
resolved wakes. The existing water impact-ring effect is triggered on entry;
it is a visual ripple cue, not a momentum-conserving wake simulation.

The static island heightfield and approximate collider proxies should be
refined before treating the scene as a quantitative naval-architecture tool.
The first goal is a real, inspectable runtime integration with one owner for
each state domain, not false claims of research-grade hydrodynamics.
