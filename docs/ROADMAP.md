# Osmocean Roadmap

The roadmap is gate-driven. A gate closes only when its exit criteria are evidenced. A merged PR is not, by itself, proof that a feature works.

## Gate 0 — Successor foundation and predecessor audit

- [x] Establish independent repository identity.
- [x] Record architecture boundaries and engineering principles.
- [x] Record Mocean as predecessor and reference implementation.
- [x] Inventory Mocean root files, source modules, tests, phase specifications and CI/deployment workflows.
- [x] Inspect merged Mocean PR #2 and open experiment PR #1.
- [x] Record Mocean implementation status separately from visual acceptance and user approval.
- [x] Create feature-level port / reimplement / defer / retire migration ledger.
- [ ] Capture representative visual baselines and compare the deployed presentation.
- [x] Execute Osmocean's own CI workflow and record actual results (initial workflow run passed).
- [ ] Record dependency evaluations, licences, browser compatibility and mobile performance.
- [x] Implement provisional world-axis and SI-unit contract.
- [x] Implement fixed-step clock with bounded catch-up and explicit dropped-time accounting.
- [ ] User review and approve coordinate, unit, timestep, state-ownership and determinism contracts.
- [ ] Define initial browser/device targets and performance budgets.

**Exit:** reviewed source inventory, traceable parity ledger, visual reference, verified Osmocean CI, stable contracts, and approved prototype questions.

## Gate 1 — Technical selection prototypes

- [ ] Compare rendering candidates against the Mocean presentation and target devices.
- [ ] Prototype spatially varying water-field sampling.
- [ ] Demonstrate a creature moving relative to moving water.
- [ ] Compare surface-wave approaches independently from underwater flow.
- [ ] Prototype contact / collision adapter boundaries.
- [ ] Benchmark CPU and GPU paths on desktop and mobile browsers.
- [ ] Record dependency licences, maintenance, browser compatibility, bundle cost, and replacement path.

**Exit:** measured prototype report and explicit architecture decisions. No library is adopted by assumption.

## Gate 2 — Simulation kernel

- [x] Fixed-step clock and bounded catch-up (initial implementation; CI verification pending for this PR).
- [ ] Deterministic update scheduler.
- [ ] Seeded random streams.
- [ ] Entity identity and lifecycle.
- [ ] Quaternion and local/world transform conventions.
- [ ] Force and torque accumulation contracts.
- [ ] Snapshot and render-interpolation boundary.
- [ ] Numerical test harness and reproducibility fixtures.

**Exit:** deterministic test scenarios and validated module contracts.

## Gate 3 — Water environment

- [x] Uniform water-field reference implementation and contract tests.
- [ ] Spatially varying current implementations.
- [ ] Density and buoyancy inputs.
- [ ] Surface/depth boundary representation.
- [ ] Time-dependent environmental fields.
- [ ] Optional temperature / pressure / salinity capabilities.
- [ ] Field visualisation and sampling diagnostics.

**Exit:** independently tested environment queries with documented units and interpolation semantics.

## Gate 4 — Creature mechanics and locomotion

- [ ] Port/reimplement Mocean flexible-body and gait concepts against the new contracts.
- [ ] Six-degree-of-freedom rigid-body state.
- [ ] Local relative-water velocity sampling.
- [ ] Buoyancy, drag, propulsion, and control-surface forces.
- [ ] Rotational response and angular inertia.
- [ ] Flexible body / articulated anatomy interface.
- [ ] Energy limits and recovery.
- [ ] Manoeuvre intent separated from physical response.
- [ ] Numerical and visual regression fixtures.

**Exit:** at least one creature swims coherently through still and moving water without direct pose/velocity teleportation.

## Gate 5 — Ocean presentation and coupling

- [ ] Surface wave representation and renderer adapter.
- [ ] Consistent surface normals / depth boundary queries where required.
- [ ] Underwater lighting, attenuation, and visual depth cues.
- [ ] Currents and environmental motion visualisation.
- [ ] Coupling tests between surface and underwater fields.
- [ ] Rendering remains a consumer of simulation state.

**Exit:** visual environment communicates the simulated conditions without becoming the source of physical truth.

## Gate 6 — Behaviour and ecosystem

- [ ] Navigation and obstacle avoidance.
- [ ] Persistent behavioural intent.
- [ ] Feeding / energy / recovery loops.
- [ ] Species-specific locomotion strategies.
- [ ] Multi-creature interactions.
- [ ] Population lifecycle and ecological interactions.
- [ ] Habitat and environmental responses.

**Exit:** repeatable scenarios with bounded, inspectable behaviour and no hidden state shortcuts.

## Gate 7 — Migration parity and release

- [ ] Every Mocean feature has a documented disposition and acceptance result.
- [ ] Regression suite passes.
- [ ] Desktop and mobile browser verification passes.
- [ ] Performance budgets are met or exceptions are documented.
- [ ] Accessibility and reduced-motion behaviour are reviewed for UI.
- [ ] GitHub Pages deployment is reproducible.
- [ ] User-facing status distinguishes implemented, verified, and accepted work.

**Exit:** release candidate with parity report, known limitations, and deployment verification.

## Work decomposition rules

Each implementation item must be decomposed into small, independently reviewable tasks with:

- explicit source modules and interfaces,
- preconditions and dependencies,
- implementation notes,
- automated acceptance tests,
- visual acceptance where applicable,
- performance implications,
- rollback / replacement considerations.

Do not mark a parent task complete while any required child task remains incomplete.

## Water-field mechanics integration

- [x] Compose sampled local water velocity and density with quadratic relative-flow drag.
- [x] Propagate invalid spatial samples without inventing a fallback force.
- [x] Evaluate discrete world-space surface drag samples using local flow and density.
- [x] Include angular point velocity and accumulate total force and moment about the centre of mass.
- [ ] Couple the resulting wrench to rigid-body force and torque integration.
- [ ] Generate surface quadrature points from body geometry and orientation.
- [ ] Characterise spatial sampling convergence, timestep sensitivity, and energy dissipation under representative flows.
