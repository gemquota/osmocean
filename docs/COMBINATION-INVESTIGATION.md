# Library demo and combination investigation

**Status:** three coupling paths are implemented in the repository: Ultra-Water + Rapier 3D, 2D SPH + Rapier 2D, and a combined Ultra-Water → SPH → optional Rapier scene. All three paths pass the adapter tests and upstream build jobs in CI; real-device data-flow and numerical validation remain outstanding. Real-device numerical validation remains outstanding.

## Upstream demo availability

| Foundation | Standalone demo path | Deployment status / constraints |
|---|---|---|
| [jeantimex/fluid](https://github.com/jeantimex/fluid) | [2D PIC/FLIP](https://jeantimex.github.io/fluid/src/flip/2d/pic_flip/), [2D Hybrid FLIP](https://jeantimex.github.io/fluid/src/flip/2d/hybrid_flip/), [2D APIC](https://jeantimex.github.io/fluid/src/flip/2d/apic/), [Canvas2D SPH](https://jeantimex.github.io/fluid/canvas2d.html), [Osmocean SPH + Rapier](../fluid/rapier-fluid-2d.html), [Osmocean Ocean + SPH + Rapier](../fluid/fluid-ocean-rapier.html), [2D WebGPU](https://jeantimex.github.io/fluid/webgpu2d.html), [3D WebGPU FLIP](https://jeantimex.github.io/fluid/src/flip/3d/webgpu_flip/) | Pinned upstream source is built with Osmocean integration pages. Canvas2D is a CPU compatibility path; WebGPU paths require a working adapter. |
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

**Assessment:** a build-verified 2D far-field/local-domain prototype now exists at [Fluid + Ultra-Water](../fluid/fluid-ocean-rapier-2d.html?rapier=0). The Ultra-Water Rapier runtime batches external water probes into its existing GPU WaterQuery pass. The local SPH domain receives a height/displacement-derived surface forcing profile. This demonstrates real data exchange, but it is one-way, 2D, and does not conserve mass or momentum across the domain boundary. A production 3D coupling still needs a 3D FLIP moving-boundary interface and conservative transfer.

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

**Assessment:** a first 2D SPH/Rapier coupling prototype is implemented at [the deployed 2D demo](../fluid/rapier-fluid-2d.html). It uses the upstream Canvas2D SPH core's existing AABB obstacle, updates that obstacle from a rotation-locked Rapier 2D body, and applies a bounded pressure/relative-velocity estimate to the body. This is a bidirectional pose/load prototype, but not a momentum-conserving solver: upstream SPH parameters are not SI-calibrated, and reaction impulses are not returned to fluid particles. It demonstrates shared runtime state and body loading, not momentum-conserving two-way fluid-solid coupling.

### 3. Ultra-Water + Rapier

**Existing upstream capability and Osmocean integration**
- `WaterQuery` evaluates the rendered water surface at supplied world XZ positions and reads back height plus horizontal displacement asynchronously.
- Results can lag by 1–3 frames.
- The Osmocean Pages build replaces the custom `Floaters` integrator with Rapier 3D 0.21.0 while preserving the upstream meshes, WaterQuery and rendering pipeline.
- Rapier owns rigid-body state, contacts, gravity and fixed-step integration; Osmocean batches query samples and applies distributed buoyancy and drag at world-space points.
- The upstream custom integrator is not instantiated for the integrated scene.

**Implemented adapter and remaining work**
- Keep `OceanSim`, `OceanSurface` and `WaterQuery` as the water/rendering owner.
- Rapier rigid bodies and colliders now replace the custom floater integrator in the Osmocean-hosted build.
- Body-local volume and surface samples are transformed through Rapier poses and batched into the existing GPU query pass.
- Buoyancy and quadratic drag are applied at their sample points; Rapier derives torque and resolves body-body/terrain contacts.
- A 257 x 257 static heightfield is sampled from the upstream island-height function.
- Query latency is bounded and stale results are rejected. Water velocity remains an estimate from displacement readbacks.
- Remaining work: improve drag quadrature, validate mass/inertia and wave response, add physical telemetry and measure browser performance on target devices.

**Assessment:** first live two-library integration is now implemented in the hosted scene. It is one-way water-to-body coupling, not two-way momentum exchange: Rapier reaction impulses do not modify the FFT spectrum or generate resolved wakes.

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
| Fluid + Ultra-Water | 2D SPH surface forcing from batched Ultra-Water GPU queries | One-way far-field wave profile to local SPH domain | High; no mass/momentum conservation | 3 |
| Fluid + Rapier | Integrated 2D SPH + Rapier prototype plus standalone references | Shared AABB obstacle and bounded pressure/drag load adapter | High; two-way exchange remains unimplemented | 2 |
| Ultra-Water + Rapier | Live Rapier-backed floaters in the hosted Ultra-Water scene | Batched WaterQuery adapter and Rapier-owned bodies | Medium | 1 |
| All three | Ultra-Water → SPH → optional Rapier 2D prototype | Two sequential one-way adapters; no conservative three-way exchange | Very high; prototype only | 4 |

## Verification still required

- Exercise the Osmocean-hosted Ultra-Water build on desktop and mobile browsers. The deployment artifact contains the upstream index, 751 KB JS bundle and licence notices, and those static assets are reachable. Browser automation timed out waiting for the page load event even with the mobile profile; the actual WebGL canvas remains unverified.
- Exercise Rapier 2D and 3D demos on target browsers; hosted demo URLs are verified, but successful runtime execution is not inferred from their existence.
- Measure GPU memory, frame time and thermal behaviour with each pair and the triplet on the same device.
- Record WebGL2 and WebGPU capability separately. Ultra-Water is WebGL2; the selected fluid 3D route is WebGPU.
- Validate the new external WaterQuery probe path and combined Fluid/Ocean/Rapier scene on desktop and mobile; CI build success does not prove same-origin iframe data flow or GPU runtime behaviour.

## Sources

- https://github.com/jeantimex/fluid
- https://github.com/Humpalumps/Ultra-Water
- https://github.com/dimforge/rapier
- https://rapier.rs/demos2d/
- https://rapier.rs/demos3d/

## Fluid + Rapier prototype

See [the 2D integration notes](../integrations/fluid-rapier/README.md), [the force adapter](../src/adapters/rapier-fluid-sph2d.js), and [the deployed coupled demo](../fluid/rapier-fluid-2d.html). The Pages workflow builds a pinned upstream SPH app with the Osmocean page injected at build time.

## Fluid + Ultra-Water and three-engine prototype

The build injects the external-probe multiplexer into the Ultra-Water Rapier runtime. The parent page registers 25 XZ probes in the iframe; the child app appends them to its existing GPU query batch and publishes the matching readback slice. The local SPH adapter maps the sampled wave height and displacement velocity onto the local free-surface particle band. The optional Rapier 2D body then interacts with that same SPH domain. See [the multi-engine runtime](../fluid/fluid-ocean-rapier-2d.html) and [the ocean boundary adapter](../src/adapters/fluid-ocean-boundary.js).
