# Open-source engine integration

## Decision

Osmocean is an integration and marine-domain project, not a replacement fluid solver. Prefer upstream engines for specialised numerical and rendering work. Osmocean owns stable adapters, units, coordinate conventions, validation, marine-specific forces and ecosystem behaviour.

## Selected foundations

| Role | Upstream | Licence | Intended responsibility |
|---|---|---|---|
| Local free-surface fluid | [jeantimex/fluid](https://github.com/jeantimex/fluid) | MIT | 2D PIC/FLIP, hybrid FLIP, 3D SPH and WebGPU PIC/FLIP |
| Ocean surface and underwater rendering | [Humpalumps/Ultra-Water](https://github.com/Humpalumps/Ultra-Water) | MIT | Tessendorf FFT ocean, shore breakers, foam, caustics, underwater rendering and sample buoyancy |
| Rigid-body mechanics | [dimforge/rapier](https://github.com/dimforge/rapier) | Apache-2.0 | Rigid-body integration, contacts, collision queries and constraints |

## Browser presentation

The browser lab embeds the upstream-hosted 2D PIC/FLIP and hybrid FLIP demos, plus the upstream 3D WebGPU dashboard. The iframe is a live upstream application, not a copied or reimplemented solver. The 3D view requires WebGPU; the 2D modes are the compatibility path.

The Ultra-Water repository documents a Vite development/build workflow and does not publish a hosted demo URL. It is therefore listed as a selected upstream dependency but is not falsely represented as embedded or deployed here. Its source must be built and integrated as a proper Three.js renderer before the Osmocean browser lab can claim to use it at runtime.

Rapier is selected for rigid-body mechanics. The existing Osmocean rigid-body prototype must be compared against Rapier before choosing whether to replace it, wrap it, or retain only marine-specific state and force assembly. Do not maintain two competing general-purpose rigid-body solvers.

## Integration boundaries

1. **Upstream fluid solver:** owns particle/grid state, pressure projection, advection and solver-specific rendering.
2. **Ultra-Water:** owns FFT ocean surface generation and its rendering effects. Its water query and floater hooks are candidates for adapters, not proof of two-way coupling.
3. **Rapier:** owns collision detection, rigid-body contacts and constraint solving.
4. **Osmocean adapters:** own SI unit conversion, world/local coordinate mapping, time-step policy, field sampling, force/torque exchange, lifecycle and error propagation.
5. **Marine domain:** owns body geometry/quadrature, drag/buoyancy models, swimming locomotion, animal morphology and ecosystem interactions.

## Required integration gates

- Pin upstream revisions and record corresponding licence text and notices.
- Build upstream projects independently before adapting them.
- Define explicit adapters for water velocity/height queries and body state.
- Verify timestep, unit, axis and handedness conventions at each boundary.
- Establish whether coupling is one-way or two-way; never imply feedback where only a sampled query exists.
- Add regression tests for finite states, boundary handling, force/torque sign conventions, momentum exchange and deterministic stepping where supported.
- Benchmark mobile and desktop paths separately. WebGPU is optional, not a universal browser assumption.

## Current status

- **Live browser solver:** upstream jeantimex/fluid 2D PIC/FLIP and hybrid FLIP demos embedded; 3D WebGPU demo selectable.
- **Ultra-Water:** selected and documented; no upstream-hosted demo exists, so runtime integration remains pending.
- **Rapier:** selected and documented; runtime adoption and comparison with the existing Osmocean rigid-body prototype remain pending.
- **Two-way fluid/body coupling:** not yet implemented by this browser presentation.

## Upstream references

- https://github.com/jeantimex/fluid
- https://github.com/Humpalumps/Ultra-Water
- https://github.com/dimforge/rapier
