# Osmocean

**A physically grounded, interactive marine simulation platform.**

Osmocean is the independent successor to [Mocean](https://github.com/gemquota/mocean). It expands the original flexible-swimmer study into a modular simulation of creatures moving through a dynamic aquatic environment.

> **Principle:** the water, the creature, and the renderer are separate systems with explicit coupling contracts. Visual plausibility is not evidence of physical correctness.

## Project status

**Status: native Ultra-Water ecology implementation integrated; deployment and runtime verification pending.**

The repository builds a browser scene from pinned Ultra-Water and jeantimex/fluid sources. The FFT ocean, Rapier rigid bodies and native fish ecology share the Ultra-Water Three.js renderer and scene. The ecology layer now includes inherited and mutating traits, a compact heritable neural policy, schooling, food-resource regrowth, feeding and energy budgets, mating/reproduction, evolved aggression and size-dependent predation, environmental gradients, and a live population-history observatory. The SPH experiments remain separate prototypes rather than a claimed three-way production solver. Ecological parameters are intentionally simplified and are not a validated marine-ecology model.

- [Architecture](docs/ARCHITECTURE.md)
- [Fish models, behaviour and attribution](docs/FISH-MODELS-AND-SOCIAL-ECOLOGY.md)
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


## Native Ultra-Water ecology

Fish agents are native scene objects, not an iframe or an adjacent demo. The ecology layer includes:

- Heritable traits for speed, body size, metabolism, sensory range, schooling, aggression, sociality, kin affinity, camouflage, feeding specialisation and fertility.
- Sexual inheritance from two parents, mutation rate/strength and generational ancestry.
- A compact 12-weight heritable policy that maps food, current, oxygen, temperature, light and social cues into movement decisions.
- Spatially indexed neighbour queries, schooling, separation, threat avoidance and size/aggression-dependent predation. There is no fixed predator species.
- Regenerating food biomass, feeding, energy expenditure, oxygen stress, reproduction and mortality.
- Spatially varying current, temperature, light, nutrient and oxygen fields.
- A live observatory panel with population, resource, mean-trait and generation readouts plus population-history chart.
- Runtime controls grouped into ecology, food web, evolution/predation and environment.

The model is an interactive evolutionary sandbox. Its simplified resource and predation rules are useful for observing feedback and selection, but should not be interpreted as empirically calibrated population dynamics.
