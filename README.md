# Osmocean

**A physically grounded, interactive marine simulation platform.**

Osmocean is the independent successor to [Mocean](https://github.com/gemquota/mocean). It expands the original flexible-swimmer study into a modular simulation of creatures moving through a dynamic aquatic environment.

> **Principle:** the water, the creature, and the renderer are separate systems with explicit coupling contracts. Visual plausibility is not evidence of physical correctness.

## Project status

**Status: integration prototype with an initial native fish-agent layer under verification.**

The repository builds a unified browser scene from pinned Ultra-Water and jeantimex/fluid sources. The FFT ocean and Rapier rigid bodies share one Three.js renderer, one scene, one Rapier world and one fixed-step callback. A native fish-agent layer is being added directly to that Ultra-Water scene. The SPH experiments remain separate prototypes rather than a claimed three-way production solver. This is not a production or conservation-complete fluid/solid solver.

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap and gates](docs/ROADMAP.md)
- [Gate 0 kernel contracts](docs/GATE-0-KERNEL-CONTRACTS.md)
- [Mocean source audit](docs/MOCEAN-AUDIT.md)
- [Mocean migration and feature parity](docs/MOCEAN-PARITY.md)
- [Engineering principles](docs/ENGINEERING-PRINCIPLES.md)
- [Decision records](docs/decisions/)

## Direction

Osmocean will preserve and extend Mocean's strongest work: flexible-body locomotion, tail-driven propulsion, bounded dynamics, autonomous manoeuvre intent, and a clear distinction between implemented behaviour and verified behaviour.

The successor adds a shared water environment, spatially varying currents, environmental forces, additional creature architectures, and eventually ecosystem interactions.

## Architectural boundaries

- **Simulation kernel:** deterministic fixed-step scheduling, state ownership, units, coordinate frames, and reproducible execution.
- **Water environment:** queryable velocity and environmental fields, with explicit sampling semantics.
- **Creature mechanics:** anatomy, articulation, propulsion, buoyancy, drag, lift, and manoeuvring.
- **Behaviour:** intent and decision-making; it requests motion but does not teleport or bypass mechanics.
- **Rendering:** presentation only. It observes simulation state and never owns physical truth.
- **Adapters:** optional libraries are isolated behind interfaces and cannot silently become competing authorities for the same physics.

## Engineering rules

1. One authoritative owner for each simulated quantity and physical effect.
2. Fixed timestep for authoritative simulation; rendering may interpolate.
3. Forces use relative water velocity, not world velocity.
4. Units, axes, handedness, and sign conventions are documented and tested.
5. External dependencies require a recorded evaluation, licence review, browser/device test, and a replaceable adapter.
6. Numerical tests, visual inspection, and user acceptance are separate evidence states.
7. Mocean remains unchanged as a reference until parity and migration gates are satisfied.

## Development

The runtime adapters are replaceable modules. The current coupling uses a reduced-order wave boundary and scaled SPH-to-body loads; conservative momentum exchange, a volumetric 3D near-field solver and validated marine hydrodynamics remain future work.

See [ROADMAP.md](docs/ROADMAP.md) for gates and acceptance criteria.


## Native ecology layer

The first ecology increment adds deterministic fish agents directly to the Ultra-Water scene and render loop. Fish have heritable movement traits (speed, size, cohesion, alignment, separation, sensory range, metabolism and camouflage), spatially indexed neighbour queries, schooling/separation steering, a bounded water-column habitat and a live population control. Their meshes use the upstream scene's renderer, camera, lighting and underwater post-processing.

This is an initial locomotion/population foundation, not a completed ecosystem. Feeding, energy recovery, reproduction, mutation, neural-network brains, predation, food webs, environmental gradients and population-history tooling remain unimplemented until separately tested.
