# Fish models, behaviour and attribution

## Rigged 3D fish model

Osmocean's Ultra-Water build downloads the rigged fish model from [unclemattmakes/polyfish](https://github.com/unclemattmakes/polyfish) at pinned commit `1c0d7636f2c71fd81d001a597c13554f9cbdd417`.

- Source asset: `assets/models/fish_rigged.glb`
- Upstream licence: MIT; the upstream `LICENSE` file is checked out alongside the model.
- Build destination: `public/models/osmocean/fish_rigged.glb` in the generated Ultra-Water application.
- Runtime: Three.js `GLTFLoader` loads the model once; `SkeletonUtils.clone` creates per-fish skeleton-safe instances. The upstream MIT licence is copied beside the deployed model as `POLYFISH-LICENSE.txt`. Bounds are normalized and the longest model axis is aligned with the ecology's local forward axis.
- Animation: all clips embedded in the GLB are played per fish when present. The PolyFish procedural vertex-swim shader is also adapted with per-fish uniforms, so the body flexes even when the GLB has no baked swim clip. Its source and MIT notice are retained in this repository. If loading fails, the existing procedural fish mesh remains as a visible fallback.

The binary is deliberately fetched during the Pages build rather than duplicated in this repository. The pin makes the input reproducible and the upstream licence remains available at the source checkout.

## Behaviour and ecosystem integration

Osmocean keeps its own simulation state and physics authority. PolyFish's MIT-licensed Three.js ecosystem was reviewed for its creature lifecycle, feeding, metabolism, reproduction, predator avoidance and hunting patterns. Those systems were not copied wholesale: PolyFish uses a different Jolt-based architecture, while Osmocean's fish are agents in the native Ultra-Water scene and must remain independent of the renderer and Rapier adapter.

The native ecology already provides food-resource regrowth, feeding, energy budgets, sexual inheritance, mutation, neural steering and size/aggression-dependent predation. This increment adds:

- nearest eligible prey and nearest threat selection rather than whichever neighbour happens to be visited last;
- direct parent/offspring and shared-parent protection against predation;
- persistent short-lived food and threat memories;
- heritable curiosity, boldness, leadership and affiliation traits;
- emergent behavioural roles derived from those traits: leader, scout, shoaler, hunter, forager, shy or generalist;
- social following of stronger local leaders, exploratory movement by scouts, and stronger threat response in shy fish.

These are simplified simulation behaviours, not claims about validated species-specific ethology.

## Schooling reference

[spatial-pixel-fish](https://github.com/Sakeeb91/spatial-pixel-fish) is MIT-licensed and documents Reynolds-style cohesion, separation and alignment alongside the Vicsek heading-alignment model. It is retained as a reference; Osmocean continues to use its own 3D spatially indexed steering implementation rather than embedding the single-file 2D canvas demo.

## Fish social/role-playing reference

[SimFish](https://github.com/mhsenkow/SimFish) contains interesting work on individual minds, social signals, learning and fish-specific behaviour, but its repository tree does not expose a licence file. No SimFish source is copied or redistributed. Its ideas may inform original implementations, but code reuse must wait until the author clarifies licensing.

## Verification

The Pages smoke test checks that the pinned GLB loads, the native fish population has multiple emergent roles, the underwater scene has a visible renderer canvas, and the reef/ecology remain present. A passing build test is not a substitute for checking the deployed scene on a physical mobile GPU.
