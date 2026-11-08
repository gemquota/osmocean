# Library demo and combination investigation

**Status:** initial upstream audit and deployed demo gallery. This document distinguishes verified upstream capabilities from proposed integration work. A group of iframes is not a physics integration.

## Verification ledger

See [COMBINATION-VERIFICATION.md](./COMBINATION-VERIFICATION.md) for the explicit classification vocabulary, exhaustive pair/triplet matrix, runtime test protocol, evidence boundaries, and next execution order. The ledger distinguishes source/API compatibility from demonstrated browser runtime and physical coupling.

## Upstream demo availability

| Foundation | Standalone demo path | Deployment status / constraints |
|---|---|---|
| [jeantimex/fluid](https://github.com/jeantimex/fluid) | [2D PIC/FLIP](https://jeantimex.github.io/fluid/src/flip/2d/pic_flip/), [2D Hybrid FLIP](https://jeantimex.github.io/fluid/src/flip/2d/hybrid_flip/), [2D APIC](https://jeantimex.github.io/fluid/src/flip/2d/apic/), [Canvas2D SPH](https://jeantimex.github.io/fluid/canvas2d.html), [2D WebGPU](https://jeantimex.github.io/fluid/webgpu2d.html), [3D WebGPU FLIP](https://jeantimex.github.io/fluid/src/flip/3d/webgpu_flip/) | Public upstream GitHub Pages. Canvas2D is a CPU compatibility fallback. WebGPU paths require a working adapter; an inspected 2D WebGPU page returned `Unable to acquire a WebGPU adapter` in the inspection environment. |
| [Humpalumps/Ultra-Water](https://github.com/Humpalumps/Ultra-Water) | [Osmocean-hosted upstream build](https://gemquota.github.io/osmocean/ultra-water/) | Built by the Osmocean GitHub Pages workflow from pinned upstream commit `30ea65ecb0a66b137aa200d099965634bdd84d51`; MIT licence and third-party notices ship with the build. Requires WebGL2. The generated index and JS bundle are reachable, but automated browser navigation timed out after 30 seconds, so the rendered scene is not yet runtime-verified. |
| [dimforge/rapier](https://github.com/dimforge/rapier) | [Official JS 2D demos](https://rapier.rs/demos2d/), [official JS 3D demos](https://rapier.rs/demos3d/) | Official hosted JavaScript/WASM demo pages. Rapier's full Rust testbed is a separate desktop/native application; the browser demos are the appropriate web path. |

## Exhaustive combinations of the three selected foundations

There are three two-library pairings and one three-library combination.

### 1. Fluid + Ultra-Water

**Potential division of labour**
- Ultra-Water: far-field ocean surface, FFT wave cascades, shoreline wave presentation, foam, caustics, underwater rendering.
- Fluid: a local free-surface domain for contained water, near-shore flow, wakes or high-detail interaction.

**Hard problems**
- Existing 2D PIC/FLIP and Hybrid FLIP examples are planar simulations, while Ultra-Water is a 3D heightfield/FFT surface renderer. They do not represent the same state.
- The 3D FLIP implementation is WebGPU-based and requires a working adapter.
- The fluid repository currently exposes complete Vite applications, not a documented package-level solver API or stable external state contract.
- The two solvers must not both claim ownership of the same volume. Prefer a nested/partitioned local domain with explicit boundary conditions and a conservative handoff, not two overlapping water surfaces.

**Assessment:** viable as far-field ocean plus local near-field fluid, but requires extracting or wrapping the FLIP solver and defining boundary exchange. A 2D solver is useful for a side-view prototype, not a physically complete 3D ocean coupling.

### 2. Fluid + Rapier

**Potential division of labour**
- Rapier: rigid-body pose, collision detection, contacts and constraints.
- Fluid: free-surface flow, pressure projection, particle/grid state and fluid-side moving boundaries.

**Required coupling**
1. Transform each Rapier collider into the fluid domain's coordinates.
2. Rasterize collider occupancy / signed distance into the fluid solver's boundary representation.
3. Enforce no-penetration at the moving fluid boundary and account for displaced volume.
4. Integrate pressure and viscous traction over the wetted body surface.
5. Apply the resulting force and torque to the Rapier body.
6. Apply the equal-and-opposite impulse to the fluid and validate momentum exchange.

**Hard problems:** no documented public adapter currently connects the upstream fluid application's moving obstacles to Rapier. A 2D fluid demo must pair with Rapier 2D; use the 3D FLIP solver for a 3D rigid-body experiment.

**Assessment:** technically coherent and valuable, but it is the most demanding solver coupling. Do not substitute particle visual overlap for displaced-volume and momentum exchange.

### 3. Ultra-Water + Rapier

**Existing upstream capability discovered**
- `WaterQuery` evaluates the rendered water surface at supplied world XZ positions and reads back height plus horizontal displacement asynchronously.
- Results can lag by 1–3 frames.
- Ultra-Water's `Floaters` currently integrates its own bodies with a 1/240 s substep, point-sample Archimedes buoyancy, and drag against water velocity estimated from changes in query displacement.
- This means Ultra-Water already contains a useful water-sampling and buoyancy prototype, but it does **not** currently use Rapier.

**Recommended adapter**
- Keep `OceanSim`, `OceanSurface` and `WaterQuery` as the water/rendering owner.
- Replace the custom `Floaters.Body` rigid-body state/integrator with Rapier rigid bodies and colliders.
- Preserve body-local sample points. Transform them through Rapier body poses, query the water surface, calculate per-sample buoyancy/drag, and apply forces at their world positions.
- Let Rapier own collision response and body integration. Do not also integrate the same body in `Floaters.integrate`.
- Account for asynchronous query age when estimating water velocity; avoid treating stale samples as current instantaneous velocity.

**Assessment:** best near-term two-library integration candidate. Existing code provides a concrete adapter seam and an observable test scene (boat, buoy, crates, barrels).

### 4. Fluid + Ultra-Water + Rapier

**Target architecture**
- Ultra-Water owns the far-field ocean surface and visual effects.
- A 3D FLIP domain owns local high-detail free-surface flow, displaced water and near-body wakes.
- Rapier owns rigid-body state, contacts and constraints.
- Osmocean owns unit/coordinate/time adapters, fluid boundary exchange, force/torque aggregation, domain handoff and validation.

**Critical requirements**
- One authoritative rigid-body integrator per body.
- One authoritative fluid state per volume.
- Explicit far-field/local-domain boundary conditions and a stable overlap/handoff region.
- Conservative mass/volume and momentum exchange across the fluid/body interface.
- Fixed-step scheduling with documented latency and interpolation for GPU readback.
- WebGPU capability detection and a non-WebGPU fallback for the local fluid domain.
- Instrumented checks for displaced volume, net impulse, energy drift, penetration and timestep sensitivity.

**Assessment:** plausible as a layered multi-scale architecture, not as three libraries simply running the same water scene. This is the long-term target after the Ultra-Water/Rapier adapter and fluid/Rapier boundary prototype.

## Combination summary

| Combination | Demo co-residency | Data API seam | Physical coupling effort | Recommended order |
|---|---|---|---|---:|
| Fluid + Ultra-Water | Gallery provides simultaneous independent panels; actual startup remains browser/GPU-dependent | Fluid API extraction and domain boundary needed | High | 3 |
| Fluid + Rapier | Gallery provides simultaneous independent panels | Moving-boundary adapter not exposed as a stable upstream API | Very high | 2 |
| Ultra-Water + Rapier | Gallery provides simultaneous independent panels | Clear seam in WaterQuery / Floaters | Medium | 1 |
| All three | Gallery provides simultaneous independent panels | Requires all adapters plus local/far-field handoff | Very high | 4 |

## Verification still required

- Exercise the Osmocean-hosted Ultra-Water build on desktop and mobile browsers. The deployment artifact contains the upstream index, 751 KB JS bundle and licence notices, and those static assets are reachable. Browser automation timed out waiting for the page load event even with the mobile profile; the actual WebGL canvas remains unverified.
- Exercise Rapier 2D and 3D demos on target browsers; hosted demo URLs are verified, but successful runtime execution is not inferred from their existence.
- Measure GPU memory, frame time and thermal behaviour with each pair and the triplet on the same device.
- Record WebGL2 and WebGPU capability separately. Ultra-Water is WebGL2; the selected fluid 3D route is WebGPU.
- Only after co-residency is stable should the project implement the first data-coupled prototype: Ultra-Water + Rapier buoyant floaters.

## Sources

- https://github.com/jeantimex/fluid
- https://github.com/Humpalumps/Ultra-Water
- https://github.com/dimforge/rapier
- https://rapier.rs/demos2d/
- https://rapier.rs/demos3d/
