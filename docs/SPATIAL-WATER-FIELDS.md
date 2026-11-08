# Spatial water-field prototypes

## Contract

All positions are world-space metres, sample times are seconds, velocity is
metres/second, density is kilograms/cubic metre, and the velocity-gradient
tensor is inverse seconds.

Every field exposes:

```js
const sample = field.sample(worldPosition, timeSeconds);
```

A valid sample contains a copied position, time, frozen velocity, density and
`valid: true`. Invalid position/time inputs throw. A finite configuration can
still overflow at extreme sample coordinates; that returns `valid: false` and
`velocity: null`, allowing callers to reject the sample without accidentally
feeding infinities into mechanics.

## Implementations

- `createUniformWaterField`: constant velocity and density.
- `createAffineWaterField`: `u(p) = u0 + G (p - p0)`, with a row-major 3x3
  velocity-gradient tensor.
- `createShearWaterField`: convenience field with `u_x = rate * y`.
- `createVortexWaterField`: planar solid-body rotation around world Z.

The affine form supports uniform translation, linear shear, planar rotation,
and combinations of those local flow components. It is a local analytic
prototype, not a Navier-Stokes solver. It does not enforce incompressibility,
viscosity, pressure, boundaries, free-surface conditions, or global ocean
geometry. In particular, an arbitrary gradient tensor may have non-zero
divergence. Do not interpret these fields as validated ocean circulation.

## Intended next step

Use these fields to test water-relative body mechanics at multiple positions.
Then replace or complement the affine prototype with a bounded spatial grid or
analytic field adapter, with explicit interpolation, out-of-domain and
time-dependence semantics. Keep environmental state owned by the environment;
creature mechanics consume samples and must not mutate the field.
