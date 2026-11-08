import { isFinite3 } from "../core/vector3.js";
import { transformPoint } from "../core/rigid-transform.js";

const zero3 = () => ({ x: 0, y: 0, z: 0 });
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const freeze3 = v => Object.freeze({ x: v.x, y: v.y, z: v.z });

/**
 * Approximate Archimedean buoyancy using body-local volume quadrature points.
 * The water surface is a plane whose normal points out of the water; points
 * on or below its plane are treated as fully submerged.
 *
 * This is a point-quadrature approximation. It does not clip cells against
 * the free surface, infer volume from a mesh, or model dynamic pressure.
 */
export function calculateBuoyancyWrench({
  centerOfMass,
  transform,
  volumeSamples,
  waterSurface,
  waterField,
  gravity,
  time = 0
}) {
  if (!isFinite3(centerOfMass) || !isFinite3(gravity)) {
    throw new TypeError("centerOfMass and gravity must be finite vectors");
  }
  if (!transform || !isFinite3(transform.position) || !transform.rotation) {
    throw new TypeError("transform must contain a finite position and rotation");
  }
  if (!waterSurface || !isFinite3(waterSurface.point) || !isFinite3(waterSurface.normal)) {
    throw new TypeError("waterSurface must contain a finite point and outward normal");
  }
  const normalLength = Math.hypot(waterSurface.normal.x, waterSurface.normal.y, waterSurface.normal.z);
  if (!(normalLength > 0) || !Number.isFinite(normalLength)) {
    throw new RangeError("waterSurface.normal must have finite non-zero length");
  }
  if (!Number.isFinite(time)) throw new TypeError("time must be finite");
  if (!Array.isArray(volumeSamples) || volumeSamples.length === 0) {
    throw new RangeError("volumeSamples must be a non-empty array");
  }
  if (!waterField || typeof waterField.sample !== "function") {
    throw new TypeError("waterField must provide sample(position, time)");
  }
  for (let i = 0; i < volumeSamples.length; i++) {
    const sample = volumeSamples[i];
    if (!sample || !isFinite3(sample.position)) {
      throw new TypeError("volumeSamples[" + i + "].position must be finite and body-local");
    }
    if (!Number.isFinite(sample.volume) || sample.volume <= 0) {
      throw new RangeError("volumeSamples[" + i + "].volume must be finite and positive");
    }
  }

  const normal = scale3(waterSurface.normal, 1 / normalLength);
  let totalVolume = 0;
  let submergedVolume = 0;
  let totalForce = zero3();
  let totalTorque = zero3();
  const contributions = [];

  for (let i = 0; i < volumeSamples.length; i++) {
    const item = volumeSamples[i];
    totalVolume += item.volume;
    if (!Number.isFinite(totalVolume)) throw new RangeError("Total quadrature volume overflowed");
    const position = transformPoint(transform, item.position);
    const signedDistance = dot3(sub3(position, waterSurface.point), normal);
    if (signedDistance > 0) continue;

    const sample = waterField.sample(position, time);
    if (!sample || typeof sample.valid !== "boolean") {
      throw new TypeError("Water field returned an invalid sample contract at volume sample " + i);
    }
    if (!sample.valid) {
      return Object.freeze({
        valid: false, reason: "invalid-water-sample", sampleIndex: i,
        sample, wrench: null, submergedVolume: null, totalVolume,
        submergedFraction: null, contributions: Object.freeze([])
      });
    }
    if (!isFinite3(sample.velocity) || !Number.isFinite(sample.density) || sample.density <= 0) {
      throw new RangeError("Valid water sample must contain finite velocity and positive density");
    }

    const force = scale3(gravity, -sample.density * item.volume);
    const torque = cross3(sub3(position, centerOfMass), force);
    if (!isFinite3(force) || !isFinite3(torque)) {
      throw new RangeError("Buoyancy contribution overflowed finite force/torque range");
    }
    totalForce = add3(totalForce, force);
    totalTorque = add3(totalTorque, torque);
    submergedVolume += item.volume;
    if (!isFinite3(totalForce) || !isFinite3(totalTorque) ||
        !Number.isFinite(submergedVolume)) {
      throw new RangeError("Buoyancy accumulation overflowed finite range");
    }
    contributions.push(Object.freeze({
      position: freeze3(position),
      volume: item.volume,
      density: sample.density,
      force: freeze3(force),
      torque: freeze3(torque)
    }));
  }

  return Object.freeze({
    valid: true,
    reason: null,
    sampleIndex: null,
    submergedVolume,
    totalVolume,
    submergedFraction: submergedVolume / totalVolume,
    wrench: Object.freeze({
      origin: freeze3(centerOfMass),
      force: freeze3(totalForce),
      torque: freeze3(totalTorque),
      forceCount: contributions.length
    }),
    contributions: Object.freeze(contributions)
  });
}
