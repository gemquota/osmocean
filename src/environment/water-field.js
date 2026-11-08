import { vec3, isFinite3 } from "../core/vector3.js";

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
  if (!Number.isFinite(density) || density <= 0) {
    throw new RangeError("Water density must be a finite positive value");
  }

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
