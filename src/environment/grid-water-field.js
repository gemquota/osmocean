import { isFinite3 } from "../core/vector3.js";

function validateDensity(density) {
  if (!Number.isFinite(density) || density <= 0) {
    throw new RangeError("Water density must be finite and positive");
  }
}

/**
 * Bounded rectilinear 3D velocity grid with trilinear interpolation.
 *
 * Positions use metres, velocities metres/second, density kg/m^3. Samples are
 * static in time. Flat node storage is X-fastest, then Y, then Z:
 * (k * ny + j) * nx + i.
 *
 * Outside the represented domain, "invalid" returns a rejected sample.
 * "clamp" performs constant extension to the nearest boundary, not extrapolation.
 */
export function createGridWaterField({
  origin = { x: 0, y: 0, z: 0 },
  spacing,
  dimensions,
  velocities,
  density = 1025,
  boundaryMode = "invalid"
} = {}) {
  if (!isFinite3(origin)) throw new TypeError("Grid origin must be finite");
  if (!isFinite3(spacing) || spacing.x <= 0 || spacing.y <= 0 || spacing.z <= 0) {
    throw new RangeError("Grid spacing must be finite and positive on every axis");
  }
  if (!dimensions || !Number.isInteger(dimensions.x) || !Number.isInteger(dimensions.y) ||
      !Number.isInteger(dimensions.z) || dimensions.x < 2 || dimensions.y < 2 ||
      dimensions.z < 2) {
    throw new RangeError("Grid dimensions must be integers of at least two");
  }
  validateDensity(density);
  if (boundaryMode !== "invalid" && boundaryMode !== "clamp") {
    throw new TypeError('boundaryMode must be "invalid" or "clamp"');
  }

  const { x: nx, y: ny, z: nz } = dimensions;
  const count = nx * ny * nz;
  if (!Number.isSafeInteger(count) || !Array.isArray(velocities) ||
      velocities.length !== count || velocities.some(v => !v || !isFinite3(v))) {
    throw new TypeError(`velocities must contain exactly ${count} finite vectors`);
  }

  const o = Object.freeze({ ...origin });
  const s = Object.freeze({ ...spacing });
  const d = Object.freeze({ ...dimensions });
  const nodes = Object.freeze(velocities.map(v => Object.freeze({ ...v })));

  const invalid = (position, time) => Object.freeze({
    position: Object.freeze({ ...position }),
    time,
    velocity: null,
    density,
    valid: false
  });

  return Object.freeze({
    sample(position, time = 0) {
      if (!isFinite3(position)) throw new TypeError("Sample position must be finite");
      if (!Number.isFinite(time)) throw new TypeError("Sample time must be finite");

      let x = (position.x - o.x) / s.x;
      let y = (position.y - o.y) / s.y;
      let z = (position.z - o.z) / s.z;
      const outside = x < 0 || y < 0 || z < 0 ||
        x > d.x - 1 || y > d.y - 1 || z > d.z - 1;
      if (outside && boundaryMode === "invalid") return invalid(position, time);

      x = Math.min(d.x - 1, Math.max(0, x));
      y = Math.min(d.y - 1, Math.max(0, y));
      z = Math.min(d.z - 1, Math.max(0, z));

      const i = Math.min(Math.floor(x), d.x - 2);
      const j = Math.min(Math.floor(y), d.y - 2);
      const k = Math.min(Math.floor(z), d.z - 2);
      const tx = x - i, ty = y - j, tz = z - k;
      const at = (a, b, c) => nodes[(c * d.y + b) * d.x + a];
      const lerp = (a, b, t) => a + (b - a) * t;

      const interpolate = key => {
        const c00 = lerp(at(i, j, k)[key], at(i + 1, j, k)[key], tx);
        const c10 = lerp(at(i, j + 1, k)[key], at(i + 1, j + 1, k)[key], tx);
        const c01 = lerp(at(i, j, k + 1)[key], at(i + 1, j, k + 1)[key], tx);
        const c11 = lerp(at(i, j + 1, k + 1)[key], at(i + 1, j + 1, k + 1)[key], tx);
        return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
      };

      const velocity = Object.freeze({
        x: interpolate("x"),
        y: interpolate("y"),
        z: interpolate("z")
      });
      if (!isFinite3(velocity)) return invalid(position, time);

      return Object.freeze({
        position: Object.freeze({ ...position }),
        time,
        velocity,
        density,
        valid: true
      });
    }
  });
}
