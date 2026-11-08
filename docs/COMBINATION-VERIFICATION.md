# Library combination verification ledger

**Audit date:** 2026-11-09  
**Scope:** the three selected foundations currently represented in the Integration Lab: jeantimex/fluid, Humpalumps/Ultra-Water, and Dimforge/Rapier.  
**Evidence rule:** a panel appearing beside another panel proves only co-residency. It does not prove shared state, force exchange, physical coupling, or useful interoperability.

## Classification vocabulary

| Classification | Meaning | Evidence required |
|---|---|---|
| **Compatible — demonstrated** | The combination works for the stated integration purpose. | Reproducible runtime test plus explicit data/physics contract tests. |
| **Compatible — adapter required** | Responsibilities are complementary and a credible adapter seam exists, but integration is not yet implemented. | Source/API inspection and a defined ownership/coupling design. |
| **Compatible — independent subsystems** | Both can be present in one application, but do not exchange authoritative simulation state. | Co-residency/runtime test; no coupling claim. |
| **Functionally redundant** | Both systems attempt to own the same effect and there is no justified partition of responsibility. | Overlapping capabilities and no stable ownership split. |
| **Incompatible** | A concrete technical constraint prevents the intended combination in the target environment. | Reproducible failure or incompatible contracts, not merely missing integration. |
| **Untested** | Available evidence is insufficient to classify runtime behaviour. | No successful target-environment test. |

A combination may have two statuses at once, for example **independent co-residency: unverified** and **physical integration: adapter required**. Do not collapse these into a single green tick.

## Standalone foundation inventory

| Foundation | Intended role | Existing evidence | Remaining verification |
|---|---|---|---|
| **jeantimex/fluid** | Local free-surface fluid solver. The selected project contains 2D PIC/FLIP, Hybrid FLIP, APIC, Canvas2D SPH, and WebGPU paths including 3D FLIP. | Public upstream demos and paths are recorded in [COMBINATION-INVESTIGATION.md](./COMBINATION-INVESTIGATION.md). Canvas2D is the CPU compatibility route. An inspected WebGPU path previously reported that it could not acquire a WebGPU adapter. | Re-run each selected path on target browsers/devices; record actual canvas activity, errors, frame rate, and WebGPU availability. |
| **Humpalumps/Ultra-Water** | Far-field ocean surface, wave displacement, surface/underwater presentation, and water-surface queries. | Pinned upstream Vite source was built into the Osmocean Pages deployment; generated static assets and licence notices were reachable. Source inspection identifies WaterQuery and a custom Floaters implementation. | The earlier automated browser attempt timed out before confirming a rendered WebGL2 scene. Confirm on real WebGL2 desktop and mobile devices. |
| **Dimforge/Rapier** | Rigid-body poses, contacts, collision queries, joints, and constraints. | Official JavaScript 2D and 3D demo URLs are recorded in the investigation. | Confirm that both demo families execute in the target browsers and record WebAssembly startup, canvas activity, and performance. |

## Exhaustive combination matrix

There are exactly three unordered pairs and one three-library combination for this three-foundation set.

| Combination | Co-residency classification | Physical / data integration classification | Current verdict |
|---|---|---|---|
| **Fluid + Ultra-Water** | Compatible as independent subsystems in the lab design; actual simultaneous runtime remains unverified. | Adapter required: local fluid domain must be partitioned from the far-field ocean and exchange boundary state. Existing 2D solvers are not the same state as Ultra-Water's 3D FFT surface. | **Promising, but not coupled.** |
| **Fluid + Rapier** | Compatible as independent subsystems in the lab design; actual simultaneous runtime remains unverified. | Adapter required: moving collider boundaries, displaced volume, pressure/viscous loads, and equal/opposite momentum exchange are needed. | **Technically coherent, high effort.** |
| **Ultra-Water + Rapier** | Compatible as independent subsystems in the lab design; actual simultaneous runtime remains unverified. | Adapter required: replace Ultra-Water's custom floater rigid-body integrator with Rapier while retaining WaterQuery and applying per-sample buoyancy/drag to Rapier bodies. | **Best first integration candidate; not yet demonstrated.** |
| **Fluid + Ultra-Water + Rapier** | Three independent panels are configured; actual simultaneous runtime remains unverified. | Multiple adapters required: Rapier/body-fluid exchange plus local-fluid/far-field boundary handoff. | **Plausible layered architecture; not coupled.** |

No pairing is currently classified as **compatible — demonstrated** for physical integration. No pairing is declared **incompatible** merely because the upstream projects lack an adapter. No pairing is declared **functionally redundant** where a defensible partition of responsibilities exists.

## Detailed ownership contracts

### Fluid + Ultra-Water

