import { vec3, isFinite3 } from "../core/vector3.js";

function positiveDensity(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("Water density must be a finite positive value");
  }
  return value;
}

/**
 * Uniform, time-independent water field for contract tests and early prototypes.
 * velocity is world-space metres/second; density is kg/m^3.
 * This is a reference implementation, not a production ocean model.
 */
export function createUniformWaterField({
  velocity = vec3(),
  density = 1025
} = {}) {
  if (!isFinite3(velocity)) throw new TypeError("Water velocity must be finite");
  positiveDensity(density);
  const frozenVelocity = Object.freeze({ ...velocity });

  return Object.freeze({
    sample(position, time = 0) {
      if (!isFinite3(position)) throw new TypeError("Sample position must be finite");
      if (!Number.isFinite(time)) throw new TypeError("Sample time must be finite");
      return Object.freeze({
        position: Object.freeze({ ...position }),
        time,
        velocity: frozenVelocity,
        density,
        valid: true
      });
    }
  });
}

/**
 * Steady affine flow: u(p) = u0 + G (p - p0).
 *
 * G is a row-major 3x3 velocity-gradient tensor in s^-1. This represents
 * locally linear currents (including uniform flow, shear and solid-body
 * rotation); it is not a Navier-Stokes solver and does not enforce boundaries,
 * incompressibility, or global ocean geometry.
 */
export function createAffineWaterField({
  origin = vec3(),
  baseVelocity = vec3(),
  velocityGradient = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ],
  density = 1025
} = {}) {
  if (!isFinite3(origin)) throw new TypeError("Field origin must be finite");
  if (!isFinite3(baseVelocity)) throw new TypeError("Base velocity must be finite");
  positiveDensity(density);
  if (!Array.isArray(velocityGradient) || velocityGradient.length !== 3 ||
      velocityGradient.some(row => !Array.isArray(row) || row.length !== 3 ||
        row.some(value => !Number.isFinite(value)))) {
    throw new TypeError("Velocity gradient must be a finite 3x3 matrix");
  }

  const o = Object.freeze({ ...origin });
  const u0 = Object.freeze({ ...baseVelocity });
  const g = velocityGradient.map(row => Object.freeze([...row]));
  Object.freeze(g);

  return Object.freeze({
    sample(position, time = 0) {
      if (!isFinite3(position)) throw new TypeError("Sample position must be finite");
      if (!Number.isFinite(time)) throw new TypeError("Sample time must be finite");
      const x = position.x - o.x;
      const y = position.y - o.y;
      const z = position.z - o.z;
      const velocity = Object.freeze({
        x: u0.x + g[0][0] * x + g[0][1] * y + g[0][2] * z,
        y: u0.y + g[1][0] * x + g[1][1] * y + g[1][2] * z,
        z: u0.z + g[2][0] * x + g[2][1] * y + g[2][2] * z
      });
      if (!isFinite3(velocity)) {
        return Object.freeze({
          position: Object.freeze({ ...position }),
          time,
          velocity: null,
          density,
          valid: false
        });
      }
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

/** Convenience constructor for a constant horizontal shear: u_x = rate * y. */
export function createShearWaterField({
  shearRate,
  density = 1025,
  baseVelocity = vec3(),
  origin = vec3()
} = {}) {
  if (!Number.isFinite(shearRate)) throw new TypeError("Shear rate must be finite");
  return createAffineWaterField({
    origin,
    baseVelocity,
    density,
    velocityGradient: [
      [0, shearRate, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  });
}

/** Convenience constructor for planar solid-body rotation around world Z. */
export function createVortexWaterField({
  angularRate,
  density = 1025,
  origin = vec3()
} = {}) {
  if (!Number.isFinite(angularRate)) throw new TypeError("Angular rate must be finite");
  return createAffineWaterField({
    origin,
    density,
    velocityGradient: [
      [0, -angularRate, 0],
      [angularRate, 0, 0],
      [0, 0, 0]
    ]
  });
}


/**
 * Trilinearly interpolated, bounded, rectilinear water-velocity grid.
 *
 * Grid samples are stored with X varying fastest, then Y, then Z:
 * index = (k * ny + j) * nx + i.
 * The grid is static in time; time is validated for interface compatibility.
 * Outside-domain samples are invalid by default. "clamp" is available for
 * callers that explicitly want constant extension to the nearest boundary.
 */
export function createGridWaterField({
  origin = vec3(),
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
  positiveDensity(density);
  if (boundaryMode !== "invalid" && boundaryMode !== "clamp") {
    throw new TypeError('boundaryMode must be "invalid" or "clamp"');
  }
  const { x: nx, y: ny, z: nz } = dimensions;
  const expected = nx * ny * nz;
  if (!Number.isSafeInteger(expected) || !Array.isArray(velocities) ||
      velocities.length !== expected || velocities.some(v => !isFinite3(v))) {
    throw new TypeError(`velocities must contain exactly ${expected} finite vectors`);
  }

  const o = Object.freeze({ ...origin });
  const s = Object.freeze({ ...spacing });
  const d = Object.freeze({ ...dimensions });
  const values = velocities.map(v => Object.freeze({ ...v }));
  Object.freeze(values);

  const invalidSample = (position, time) => Object.freeze({
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

      let gx = (position.x - o.x) / s.x;
      let gy = (position.y - o.y) / s.y;
      let gz = (position.z - o.z) / s.z;
      const outside = gx < 0 || gy < 0 || gz < 0 ||
        gx > d.x - 1 || gy > d.y - 1 || gz > d.z - 1;
      if (outside && boundaryMode === "invalid") return invalidSample(position, time);

      gx = Math.min(d.x - 1, Math.max(0, gx));
      gy = Math.min(d.y - 1, Math.max(0, gy));
      gz = Math.min(d.z - 1, Math.max(0, gz));

      const i0 = Math.min(Math.floor(gx), d.x - 2);
      const j0 = Math.min(Math.floor(gy), d.y - 2);
      const k0 = Math.min(Math.floor(gz), d.z - 2);
      const tx = gx - i0;
      const ty = gy - j0;
      const tz = gz - k0;
      const at = (i, j, k) => values[(k * d.y + j) * d.x + i];
      const lerp = (a, b, t) => a + (b - a) * t;
      const component = key => {
        const c00 = lerp(at(i0, j0, k0)[key], at(i0 + 1, j0, k0)[key], tx);
        const c10 = lerp(at(i0, j0 + 1, k0)[key], at(i0 + 1, j0 + 1, k0)[key], tx);
        const c01 = lerp(at(i0, j0, k0 + 1)[key], at(i0 + 1, j0, k0 + 1)[key], tx);
        const c11 = lerp(at(i0, j0 + 1, k0 + 1)[key], at(i0 + 1, j0 + 1, k0 + 1)[key], tx);
        return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
      };
      const velocity = Object.freeze({
        x: component("x"),
        y: component("y"),
        z: component("z")
      });
      if (!isFinite3(velocity)) return invalidSample(position, time);
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
