# Mocean Migration and Feature Parity

**Predecessor:** [gemquota/mocean](https://github.com/gemquota/mocean)  
**Successor:** [gemquota/osmocean](https://github.com/gemquota/osmocean)  
**Relationship:** independent successor; Mocean remains the reference implementation.

The detailed, current source audit is [MOCEAN-AUDIT.md](MOCEAN-AUDIT.md). This file is the concise migration ledger. No parity percentage is published until all items have explicit dispositions and acceptance evidence.

## Mocean baseline

Mocean is a dependency-free browser ES-module / Canvas 2D single-creature study. Its current main branch contains the Phase 1–4 sequence implementation merged by [PR #2](https://github.com/gemquota/mocean/pull/2). That PR records 60 passing Node 22 tests, while explicitly leaving visual acceptance for Phases 2–4 open.

Phase 0 and Phase 1 are user-confirmed and approved. Phase 2–4 implementation is integrated but visual acceptance and user gate approval remain open. Phase 5 is not complete; Phase 6 is deferred; Phase 7 is open.

[Open PR #1](https://github.com/gemquota/mocean/pull/1) is a separate tap-to-swim navigation experiment and is not part of the main-branch baseline.

## Feature ledger

| Mocean feature | Source evidence | Disposition | Osmocean target / acceptance |
|---|---|---|---|
| Vector and quaternion maths | `src/core/math.js` | Reimplement | Explicit conventions; identity, inverse/normalisation, composition and rotation tests |
| 19-node flexible lateral spine | `src/core/body.js` | Port concepts | Preserve legacy model; test stability, curvature and shape |
| Two-axis 3D body curvature | Not implemented | Extend | Independent lateral and vertical curvature; cross-section continuity tests |
| Tail-wave propulsion estimate | `src/core/body.js` | Reimplement | Bounded actuator/force interface; calibration comparison against legacy output |
| Fin steering, braking and moments | `src/core/body.js` | Reimplement | Declared local force/torque effects; symmetry and sign tests |
| Translation and attitude dynamics | `src/core/dynamics.js` | Reimplement | Shared integrator and force/torque accumulator; deterministic tests |
| Water-relative drag | Not implemented | New | Co-moving body/water yields zero drag; current reversal changes force direction |
| Buoyancy / density field | Simplified vertical restoring term only | Reimplement | Environment-owned density and displaced-volume inputs |
| Habitat soft limits | `src/core/dynamics.js` | Reassess | General boundary/constraint interface |
| Behaviour states and energy | `src/core/body.js`, `src/main.js` | Reimplement | Persistent intent, deterministic policies and energy accounting |
| Horizontal heading / sparse vertical intent | `src/core/intent.js` | Port/adapt | Seeded behaviour-policy tests |
| Quintic manoeuvre intent | `src/core/maneuver.js` | Port/adapt | Trajectory continuity and controller reachability tests |
| Phase 2 primitives | `src/core/sequences.js` | Port/adapt | Typed commands, isolated primitive tests and visual checks |
| Phase 3 composites | `src/core/sequences.js` | Port/adapt | Momentum/attitude separation and smooth hand-off tests |
| Phase 4 compound manoeuvres | `src/core/sequences.js` | Port/adapt | Bounded compound response and live visual review |
| Fixed camera | `src/core/camera.js` | Replace | Renderer-owned camera; simulation remains camera-agnostic |
| Procedural Canvas renderer | `src/main.js` | Reassess | Retain as fallback or replace behind renderer interface |
| Single-creature presentation shell | `index.html`, `styles.css` | Port design | Preserve restrained underwater aesthetic |
| Development presentation | `development.html` | Reassess | Rebuild from canonical status data |
| Tap-to-swim experiment | Open PR #1 | Defer/reassess | Optional input adapter after navigation contract exists |
| Environmental particles | `src/main.js` | Reimplement | Distinguish visual particles from physical fluid tracers |
| Surface waves / wind / water field | Phase 6 roadmap only | New | Separate surface displacement from underwater flow |
| Multi-creature ecosystem | Not implemented | New | Later entity interaction and population model |

## Evidence vocabulary

- **Implemented:** code exists in the target branch.
- **Unit verified:** isolated tests pass.
- **Integration verified:** module contracts work together.
- **Visually verified:** representative behaviour has been inspected.
- **User accepted:** the user explicitly confirms the result.
- **Unassessed:** evidence is insufficient.

A merged PR or a passing test suite does not imply visual verification or user acceptance.

## Gate 0 inventory remaining

- [x] Inspect Mocean root files, source modules, tests, phase documents and workflows.
- [x] Inspect merged Phase 1–4 PR #2 and open tap-to-swim PR #1.
- [x] Record source-level limitations and migration dispositions.
- [ ] Capture and compare representative visual baselines.
- [ ] Execute Osmocean's own test workflow and record its result.
- [ ] Review dependency candidates, licences, browser support and mobile performance.
- [ ] Approve Osmocean's unit/frame/timestep contract before importing legacy mechanics.

The source audit is complete at the code/documentation level. Gate 0 remains open until the remaining evidence and contract decisions are complete.
