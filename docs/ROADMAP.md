# Osmocean Roadmap

The roadmap is gate-driven. A gate closes only when its exit criteria are evidenced. A merged PR is not, by itself, proof that a feature works.

## Gate 0 — Successor foundation and predecessor audit

- [x] Establish independent repository identity.
- [x] Record architecture boundaries and engineering principles.
- [x] Record Mocean as predecessor and reference implementation.
- [x] Inventory Mocean source modules, tests, phase specifications and CI/deployment workflows.
- [x] Record implementation status separately from visual acceptance and user approval.
- [x] Create feature-level port / reimplement / defer / retire migration ledger.
- [ ] Capture representative visual baselines and compare the deployed presentation.
- [x] Execute Osmocean's own CI workflow and record actual results.
- [ ] Record dependency evaluations, licences, browser compatibility and mobile performance.
- [x] Implement provisional world-axis and SI-unit contract.
- [x] Implement fixed-step clock with bounded catch-up and explicit dropped-time accounting.
- [ ] User review and approve coordinate, unit, timestep, state-ownership and determinism contracts.
- [ ] Define initial browser/device targets and performance budgets.

**Exit:** reviewed source inventory, traceable parity ledger, visual reference, verified CI, stable contracts, and approved prototype questions.

## Gate 1 — Technical selection prototypes

- [ ] Compare rendering candidates against the Mocean presentation and target devices.
- [x] Prototype analytic affine/shear/vortex and bounded-grid spatial water-field sampling.
- [ ] Demonstrate a creature moving relative to moving water.
- [ ] Compare surface-wave approaches independently from underwater flow.
- [ ] Prototype contact / collision adapter boundaries.
- [ ] Benchmark CPU and GPU paths on desktop and mobile browsers.
- [ ] Record dependency licences, maintenance, browser compatibility, bundle cost, and replacement path.

**Exit:** measured prototype report and explicit architecture decisions. No library is adopted by assumption.

## Gate 2 — Simulation kernel

- [x] Fixed-step clock and bounded catch-up.
- [x] Deterministic update scheduler.
- [x] Seeded random streams.
- [x] Quaternion and local/world transform conventions.
- [x] Six-degree-of-freedom rigid-body state and full body-space inertia tensor.
- [x] World-space force/torque integration contract.
- [ ] Entity identity and lifecycle.
- [ ] Snapshot and render-interpolation boundary.
- [ ] Numerical test harness and long-run reproducibility fixtures.

**Exit:** deterministic test scenarios and validated module contracts.

## Gate 3 — Water environment

- [x] Uniform water-field reference implementation and contract tests.
- [x] Analytic spatial fields and bounded grid interpolation.
- [x] Local water-relative drag sampling.
- [x] Distributed surface drag and angular point velocity.
- [x] Local-density buoyancy using explicit waterline and volume quadrature.
- [ ] Time-dependent environmental fields.
- [ ] Optional temperature / pressure / salinity capabilities.
- [ ] Field visualisation and sampling diagnostics.

**Exit:** independently tested environment queries with documented units and interpolation semantics.

## Gate 4 — Creature mechanics and locomotion

- [x] Couple distributed drag and buoyancy wrenches to rigid-body integration.
- [x] Transform body-local surface quadrature into world space.
- [ ] Generate surface and volume quadrature weights from production body geometry.
- [ ] Add propulsion and control-surface force models.
- [ ] Validate full six-degree-of-freedom response against reference scenarios.
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

**Exit:** visual environment communicates simulated conditions without becoming the source of physical truth.

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

## Distributed fluid mechanics acceptance

- [x] Sample local water-relative drag and density.
- [x] Accumulate distributed surface forces and moments including angular point velocity.
- [x] Transform body-local surface quadrature into world space.
- [x] Evaluate discrete submerged-volume buoyancy using local density.
- [x] Assemble fluid loads and integrate body weight, drag and buoyancy through one rigid-body step.
- [ ] Generate quadrature weights from meshes or anatomical geometry.
- [ ] Characterise timestep sensitivity and spatial quadrature convergence over a parameter sweep.
- [ ] Validate torque-free asymmetric rigid-body motion against an analytic reference.
