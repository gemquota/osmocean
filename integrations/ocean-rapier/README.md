# Ultra-Water + Rapier integration

This integration replaces Ultra-Water's custom floater rigid-body integrator with Rapier 3D while preserving the upstream FFT ocean, GPU water queries, floater meshes, splash/ripple presentation and terrain-height query.

## Runtime ownership

| Concern | Owner |
|---|---|
| Ocean surface, wave state and rendering | Ultra-Water |
| Water height and displacement samples | Ultra-Water `WaterQuery` |
| Rigid-body pose, velocity, angular velocity, collision proxy and fixed-step integration | Rapier 3D |
| Per-sample buoyancy and water-relative drag | Osmocean adapter |
| Terrain contact penalty forces | Osmocean adapter; Rapier integrates the resulting body motion |
| Floater mesh and shadow presentation | Ultra-Water |

The adapter is injected into the pinned upstream source during the Pages build. The upstream repository is not forked or silently edited in place. The build checks out the recorded upstream commit, copies this adapter into it, applies a guarded source patch, installs `@dimforge/rapier3d-compat`, then builds the result.

## Coupling details

- Water samples retain the upstream query's asynchronous 1–3 frame latency.
- The adapter estimates water velocity from successive displacement samples and clamps the estimate to the upstream model's practical range.
- Buoyancy and drag are evaluated at the existing body-local sample points and applied to Rapier with `addForceAtPoint`, so forces generate both translation and torque.
- Rapier advances at 120 Hz with a bounded accumulator (maximum eight steps per rendered frame).
- Each floater uses a cuboid collision proxy derived from its visual bounds. This is intentionally approximate; the boat hull is not represented by a dynamic triangle mesh.
- Terrain contact retains the upstream penalty-force model, but Rapier owns all body integration and resulting pose.
- The old `Floaters` integrator is no longer instantiated by the patched build.

## Build and verification

The GitHub Pages workflow applies the patch and builds the integrated demo at `/ultra-water/`. It also runs the pure buoyancy-sampling contract tests.

This is a first executable coupling, not a claim of full hydrodynamic accuracy. Remaining validation includes mobile and desktop WebGL2 runtime checks, mass/inertia calibration, hull collision refinement, force/timestep sensitivity, water-query latency measurement, and momentum/energy error instrumentation. In particular, the cuboid proxy and point-sample hydrostatics are engineering approximations, not a resolved pressure-field solver.
