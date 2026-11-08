# Bounded rectilinear water-grid fields

## Data layout

`createGridWaterField` accepts an origin in metres, positive per-axis spacing
in metres, integer node dimensions (at least two per axis), a flat array of
world-space velocity vectors in metres/second, and a uniform density in
kilograms/cubic metre.

The flat array is X-fastest, then Y, then Z:

```js
index = (k * ny + j) * nx + i
```

## Interpolation and domain policy

Sampling uses trilinear interpolation in the enclosing cell. Nodes, including
maximum faces and corners, are reproduced exactly.

Outside the grid, `boundaryMode: "invalid"` (default) returns
`valid: false` and `velocity: null`. `boundaryMode: "clamp"` clamps to the
nearest boundary and implements constant extension, not extrapolation.

The field is static in time. Sample time is validated and returned for interface
compatibility, but it does not alter velocity.

## Limitations

Density is uniform. There is no temporal interpolation, pressure, viscosity,
turbulence, free-surface boundary, or conservation enforcement. Trilinear
interpolation is a sampling rule, not a fluid solver. Mechanics must reject
invalid samples and calculate drag from body velocity relative to sampled
water velocity.
