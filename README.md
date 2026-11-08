# Osmocean

**A physically grounded, interactive marine simulation platform.**

Osmocean is the independent successor to [Mocean](https://github.com/gemquota/mocean). It expands the original flexible-swimmer study into a modular simulation of creatures moving through a dynamic aquatic environment.

> **Principle:** the water, the creature, and the renderer are separate systems with explicit coupling contracts. Visual plausibility is not evidence of physical correctness.

## Project status

<badge>Foundation stage</badge>

The repository is being established. No production simulation engine, validated hydrodynamics model, or third-party runtime dependency is claimed yet.

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap and gates](docs/ROADMAP.md)
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

The initial foundation is documentation-first. The runtime stack will be selected after focused prototypes, not by installing a collection of impressive-sounding libraries and hoping they agree.

See [ROADMAP.md](docs/ROADMAP.md) for gates and acceptance criteria.
