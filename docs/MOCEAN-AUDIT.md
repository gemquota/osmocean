# Mocean Source Audit

**Audit date:** 2026-11-09  
**Source:** `gemquota/mocean`, default branch `main`  
**Audited baseline:** Mocean main after merged PR #2  
**Successor:** `gemquota/osmocean`

This document records what is present in Mocean's current default branch, what its own roadmap says is accepted, and what Osmocean should inherit. It deliberately distinguishes source implementation, automated evidence, visual acceptance, and user approval.

## 1. Repository and delivery baseline

| Item | Observed state |
|---|---|
| Default branch | `main` |
| Runtime dependencies | None declared in `package.json` |
| Runtime | Browser ES modules and Canvas 2D |
| Test command | `npm test` using Node's built-in test runner |
| CI | GitHub Actions, Node 22, runs on push, pull request, and manual dispatch |
| Deployment | GitHub Pages workflow uploads the repository root and deploys it |
| Primary presentation | Full-screen, fixed-camera, side-view aquatic creature simulation |
| Development presentation | `development.html`, technical phase and implementation presentation |
| Main entry | `src/main.js` |
| Automated test file | `tests/core.test.js` |

Mocean has no package-level runtime dependencies. Its current implementation is a compact, native JavaScript simulation and Canvas renderer, not a Three.js or external physics-engine application.

## 2. Source inventory

### Core mechanics

| Module | Current responsibility | Migration assessment |
|---|---|---|
| `src/core/math.js` | Vector arithmetic, angle handling, quaternion composition/rotation/integration, perspective scale, distance treatment, habitat-return guidance | Reimplement against Osmocean's explicit conventions; compare behaviour with reference fixtures |
| `src/core/body.js` | 19-node damped elastic spine, travelling lateral muscle wave, gait profiles, energy reserve, tail-motion thrust estimate, pectoral-fin response, braking and body deformation | Port the useful model as a named legacy/phenomenological swimmer model; do not present it as validated hydrodynamics |
| `src/core/dynamics.js` | Body-axis thrust/side force, world-up lift, speed-dependent damping, vertical restoring term, soft habitat limits, yaw/pitch/roll response and quaternion attitude | Reimplement; the current function combines several responsibilities and uses phenomenological coefficients |
| `src/core/intent.js` | Horizontal heading sampling, sparse vertical-excursion selection, alternating climb/dive direction | Port as behaviour policy after Osmocean behaviour contracts exist |
| `src/core/maneuver.js` | Quintic spatial Bézier path generation and tangent/speed sampling; path is steering intent, not a kinematic rail | Port/adapt after trajectory and control interfaces are established |
| `src/core/sequences.js` | Isolated movement primitives, composite sequences, compound manoeuvres, eased segment hand-offs | Port sequence definitions and tests; replace implicit coupling with typed command contracts |
| `src/core/camera.js` | Fixed observer basis, 22-degree elevation, camera distance and view axes | Replace with renderer/camera adapter |
| `src/core/spawn.js` | Initial world-space spawn offset | Reassess as scenario configuration |
| `src/main.js` | Simulation state, autonomous behaviour selection, sequence scheduling, steering controller, fixed-step accumulator, Canvas projection/rendering, procedural fish mesh and particles | Split into orchestrator, behaviour, presentation and scenario modules |

### Presentation and delivery files

| File | Role | Migration assessment |
|---|---|---|
| `index.html` | Minimal full-screen Canvas shell, identity, caption and behaviour label | Preserve the restrained full-screen aesthetic; rebuild semantic shell |
| `styles.css` | Dark ocean palette, mint accents, DM Mono typography, responsive labels | Port design tokens and layout intent; avoid coupling simulation to CSS |
| `development.html` | Technical development/phase presentation | Audit its content and interaction separately before porting; do not blindly copy its monolith |
| `ROADMAP.md` | Canonical project plan, task evidence, phase gates and two-key completion record | Preserve evidence discipline; Osmocean has its own gate hierarchy |
| `PHASE_0.md` | Coordinate, architecture, camera and acceptance baseline | Use as historical design evidence, not as Osmocean's final coordinate contract |
| `PHASE_2_4.md` | Sequence design, kinematic evidence and limitations | Port the mechanics concepts and acceptance cases |
| `tests/core.test.js` | 60-case integrated regression suite on the merged Phase 1–4 baseline | Port tests selectively; preserve source fixtures and add Osmocean-specific contracts |
| `.github/workflows/test.yml` | Node 22 test workflow | Reuse the workflow pattern |
| `.github/workflows/pages.yml` | GitHub Pages deployment | Reuse only when Osmocean has a deployable browser app |

