# Water-field to drag coupling

`quadraticDragFromWaterField` composes the environment sampling contract with
the existing lumped quadratic-drag model.

At the supplied world-space body position and simulation time, it calls
`waterField.sample(position, time)`. For a valid sample, drag is calculated
from the relative velocity:

```
v_relative = v_body - v_water(position, time)
F_drag = -0.5 * rho * Cd * A * |v_relative| * v_relative
```

The sampled water density is used directly. If the field reports an invalid
sample (for example, a body position outside a bounded grid), the adapter
returns `{ valid: false, sample, drag: null }`. It does not substitute zero
water velocity, clamp implicitly, or apply a fabricated force.

## Separation of responsibilities

- Water fields own spatial and temporal sampling.
- The drag model owns the lumped relative-flow force calculation.
- The caller owns body integration, force accumulation, torque, and policy for
  invalid environmental samples.

This adapter does not mutate or integrate a rigid body. It does not yet model
distributed surface drag, angular point velocity, pressure drag variation over
a body, added mass, lift, or fluid-body feedback. Those require a later
hydrodynamic load-distribution model rather than quietly expanding this helper.
