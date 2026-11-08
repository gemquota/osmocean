# Ultra-Water + Rapier adapter

## Ownership

Rapier is the only rigid-body state owner. The adapter never advances a body,
changes its pose directly, steps a world, or duplicates contact/constraint
solving. The host applies the adapter's forces before calling `world.step()`.

Ultra-Water remains the owner of its rendered FFT surface and its GPU query.
The adapter consumes the existing `WaterQuery` result contract:
`result`, `resultCount`, `resultTag`, and `resultTime`. Query order is fixed
for an adapter instance: all body-local volume samples, followed by all
body-local surface samples.

## Host frame sequence

1. Read each Rapier body's pose and call `submitQuery(simulationTime)`.
2. Let Ultra-Water render/submit its `WaterQuery` pass.
3. When its asynchronous readback completes, call `ingestQuery()`.
4. Before the next Rapier `world.step()`, call `applyForces(simulationTime)`.
5. Step Rapier once. Do not also call Ultra-Water's `Floaters.step()` for the
   same bodies.

The host must use a stable `layoutTag` while sample count and ordering remain
unchanged. Recreate the adapter or change its tag when the sample layout changes.
The current upstream WaterQuery API has no per-submission completion callback;
the adapter matches completed results to the timestamps supplied to submit.

## Force model

- Buoyancy is point-volume quadrature: each submerged sample contributes
  `rho * g * volume * submergedFraction` upward, applied at that sample.
- Drag is quadratic and applied at each surface sample:
  `F = -0.5 * rho * Cd * A * |v_body_point - v_water| * (v_body_point - v_water)`.
- Point velocity includes rigid-body angular velocity, so off-centre drag and
  buoyancy naturally create torque through Rapier's `addForceAtPoint`.
- Gravity is not added by the adapter; Rapier world gravity remains authoritative.

## Readback and numerical limits

WaterQuery is asynchronous and normally lags by one to three frames. The adapter
rejects unknown timestamps, mismatched layout tags, out-of-order results and
readbacks older than `maxReadbackAge`. It does not silently invent a current
surface when the query is missing or stale.

WaterQuery returns height and horizontal displacement, not fluid velocity.
The adapter estimates water velocity by finite-differencing successive
displacements at matching sample indices. Because body-attached query points
move between submissions, this estimate also contains a spatial-sampling
component. It is an engineering approximation inherited from the upstream
floater approach, not a true Eulerian velocity measurement. A future upstream
query extension should expose velocity directly or support fixed world-space
probe positions with stable identities.

The surface is still an FFT-rendered heightfield. This adapter does not feed
body reaction impulses back into the FFT ocean, generate wakes, displace the
rendered water, or couple to the local FLIP solver. It is one-way hydrodynamic
loading from the rendered water into Rapier bodies.

## API boundary

The module is dependency-free and uses the small Rapier JavaScript
`RigidBody` surface it needs. This avoids pinning a Rapier package version in
the numerical core; the consuming browser/runtime app owns and initializes
its chosen Rapier build.
