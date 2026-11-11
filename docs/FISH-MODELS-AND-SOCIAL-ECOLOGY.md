# Fish models, behaviour and attribution

## Rigged 3D fish model

Osmocean's Ultra-Water build downloads the rigged fish model from [unclemattmakes/polyfish](https://github.com/unclemattmakes/polyfish) at pinned commit `1c0d7636f2c71fd81d001a597c13554f9cbdd417`.

- Source asset: `assets/models/fish_rigged.glb`
- Upstream licence: MIT; the upstream `LICENSE` file is checked out alongside the model.
- Build destination: `public/models/osmocean/fish_rigged.glb` in the generated Ultra-Water application.
- Runtime: Three.js `GLTFLoader` loads the model once; `SkeletonUtils.clone` creates per-fish skeleton-safe instances. The upstream MIT licence is copied beside the deployed model as `POLYFISH-LICENSE.txt`. Bounds are normalized and the longest model axis is aligned with the ecology's local forward axis.
- Animation: all clips embedded in the GLB are played per fish when present. The PolyFish procedural vertex-swim shader is also adapted with per-fish uniforms, so the body flexes even when the GLB has no baked swim clip. Its source and MIT notice are retained in this repository. If loading fails, the existing procedural fish mesh remains as a visible fallback.

The binary is deliberately fetched during the Pages build rather than duplicated in this repository. The pin makes the input reproducible and the upstream licence remains available at the source checkout.

## Expanded pelagic and megafauna library

The Pages and CI builds fetch the [Ocean Animals: Whales, Sharks and Fish collection](https://3dassets.dev/packs/open-ocean-and-deep-sea-life) from its published JSON manifest. The downloader verifies the pack and every selected model as CC0 1.0, downloads the individual GLBs, and writes a local catalogue with species name, model dimensions, scale, broad ecological role and a conservative depth band.

- 44 published marine animal models are supplied by the collection (the starter-scene file is not used as a species).
- Assets are copied into the generated site's `public/models/osmocean/pelagic/` directory; runtime loading is local to GitHub Pages, not dependent on a third-party CDN.
- The collection's models are static posed meshes. They are not falsely described as rigged or clip-animated. The existing procedural fish-swim material supplies gentle body motion where compatible; the existing Quaternius animated models remain available for species with baked swim cycles.
- Model scale is derived from the collection's metre dimensions. Large whales and other megafauna retain their relative size instead of being normalized to the size of a reef fish.
- Reef, pelagic, megafauna and deep-water species receive different initial depth ranges. The ecology still owns their movement, buoyancy, water-relative drag, energy and behaviour.
- The pack is CC0 1.0 Universal with no attribution requirement. Its source and licence are recorded in the generated `pelagic/catalog.json`. The publisher's manifest identifies the collection as AI-generated; the models are static posed studies, not artist-authored rigged animation assets.

The population now starts across the full configured ocean radius using area-uniform radial sampling. A minority nursery fraction remains near the initial reef so the starting camera view is populated; the majority is distributed throughout the wider water column. Offspring inherit their parents' local region and species, allowing populations to spread through movement and reproduction rather than teleporting each frame.

## Species model tiers and water mechanics

The generated reef scene now uses two visual tiers rather than pretending one small fish mesh can represent the entire marine food web:

- **Shoaling tier:** the lightweight PolyFish rig remains the inexpensive visual for common small shoaling fish.
- **Reef and large-fauna tier:** twelve animated Quaternius models are loaded for larger or more distinctive species: anglerfish, black lionfish, coral grouper, goblin shark, humphead wrasse, lionfish, parrotfish, pufferfish, reef shark, sunfish, swordfish and tuna. Species metadata controls relative frequency, size class and predator role. The model catalog also retains small-species identities while routing those individuals to the inexpensive shoal visual.

The selected GLBs are checked out from [Vitexus/ishtaria-client](https://github.com/Vitexus/ishtaria-client) at pinned commit `f42095c120c29a892c0c221bdc8357ac982ccfca`. That repository records the source as Quaternius' [Animated Fish Bundle](https://poly.pizza/bundle/Animated-Fish-Bundle-44zhHN1UbT), under CC0 1.0. The original model-specific licence is copied into the generated site beside the species assets. The build checks out only the selected model folder and licence.

### Water-relative movement

The surface solver exposes a free-surface height, not a full volumetric underwater velocity field. Fish therefore use that sampled surface height as their reference and combine it with a depth-sheared subsurface current field. Their motion applies:

- quadratic drag against water-relative velocity, not air-like velocity damping;
- density-based buoyancy;
- a damped preferred-depth controller;
- hard shallow/deep limits so inertia cannot carry fish above the surface or outside the configured water column.

This is a lightweight underwater hydrodynamic model coupled to the live surface height. It is not represented as a full Navier–Stokes solution or as direct sampling of underwater velocities from the surface solver.

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
