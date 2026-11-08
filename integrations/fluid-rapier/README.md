# Fluid + Rapier 2D prototype

This integration builds a dedicated Osmocean page into the pinned jeantimex/fluid Vite application. It reuses the upstream Canvas2D SPH simulation core and adds Rapier 2D as the rigid-body owner for a dynamic rectangular obstacle.

## Ownership

- Upstream SPH owns fluid particle positions/velocities, density, pressure, viscosity and its AABB obstacle collision response.
- Rapier 2D owns the obstacle body's pose, velocity, collider contacts and fixed-step integration.
- Osmocean updates the SPH obstacle centre from the Rapier body before each SPH step.
- Osmocean estimates pressure and viscous loading from fluid particles in the obstacle's smoothing-radius boundary band, adds an Archimedes-style buoyancy estimate from the local particle envelope, and applies the bounded resultant force to Rapier.

## Important limitations

This is an executable coupling prototype, not a conservation-complete fluid/solid solver.

- The upstream SPH obstacle is axis-aligned and supports one rectangular obstacle. The Rapier body is therefore rotation-locked; it cannot rotate independently of the SPH boundary.
- The upstream collision response reflects/clamps particles against the AABB. It does not return collision impulses. Osmocean adds a separate pressure/relative-velocity load estimate to Rapier.
- Upstream SPH pressure parameters are visually tuned rather than SI-calibrated. The adapter therefore uses explicit force scaling and a maximum-force bound. The Archimedes estimate treats the 2D cross-section as unit depth and uses an effective fluid density; neither is a measured SI water column. The displayed force is marked as scaled.
- Reaction impulses are not distributed back into SPH particle velocities. Momentum is not conserved across the fluid/body interface.
- This demo is 2D. It is a useful integration and adapter experiment, not a substitute for 3D free-surface fluid-body coupling.

## Build and test

The GitHub Pages and CI workflows:
1. Check out jeantimex/fluid at pinned commit `9daf3ae2add7dedc3eadcc10da5e4a44ef1b771f`.
2. Inject the integration page, adapter and Rapier 2D dependency through a guarded build script.
3. Build the upstream multi-page Vite app at `/fluid/`.
4. Run Osmocean's adapter tests and compile the integrated upstream app in CI.

The deployed prototype is at `/fluid/rapier-fluid-2d.html`. Runtime and numerical calibration on desktop/mobile browsers remain required.

## Fluid + Ultra-Water and three-engine scene

The multi-engine page is built alongside the standalone SPH/Rapier page.

- The parent page embeds the same-origin Osmocean Ultra-Water deployment.
- The parent registers 25 XZ sample probes on the child window.
- The Ultra-Water Rapier runtime appends those probes to its existing GPU WaterQuery batch, preserving the single readback pass.
- The child publishes the matching result slice, including query time and probe positions.
- The local SPH adapter maps the sampled wave-height profile and displacement-derived velocity onto the upper free-surface particle band.
- The URL parameter `rapier=0` disables the local rigid body for the Fluid + Ultra-Water pairing. `rapier=1` enables the Rapier 2D body for the three-engine scene.

This remains a one-way interface. The ocean does not receive reaction impulses from SPH, the local domain does not transfer conserved mass across the boundary, and the 2D slice is not a 3D near-shore FLIP solver. The three-engine scene is an executable shared-data prototype, not a claim of fully coupled ocean physics.