## 3. Phase and acceptance status

The source of truth is Mocean's own `ROADMAP.md` and `PHASE_2_4.md`, not the fact that a PR merged.

| Phase | Implementation state | Automated evidence | Visual/user acceptance |
|---|---|---|---|
| 0 · Architecture and baseline | Complete | Baseline source/test inventory documented | User-confirmed and gate approved 8 Nov 2026 |
| 1 · True 3D locomotion foundation | Complete | Roadmap records 26–27 passing tests and successful Pages deployment at its cited commits | All six tasks user-confirmed; gate approved 8 Nov 2026 |
| 2 · Elementary movement primitives | P2-1 assistant-complete; P2-2 through P2-5 implemented | Automated tests recorded as passing | Isolated visual inspection pending; no phase gate approval recorded |
| 3 · Basic composite motions | Sequence implementation integrated | Five kinematic checks recorded as passing | Live playback and cruising comparison pending; assistant completion withheld |
| 4 · Complex manoeuvre arrangements | Compound sequence implementation integrated | Four kinematic checks recorded as passing | Live playback pending; assistant completion withheld |
| 5 · Autonomous natural behaviour | Not complete | No acceptance evidence recorded | Open |
| 6 · Environment and water surface | Explicitly deferred | No implementation evidence recorded | Open |
| 7 · Integration and polish | Not complete | No final release evidence recorded | Open |

### Merged PR #2

