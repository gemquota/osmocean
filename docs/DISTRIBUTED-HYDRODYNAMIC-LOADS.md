# Distributed hydrodynamic drag loads

## Contract

`calculateHydrodynamicWrench` evaluates a discrete set of world-space surface
quadrature samples against a water-field contract (`sample(position, time)`).
Each sample provides a world position, positive representative area, and
non-negative drag coefficient.

For a sample at position `x_i), relative to centre of mass `x_c`:

```text
r_i       = x_i - x_c
v_i       = v_linear + omega x r_i
v_rel,i   = v_i - v_water(x_i, t)
F_i       = -0.5 rho_i Cd_i A_i |v_rel,i| v_rel,i
tau_i     = r_i x F_i

F_total   = sum(F_i)
tau_total = sum(tau_i)
```

All positions are metres, velocities metres/second, angular velocity radians
per second, density kg/m^3, area m^2, force newtons, and torque newton-metres.
The input samples must already be transformed into world space. Geometry
transforms and surface quadrature generation are deliberately separate.

## Failure semantics

- Geometry and kinematic inputs are validated before any field sampling.
- A malformed field contract or invalid physical sample throws.
- If any sample is explicitly outside the field domain (`valid: false`),
  the entire result is returned invalid with `wrench: null`. Partial sums are
  never exposed as if they represented the complete surface.
- Non-finite force, moment, or accumulated results are rejected.
- Outputs and contribution snapshots are immutable copies.

## Interpretation and limitations

This is a discrete quadrature approximation of quadratic form/skin drag.
Accuracy depends on sample placement, area weights, and coefficient
calibration. It does not derive wetted area from a mesh and is not CFD.
It omits pressure and lift distributions, added mass, radiation forces,
boundary-layer effects, wave/free-surface interaction, cavitation, and
fluid-structure feedback. The model must not be described as a complete
hydrodynamic solution.

The module returns a wrench only. It does not mutate a body or perform time
integration; a later adapter can feed the result to the rigid-body force and
torque integrator after those contracts are reviewed together.
