import { quadraticDrag } from "./drag.js";

const zero3 = () => ({ x: 0, y: 0, z: 0 });
const finite3 = value =>
  value !== null &&
  typeof value === "object" &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y) &&
  Number.isFinite(value.z);
const copy3 = value => Object.freeze({ x: value.x, y: value.y, z: value.z });
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const frozenResult = (valid, values) => Object.freeze({ valid, ...values });

/**
 * Integrate discrete surface drag samples into a world-space wrench.
 *
 * Each sample is already transformed into world space and supplies a local
 * quadrature area and drag coefficient. Angular point velocity is
 * v + omega x (point - centreOfMass). Every valid field sample contributes
 * force and moment about centreOfMass.
 *
 * This is a discrete drag quadrature, not a complete hydrodynamics solver:
 * it omits pressure/lift, added mass, wave radiation, boundary layers,
 * free-surface effects, and geometry-derived wetted-area estimation.
 */
export function calculateHydrodynamicWrench({
  centerOfMass,
  linearVelocity,
  angularVelocity = zero3(),
  surfaceSamples,
  waterField,
  time = 0
}) {
  if (!finite3(centerOfMass)) throw new TypeError("centerOfMass must be a finite vector");
  if (!finite3(linearVelocity)) throw new TypeError("linearVelocity must be a finite vector");
  if (!finite3(angularVelocity)) throw new TypeError("angularVelocity must be a finite vector");
  if (!Number.isFinite(time)) throw new TypeError("time must be finite");
  if (!Array.isArray(surfaceSamples) || surfaceSamples.length === 0) {
    throw new RangeError("surfaceSamples must be a non-empty array");
  }
  if (!waterField || typeof waterField.sample !== "function") {
    throw new TypeError("waterField must provide sample(position, time)");
  }

  // Validate all geometry before sampling or accumulating anything.
  for (let i = 0; i < surfaceSamples.length; i++) {
    const point = surfaceSamples[i];
    if (!point || !finite3(point.position)) {
      throw new TypeError(`surfaceSamples[${i}].position must be a finite world-space vector`);
    }
    if (!Number.isFinite(point.area) || point.area <= 0) {
      throw new RangeError(`surfaceSamples[${i}].area must be finite and positive`);
    }
    if (!Number.isFinite(point.dragCoefficient) || point.dragCoefficient < 0) {
      throw new RangeError(`surfaceSamples[${i}].dragCoefficient must be finite and non-negative`);
    }
  }

  let totalForce = zero3();
  let totalTorque = zero3();
  const contributions = [];

  for (let i = 0; i < surfaceSamples.length; i++) {
    const point = surfaceSamples[i];
    const arm = sub3(point.position, centerOfMass);
    const rotationalVelocity = cross3(angularVelocity, arm);
    const pointVelocity = add3(linearVelocity, rotationalVelocity);
    const sample = waterField.sample(point.position, time);

    if (!sample || typeof sample.valid !== "boolean") {
      throw new TypeError(`Water field returned an invalid sample contract at surface sample ${i}`);
    }
    if (!sample.valid) {
      return frozenResult(false, {
        reason: "invalid-water-sample",
        sampleIndex: i,
        sample,
        wrench: null,
        contributions: Object.freeze([])
      });
    }
    if (!finite3(sample.velocity)) {
      throw new TypeError(`Valid water sample ${i} must contain a finite velocity`);
    }

    const drag = quadraticDrag({
      bodyVelocity: pointVelocity,
      waterVelocity: sample.velocity,
      density: sample.density,
      dragCoefficient: point.dragCoefficient,
      referenceArea: point.area
    });
    const torque = cross3(arm, drag.force);

    if (!finite3(drag.force) || !finite3(torque)) {
      throw new RangeError(`Hydrodynamic contribution ${i} overflowed finite force/torque range`);
    }

    totalForce = add3(totalForce, drag.force);
    totalTorque = add3(totalTorque, torque);
    if (!finite3(totalForce) || !finite3(totalTorque)) {
      throw new RangeError("Accumulated hydrodynamic wrench overflowed finite range");
    }

    contributions.push(Object.freeze({
      position: copy3(point.position),
      arm: copy3(arm),
      pointVelocity: copy3(pointVelocity),
      waterVelocity: copy3(sample.velocity),
      relativeVelocity: copy3(drag.relativeVelocity),
      area: point.area,
      dragCoefficient: point.dragCoefficient,
      density: sample.density,
      force: copy3(drag.force),
      torque: copy3(torque)
    }));
  }

  return frozenResult(true, {
    sampleIndex: null,
    wrench: Object.freeze({
      origin: copy3(centerOfMass),
      force: copy3(totalForce),
      torque: copy3(totalTorque),
      forceCount: contributions.length
    }),
    contributions: Object.freeze(contributions)
  });
}
