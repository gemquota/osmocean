# Mocean Migration and Feature Parity

**Predecessor:** [gemquota/mocean](https://github.com/gemquota/mocean)  
**Successor:** [gemquota/osmocean](https://github.com/gemquota/osmocean)

Osmocean is an independent successor, not a GitHub fork. Mocean remains intact as the reference implementation until the successor passes its migration and acceptance gates.

## Known Mocean baseline

The current Mocean README identifies these modules and capabilities:

| Mocean area | Known implementation | Initial successor disposition |
|---|---|---|
| `src/core/math.js` | Vector operations, quaternion rotation, angle handling | Reimplement or port after unit/frame contract is fixed |
| `src/core/body.js` | Travelling-wave body deformation, gait adaptation, tail propulsion, burst-energy cost | Port concepts; validate against new mechanics interfaces |
| `src/core/dynamics.js` | Fixed-step motion, drag, buoyancy, rotational response, soft boundaries | Reimplement against shared water-field contract |
| `src/core/maneuver.js` | Spatial Bézier steering intent and smooth endpoint tangents | Port after intent/control boundary is defined |
| `src/core/sequences.js` | Eased primitives, composite motions, compound manoeuvre intent | Port and test against new scheduler |
| `src/core/camera.js` | Fixed-camera basis and projection framing | Replace with renderer adapter where appropriate |
| `src/main.js` | Autonomous behaviour, sequencing, projection, procedural rendering | Split into behaviour, orchestration, and renderer |
| Tests | Node test runner; README specifies Node 22+ | Port useful tests and expand numerical coverage |
| Presentation | Full-screen autonomous swimmer; development presentation | Preserve useful aesthetic and interaction ideas, not implementation coupling |

The Mocean README explicitly describes the current model as a biomechanical approximation, not a validated animal model or CFD solver. Its hydrodynamic coefficients are phenomenological and require calibration against measured swimming data. Osmocean must preserve that honesty.

## Phase implementation status

The latest inspected Mocean commit is:

- `7d8849e06e8b0fce3970b96f28f470721e6181e3`
- Message: **Implement Phase 2–4 locomotion sequences**
- Commit description: physics-driven primitives and compound manoeuvre intent were added; automated kinematic evidence was recorded while visual acceptance and user phase gates remained open.

This is evidence of implementation work, not proof that every Phase 2–4 acceptance gate is complete. The detailed phase documents, test fixtures, open PRs, and deployed presentation still require a full inventory before the parity matrix can be considered complete.

## Migration decision vocabulary

- **Port:** retain code with bounded adaptation and tests.
- **Reimplement:** preserve behaviour/intent but replace internals to meet successor contracts.
- **Replace:** use a verified alternative with explicit adapter and acceptance evidence.
- **Defer:** intentionally postpone with reason and dependency.
- **Retire:** remove from successor scope with reason.
- **Unassessed:** insufficient evidence; never silently treat as complete.

## Feature ledger

| Feature | Mocean evidence | Decision | Osmocean status | Acceptance evidence |
|---|---|---|---|---|
| Vector / quaternion math | README module inventory | Reimplement | Unassessed | Unit and convention tests |
| Flexible travelling-wave body | README module inventory | Port concepts | Unassessed | Shape, phase, stability and regression tests |
| Tail-driven propulsion | README module inventory | Reimplement | Unassessed | Momentum / force bounds and locomotion tests |
| Fixed-step dynamics | README module inventory | Reimplement | Unassessed | Determinism and timestep-invariance tests |
| Drag and buoyancy | Approximate models documented | Reimplement | Unassessed | Still-water and moving-water force tests |
| Angular response | README module inventory | Reimplement | Unassessed | Torque / inertia tests |
| Manoeuvre intent | Bézier steering module | Port | Unassessed | Tangent continuity and reachability tests |
| Compound sequences | Latest Phase 2–4 commit | Port | Unassessed | Sequence continuity and kinematic tests |
| Autonomous behaviour | README module inventory | Reimplement | Unassessed | Seeded scenario tests |
| Fixed camera / projection | README module inventory | Replace | Unassessed | Renderer acceptance |
| Procedural presentation | Existing deployed experience | Reassess | Unassessed | Visual comparison and user acceptance |
| Development presentation | `development.html` | Reassess | Unassessed | Content and interaction audit |

## Required inventory before Gate 0 closes

- [ ] Inspect every source module and test, not only README summaries.
- [ ] Inspect all phase specifications and acceptance checklists.
- [ ] Inspect open and merged PRs for work not represented on main.
- [ ] Compare deployed presentation against current main.
- [ ] Capture baseline screenshots / behaviour notes for visual parity.
- [ ] Map each phase requirement to code, tests, and visible behaviour.
- [ ] Resolve status drift between implementation notes and phase acceptance.
- [ ] Record every item as port, reimplement, replace, defer, retire, or unassessed.

No parity percentage is published until this inventory is complete.
