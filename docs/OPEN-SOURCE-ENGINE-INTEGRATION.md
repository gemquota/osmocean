# Open-source engine integration

## Decision

Osmocean is an integration and marine-domain project, not a replacement fluid solver. Prefer upstream engines for specialised numerical and rendering work. Osmocean owns stable adapters, units, coordinate conventions, validation, marine-specific forces and ecosystem behaviour.

## Selected foundations

| Role | Upstream | Licence | Intended responsibility |
|---|---|---|---|
| Local free-surface fluid | [jeantimex/fluid](https://github.com/jeantimex/fluid) | MIT | 2D PIC/FLIP, Hybrid FLIP, APIC, Canvas2D SPH and 3D WebGPU FLIP |
| Ocean surface and underwater rendering | [Humpalumps/Ultra-Water](https://github.com/Humpalumps/Ultra-Water) | MIT | Tessendorf FFT ocean, shore breakers, foam, caustics, underwater rendering and existing water-query/floater prototype |
| Rigid-body mechanics | [dimforge/rapier](https://github.com/dimforge/rapier) | Apache-2.0 | Rigid-body integration, contacts, collision queries and constraints |

## Demo deployment

The Osmocean deployment provides a dedicated `/lab.html` integration lab. It builds the pinned Ultra-Water Vite source into `/ultra-water/` and applies an Osmocean Rapier integration overlay during the Pages build. The ocean renderer and asynchronous GPU surface queries remain upstream; Rapier owns floating-object rigid-body state and contacts. Fluid and Rapier reference demos remain linked separately.

## Integration boundaries

1. **Upstream fluid solver:** owns particle/grid state, pressure projection, advection and solver-specific rendering.
2. **Ultra-Water:** owns FFT ocean surface generation and rendering effects. Its water query and floater hooks are candidates for adapters, not proof of two-way coupling.
3. **Rapier:** owns rigid-body state, collision detection, contacts and constraint solving.
4. **Osmocean adapters:** own SI unit conversion, world/local coordinate mapping, time-step policy, field sampling, force/torque exchange, lifecycle and error propagation. The first dependency-free Ultra-Water/Rapier adapter now lives in `src/adapters/rapier-ultra-water.js`; it consumes the upstream GPU query contract and applies point forces to Rapier-owned bodies.
5. **Marine domain:** owns body geometry/quadrature, drag/buoyancy models, swimming locomotion, animal morphology and ecosystem interactions.

## Current status

- **Fluid demos:** upstream 2D PIC/FLIP, Hybrid FLIP, APIC and Canvas2D plus WebGPU variants are available in the lab. WebGPU support is device-dependent.
- **Ultra-Water:** the actual upstream Vite project is built and served at `/ultra-water/` from pinned commit `30ea65ecb0a66b137aa200d099965634bdd84d51`. The project owner has verified that the scene renders on a real phone.
- **Rapier:** official 2D and 3D JavaScript demos are linked in the lab. Rapier 3D 0.21.0 is also initialized inside the Ultra-Water scene for floating-object rigid bodies.
- **Ultra-Water + Rapier:** integrated in the Pages build. Rapier owns the existing boat, buoy, crate and barrel bodies; the adapter consumes batched asynchronous WaterQuery readbacks and applies point buoyancy/drag forces. This is one-way coupling; reaction impulses do not modify the FFT ocean.
- **Two-way fluid/body coupling:** not yet implemented by the demo presentation.

See [COMBINATION-INVESTIGATION.md](./COMBINATION-INVESTIGATION.md) for the exhaustive three pairings + one triplet assessment and [ULTRA-WATER-RAPIER-SCENE.md](./ULTRA-WATER-RAPIER-SCENE.md) for the live scene's force model and limitations.
