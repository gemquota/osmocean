# Rigid-body and fluid-load coupling

## Five integrated implementation areas

1. **Six-degree-of-freedom rigid body.** Immutable state, positive mass, a full symmetric positive-definite body-space inertia tensor, world angular momentum, and semi-implicit Euler translation/rotation.
2. **Surface quadrature transforms.** Body-local surface points are transformed to world coordinates while preserving patch area and drag coefficient.
3. **Buoyancy quadrature.** Body-local volume weights are transformed and classified against an explicit water-surface plane. Each submerged weight receives Archimedean buoyancy from the local sampled density.
4. **Unified fluid wrench.** Distributed drag and buoyancy are assembled atomically into a single force/torque wrench; a failed field sample prevents integration.
5. **Coupled step and regression evidence.** Body weight, buoyancy and drag feed the same rigid-body integrator. Tests cover limiting cases, moments, invalid coverage, and drag energy dissipation at a small stable step.

## Rigid-body state and integration

- Position: world metres.
- Linear velocity: world metres/second.
- Orientation: unit quaternion mapping body coordinates to world coordinates.
- Angular momentum: world kg·m²/s.
- Inertia tensor: body-frame kg·m², full symmetric positive-definite 3×3.
- Wrench: world force in newtons and torque about the centre of mass in newton-metres.
- Time step: seconds, finite and strictly positive.

The integrator uses semi-implicit Euler for translation. It advances world angular momentum from torque, derives angular velocity through the rotated inverse inertia tensor, then applies a world-space exponential-map quaternion increment. It does not model gyroscopic torque as an independent term: the world-angular-momentum formulation preserves torque-free angular momentum while the changing orientation changes angular velocity through the inertia tensor.

## Buoyancy and waterline approximation

The water surface is an explicit plane with an outward normal. Signed distance greater than zero is above water; points on or below the plane are submerged. Volume samples are weighted volume centroids, not mesh vertices. The submerged-volume fraction is the sum of submerged weights divided by total weights.

This is a discrete point-quadrature estimate. It does not geometrically clip partially submerged cells, derive volume from a mesh, or resolve a deforming free surface. Accuracy depends on the distribution and resolution of volume samples. The water field supplies local density; gravity is supplied in world coordinates.

## Failure semantics and limitations

- Geometry, inertia and kinematics are validated before integration.
- An invalid water sample invalidates the complete fluid wrench. The rigid body is not advanced using partial loads.
- No arbitrary force caps or hidden velocity clamps are applied.
- Time-step stability remains the caller's responsibility. Explicit drag can become unstable when a step is too large relative to the body's effective damping and mass.
- This is not CFD: pressure distributions, lift, added mass, radiation forces, viscous boundary layers, cavitation, turbulence closure and fluid-structure feedback remain out of scope.
- No mesh-to-quadrature generator is included; sample weights are authored/provided by the caller.
