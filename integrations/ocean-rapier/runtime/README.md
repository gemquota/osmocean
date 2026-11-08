# Ultra-Water + Rapier runtime integration

This build wires the canonical Osmocean adapter in `src/adapters/rapier-ultra-water.js` into the pinned Ultra-Water application. It does not maintain a second hydrodynamics implementation.

## Runtime composition

- Ultra-Water owns the FFT ocean, rendering, GPU query pass, procedural floater meshes and terrain-height function.
- Rapier 3D owns rigid-body state, collider contacts, angular/linear velocity and fixed-step integration.
- The canonical Osmocean adapter owns query-point transformation, asynchronous query matching, stale-readback rejection, water-relative velocity estimation, distributed buoyancy and quadratic drag.
- The runtime wrapper multiplexes per-body query requests into Ultra-Water's single bounded GPU readback pass.

## Data flow

1. Each Rapier body exposes body-local volume and surface sample points.
2. The core adapter transforms those points into world space and records the query timestamp.
3. The runtime wrapper combines every body's XZ probes (plus the camera probe) into one WaterQuery submission.
4. When the asynchronous GPU readback completes, the wrapper splits the result back into per-body query views.
5. Each canonical adapter validates the tag/timestamp and ingests its own sample set.
6. Before each 120 Hz Rapier step, the adapter applies buoyancy and drag at force application points. A terrain penalty-force model is also applied at sample points; it does not integrate or directly move bodies.
7. Rapier advances the world; the wrapper copies body transforms to the upstream meshes.

## Deliberate approximations

- Each floater uses a cuboid collision proxy from its visual bounds. A detailed convex hull can replace it later.
- The upstream floater volume sample locations are reused as surface drag probes with equal shares of the proxy cuboid surface area. This is a practical first quadrature, not a calibrated wetted-area distribution.
- Water velocity is estimated from successive displacement readbacks at body-attached sample indices. The source query is asynchronous and may lag by one to three frames.
- The adapter does not feed reaction impulses back into the FFT ocean and therefore does not create physically coupled wakes or local fluid displacement.
- The existing 2D/3D fluid solver applications remain standalone demos; they are not falsely described as coupled by this PR.

## Build

Both the Pages deployment and the pull-request verification workflow:
- check out Ultra-Water at pinned commit `30ea65ecb0a66b137aa200d099965634bdd84d51`;
- copy the canonical Osmocean adapter, vector primitive and runtime wrapper into the upstream source tree;
- apply a guarded patch to replace the upstream custom floater integrator;
- install `@dimforge/rapier3d-compat` and build the upstream Vite application.

The integrated build is served at `/ultra-water/`. WebGL2 desktop/mobile runtime testing remains a separate acceptance gate; CI build success alone does not prove GPU scene execution or physical accuracy.
