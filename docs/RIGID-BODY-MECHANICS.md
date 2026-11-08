# Rigid-Body Mechanics Baseline

## Wrench accumulation

A wrench is the pair of resultant force and torque about a declared origin. A force applied away from that origin contributes:

`tau = (point - origin) x force`

Direct torques and point-applied force moments are accumulated in world coordinates. The accumulator is reset explicitly by the tick owner. It does not integrate state or decide which models are allowed to contribute.

## State and integration

Rigid-body state stores world position, world linear velocity, world orientation, and world angular momentum. Mass is scalar. Inertia is currently diagonal in body-local coordinates and must be strictly positive on all three axes.

The baseline integrator uses semi-implicit Euler for translation and angular momentum. Orientation advances from world angular velocity derived by rotating angular momentum into body coordinates, applying inverse diagonal inertia, then rotating the result back to world coordinates. Quaternion derivative uses:

`q_dot = 0.5 * (omega_world, 0) * q`

The orientation is normalized after each step.

## Explicit limitations

- No off-diagonal inertia tensor or changing inertia from articulation.
- No gyroscopic approximation is added as a separate torque; angular momentum is integrated directly in world space.
- No contacts, constraints, buoyancy, added mass, fluid coupling, or adaptive/substepping solver.
- Semi-implicit Euler is a baseline; stability and convergence must be characterized for the intended mass, inertia, force, and timestep ranges.
- Wrench ownership and reset timing belong to the simulation orchestrator.