[PR #2: Phase 1–4 locomotion primitives and manoeuvre sequences](https://github.com/gemquota/mocean/pull/2) was merged on 8 November 2026 as merge commit `7d8849e06e8b0fce3970b96f28f470721e6181e3`.

The PR reports 60 passing tests on Node 22. It explicitly leaves visual acceptance open. Its merge therefore establishes implementation integration, not completion or user approval of Phases 2–4.

### Open PR #1

[PR #1: Experiment: tap-to-swim 3D navigation](https://github.com/gemquota/mocean/pull/1) remains open on branch `experiment/tap-to-swim-3d`. It is an isolated experiment and does not alter Mocean `main` or its GitHub Pages deployment.

The experiment adds tap-selected destination navigation, a depth handle, guide geometry and DART recruitment for longer approaches. Its own description says hands-on interaction and pursuit-speed review remain outstanding. Osmocean should treat this as an optional interaction experiment, not as accepted baseline functionality.

## 4. Physical-model audit

Mocean is explicit that it is a biomechanical approximation, not a validated animal model or CFD solver. The source supports that description.

### What the model currently does

- Integrates a 19-node damped elastic spine with a travelling lateral muscle-wave target.
- Derives a bounded thrust estimate from tail-node lateral velocity and a slip correction.
- Changes gait amplitude/frequency with behaviour and available energy.
- Produces pectoral-fin deployment, fin drag and approximate yaw/roll moments.
- Applies thrust and side force along body axes, with lift along world-up.
- Applies speed-dependent damping and a vertical restoring term.
- Integrates yaw, pitch and roll response and quaternion orientation.
- Uses a fixed observer and perspective projection for the visual presentation.

### Important limits and successor implications

1. **No shared water field.** Drag/damping is based on body/world speed; there is no spatially sampled water velocity. A creature cannot yet distinguish swimming against a current from coasting with it.
2. **No dimensional hydrodynamics contract.** The current coefficients and state are phenomenological. Do not reinterpret them as SI-calibrated force, mass, inertia, area or drag coefficients during a file copy.
3. **No validated CFD or volumetric fluid simulation.** Environmental particles are visual drift elements, not fluid solver particles.
4. **Single-axis flexible centreline.** The spine state stores lateral displacement and velocity; independent vertical centreline curvature is absent.
5. **Simplified body/fin coupling.** The caudal fin is drawn as separate geometry rather than a fully reconstructed deforming attachment; body deformation is not a full 3D elastic shell.
6. **Phenomenological attitude model.** Rotational response and righting terms are tuned control approximations, not measured species-specific hydrodynamic moments/inertias.
7. **No general multi-body coupling.** The implementation is a single-creature study, not a multi-creature contact, schooling or ecosystem solver.
8. **Simulation/presentation coupling.** `src/main.js` owns behaviour, scheduling, simulation orchestration, camera projection and rendering in one module. This is the clearest structural reason to separate Osmocean's layers.
9. **No broad scenario/configuration API.** The deployed experience is deliberately full-screen and autonomous; it has no user-facing physics-control panel or general simulation embedding contract.

These are not reasons to discard Mocean. They define what must be preserved as a baseline and what must be redesigned for the successor.

## 5. Visual and interaction baseline

- Full-screen, dark underwater presentation with a restrained teal/mint palette.
- One primary procedural fish, side-on in a 3D habitat.
- Fixed elevated camera; creature moves relative to the habitat, camera does not chase.
- Body-local dorsal ridge and eye provide orientation cues.
- Sparse suspended particles provide depth and motion cues.
- Behaviour label and small typographic identity/caption; no dashboard-style controls.
- Responsive label positioning for narrow screens.
- Canvas rendering uses depth sorting, perspective scale and distance blur/fade.
- The development page is a separate technical presentation and should be reviewed independently from the deployed simulation.

Osmocean should retain this visual language as a starting point, while its architecture permits richer scenes and optional inspection/control interfaces.

## 6. Migration disposition

| Capability | Decision | Osmocean target |
|---|---|---|
| Vector/quaternion maths | Reimplement | Explicit world/body frames, validated operations and convention tests |
| Flexible lateral swimmer | Port concepts | A named legacy fish model behind a creature-mechanics interface |
| Two-axis 3D body deformation | Extend/reimplement | Independent dorsal-ventral and lateral curvature with stable cross-sections |
| Tail propulsion approximation | Reimplement | Explicit actuator/force model, initially calibrated against the legacy behaviour |
| Phenomenological dynamics | Reimplement | Shared force/torque accumulation and integration with declared units |
| Water-relative drag | New | Sample local water velocity at declared body/control-surface points |
| Buoyancy and density fields | New/reimplement | Environment-owned density and displaced-volume contract |
| Manoeuvre paths | Port/adapt | Trajectory intent separated from controller and dynamics |
| Motion sequences | Port/adapt | Declarative sequence definitions with typed bounded commands |
| Autonomous behaviour | Reimplement/extend | Persistent intent, utility/state policy and deterministic random streams |
| Fixed camera | Replace | Renderer-owned camera observing simulation snapshots |
| Procedural Canvas presentation | Reassess | Keep as lightweight reference renderer or replace behind renderer interface |
| Development presentation | Reassess | Rebuild from canonical data; avoid manual status drift |
| Tap-to-swim experiment | Defer/reassess | Optional input adapter after baseline navigation and behaviour contracts |
| Water surface/environment | New | Separate surface presentation from underwater water-field physics |
| Multi-creature/ecosystem | New | Later entity, interaction and population systems |

## 7. Required follow-up work

- [ ] Port the 60-test suite's valuable behavioural and kinematic assertions into Osmocean's test vocabulary.
- [ ] Add two-axis flexible-body acceptance tests before selecting a production swimmer representation.
- [ ] Define a unit migration/calibration record for every inherited coefficient.
- [ ] Compare the legacy and successor swimmer in matched still-water scenarios.
- [ ] Add moving-water tests proving co-moving bodies experience zero relative-flow drag.
- [ ] Record visual baseline captures and inspect the open tap-to-swim experiment separately.
- [ ] Decide whether the Canvas renderer remains as a lightweight fallback when the first 3D renderer prototype is evaluated.

## 8. Audit limitations

This is a source-and-document audit of Mocean's default branch and its two relevant pull requests. It does not claim a fresh execution of Mocean's test suite in this session, a new live-browser visual inspection, or acceptance of any still-open phase. The recorded CI evidence is attributed to the exact commits and workflow links in Mocean's own project records.