- Ultra-Water owns the far-field ocean surface and its rendering.
- Fluid owns a bounded local volume, such as a near-body wake or a contained side-view domain.
- Osmocean owns scale conversion, coordinate transforms, domain boundaries, handoff, and validation.
- Do not let two solvers own the same water volume.
- A 2D fluid domain can support a side-view prototype, but must not be represented as a complete 3D ocean coupling.

**Required tests:** surface/domain alignment; boundary inflow/outflow; mass/volume balance; wave-to-local-domain transfer; local-domain-to-ocean handoff; stability under timestep and domain-size changes.

### Fluid + Rapier

- Rapier owns rigid-body pose, contacts, and constraints.
- Fluid owns fluid velocity, pressure, and free-surface state inside its domain.
- Osmocean owns collider-to-fluid boundary mapping and wrench transfer.
- Transform colliders into fluid coordinates; rasterize occupancy or signed distance; enforce moving-boundary no-penetration; integrate pressure and viscous traction; apply the resulting force/torque to Rapier; apply the corresponding impulse to the fluid.
- Match dimensions: 2D fluid with Rapier 2D, or 3D fluid with Rapier 3D.

**Required tests:** displaced volume; penetration; net linear and angular impulse; momentum balance; pressure-load convergence; timestep sensitivity; stable moving boundaries.

### Ultra-Water + Rapier

- Ultra-Water retains OceanSim, OceanSurface, and WaterQuery as the water-surface authority.
- Rapier owns each coupled rigid body's pose, velocity, collision response, and integration.
- Preserve body-local buoyancy sample points. Transform them using Rapier poses, query the water surface, calculate buoyancy and drag per sample, and apply forces at the sample world positions.
- Remove or bypass the custom Floaters integration for bodies migrated to Rapier. Never integrate a body in both systems.
- WaterQuery results may lag by 1–3 frames; timestamp samples and estimate water velocity using sample age rather than treating stale displacement as instantaneous velocity.
- Do not add duplicate buoyancy or drag from both systems.

**Required tests:** static float equilibrium; Archimedes displaced-volume check; wave-following response; drag against moving water; torque from off-centre samples; contact with other Rapier bodies; stale-query handling; deterministic fixed-step behaviour; no double integration.

### Fluid + Ultra-Water + Rapier

- Ultra-Water owns far-field surface presentation and queryable surface state.
- A 3D FLIP domain owns local high-detail flow and wakes.
- Rapier owns rigid bodies and contacts.
- Osmocean owns adapters, time coordination, local/far-field boundary exchange, force aggregation, and conservation checks.

**Required tests:** all pairwise tests above, plus domain overlap/handoff, volume conservation, momentum conservation, GPU readback latency, deterministic scheduling, and graceful fallback when WebGPU is unavailable.

## Runtime test protocol

The existing Integration Lab deliberately creates isolated iframe panels. This is useful for a co-residency test, but it is not a coupling harness. Each test run must record:

1. Commit/deployment URL and test date.
2. Browser, OS, device, GPU, WebGL2 availability, and WebGPU availability.
3. Standalone startup outcome for every participating engine.
4. Whether the canvas actually renders and advances, not merely whether the iframe URL loads.
5. Console/runtime errors, failed network requests, and WebAssembly/GPU initialization failures where observable.
6. Frame time, memory pressure, and thermal behaviour for a fixed observation interval.
7. For a coupling prototype: shared data path, authoritative state owner, timestep/substep order, units, coordinate transforms, and conservation/error measurements.
8. Evidence artifact or reproducible instructions.

Run each standalone first, then each pair, then the triplet. Use the same device and browser for comparative performance. Repeat cold starts and warm starts. Record WebGPU unavailable as a capability limitation, not as proof that the entire library is incompatible.

## Immediate execution order

1. Verify standalone Fluid compatibility paths (PIC/FLIP, Hybrid FLIP, APIC, Canvas2D SPH), then test WebGPU paths separately.
2. Verify the Ultra-Water WebGL2 scene on an actual supported device.
3. Verify Rapier 2D and 3D browser demos.
4. Run all three pairs and the triplet as co-resident demos, recording actual render/startup outcomes.
5. Build the Ultra-Water + Rapier buoyant-floater adapter first.
6. Prototype Fluid + Rapier moving boundaries.
7. Prototype Fluid + Ultra-Water local/far-field handoff.
8. Attempt the three-way architecture only after its component pair contracts pass.

## Current evidence boundary

This ledger is a source/API architecture assessment plus a test plan. It does **not** claim that all browser/device runs have completed, that any pair/triplet has been measured successfully, or that any physical coupling is implemented. Update each row only when the evidence required by its classification is attached.
