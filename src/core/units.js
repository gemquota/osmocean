/**
 * Canonical Osmocean world and unit conventions.
 *
 * World frame: right-handed; +X right, +Y up, +Z toward the viewer.
 * Angles are radians. Physical quantities use SI units.
 * These conventions describe the simulation kernel, not a camera projection.
 */
export const WORLD_FRAME = Object.freeze({
  handedness: "right",
  right: Object.freeze({ x: 1, y: 0, z: 0 }),
  up: Object.freeze({ x: 0, y: 1, z: 0 }),
  towardViewer: Object.freeze({ x: 0, y: 0, z: 1 })
});

export const SI_UNITS = Object.freeze({
  distance: "m",
  mass: "kg",
  time: "s",
  angle: "rad",
  velocity: "m/s",
  acceleration: "m/s^2",
  force: "N",
  torque: "N*m",
  angularVelocity: "rad/s",
  density: "kg/m^3",
  pressure: "Pa",
  area: "m^2"
});

export function assertFiniteNumber(value, name = "value") {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

export function assertPositiveFinite(value, name = "value") {
  assertFiniteNumber(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than zero`);
  }
  return value;
}

export function assertNonNegativeFinite(value, name = "value") {
  assertFiniteNumber(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
  return value;
}
