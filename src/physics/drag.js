import { sub3, scale3, length3, isFinite3 } from "../core/vector3.js";

/**
 * Calculate quadratic drag on a body moving through local water.
 *
 * vRelative = vBody - vWater
 * F = -0.5 * rho * Cd * A * |vRelative| * vRelative
 *
 * velocity values are metres/second, density kg/m^3, area m^2,
 * coefficient dimensionless, and output force newtons.
 *
 * This lumped model assumes a supplied effective projected area and Cd.
 * It is not a distributed flexible-body or validated animal hydrodynamics model.
 */
export function quadraticDrag({
  bodyVelocity,
  waterVelocity,
  density,
  dragCoefficient,
  referenceArea
}) {
  if (!isFinite3(bodyVelocity) || !isFinite3(waterVelocity)) {
    throw new TypeError("Body and water velocities must be finite vectors");
  }
  if (!Number.isFinite(density) || density <= 0) {
    throw new RangeError("Density must be finite and positive");
  }
  if (!Number.isFinite(dragCoefficient) || dragCoefficient < 0) {
    throw new RangeError("Drag coefficient must be finite and non-negative");
  }
  if (!Number.isFinite(referenceArea) || referenceArea < 0) {
    throw new RangeError("Reference area must be finite and non-negative");
  }

  const relativeVelocity = sub3(bodyVelocity, waterVelocity);
  const speed = length3(relativeVelocity);
  const factor = -0.5 * density * dragCoefficient * referenceArea * speed;
  const force = speed === 0
    ? { x: 0, y: 0, z: 0 }
    : scale3(relativeVelocity, factor);

  return Object.freeze({ relativeVelocity, speed, force });
}


/**
 * Sample a water field at a body's world position and calculate water-relative
 * quadratic drag. Invalid field samples are propagated without inventing a
 * fallback velocity or applying a force.
 *
 * The field owns spatial/time sampling; this function owns only the lumped
 * drag calculation. It deliberately does not mutate or integrate a body.
 */
export function quadraticDragFromWaterField({
  bodyVelocity,
  position,
  time = 0,
  waterField,
  dragCoefficient,
  referenceArea
}) {
  if (!waterField || typeof waterField.sample !== "function") {
    throw new TypeError("waterField must provide a sample(position, time) function");
  }
  const sample = waterField.sample(position, time);
  if (!sample || typeof sample.valid !== "boolean") {
    throw new TypeError("Water field returned an invalid sample contract");
  }
  if (!sample.valid) {
    return Object.freeze({ valid: false, sample, drag: null });
  }
  if (!isFinite3(sample.velocity)) {
    throw new TypeError("Valid water samples must contain a finite velocity");
  }

  const drag = quadraticDrag({
    bodyVelocity,
    waterVelocity: sample.velocity,
    density: sample.density,
    dragCoefficient,
    referenceArea
  });
  return Object.freeze({ valid: true, sample, drag });
}
