# Bounded rectilinear water-grid fields

## Data layout

`createGridWaterField` accepts:

- `origin`: world-space position of grid node (0, 0, 0), metres.
- `spacing`: positive node spacing on each axis, metres.
- `dimensions`: integer node counts `{ x, y, z }`, each at least two.
- `velocities`: one world-space velocity vector per node, metres/second.
- `density`: uniform positive density, kilograms/cubic metre.
- `boundaryMode`: `"invalid"` (default) or `"clamp"`.

The flat velocity array is X-fastest, then Y, then Z:

```js
index = (k * ny + j) * nx + i
```

## Interpolation

Samples use trilinear interpolation over the enclosing cell. Grid nodes,
including maximum faces and corners, are reproduced exactly. The field is
spatially varying but static in time; `time` is validated and carried through
the sample to preserve the common field interface.

## Domain policy

The default `invalid` policy returns `valid: false` and `velocity: null`
outside the grid. This prevents silently inventing environmental data beyond
the represented domain. The optional `clamp` policy clamps coordinates to the
nearest boundary and therefore implements constant extension, not extrapolation.

## Limitations and next work

Density is currently uniform. Velocity is sampled from a static grid; there is
no temporal interpolation, pressure, viscosity, turbulence, free-surface
boundary, or conservation enforcement. Trilinear interpolation is a sampling
rule, not a fluid solver. The next mechanics integration should explicitly
reject invalid samples and compute drag from body velocity relative to the
sampled water velocity.
