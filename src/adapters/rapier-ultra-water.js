import { isFinite3 } from "../core/vector3.js";

const finite = Number.isFinite;
const clamp01 = value => Math.max(0, Math.min(1, value));
const zero3 = () => ({ x: 0, y: 0, z: 0 });
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const length3 = a => Math.hypot(a.x, a.y, a.z);
const freeze3 = a => Object.freeze({ x: a.x, y: a.y, z: a.z });

function validateSamples(samples, kind) {
  if (!Array.isArray(samples)) throw new TypeError(`${kind}Samples must be an array`);
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample || !isFinite3(sample.position)) {
      throw new TypeError(`${kind}Samples[${i}].position must be a finite body-local vector`);
    }
    if (kind === "volume") {
      if (!finite(sample.volume) || sample.volume <= 0) {
        throw new RangeError(`volumeSamples[${i}].volume must be finite and positive`);
      }
      if (!finite(sample.cellHeight) || sample.cellHeight <= 0) {
        throw new RangeError(`volumeSamples[${i}].cellHeight must be finite and positive`);
      }
    } else {
      if (!finite(sample.area) || sample.area <= 0) {
        throw new RangeError(`surfaceSamples[${i}].area must be finite and positive`);
      }
      if (!finite(sample.dragCoefficient) || sample.dragCoefficient < 0) {
        throw new RangeError(`surfaceSamples[${i}].dragCoefficient must be finite and non-negative`);
      }
    }
  }
}

function bodyPose(body) {
  const position = body.translation();
  const rotation = body.rotation();
  if (!isFinite3(position) || !rotation ||
      ![rotation.x, rotation.y, rotation.z, rotation.w].every(finite)) {
    throw new TypeError("Rapier body returned an invalid pose");
  }
  return { position, rotation };
}

function transformPoint(point, pose) {
  const { x, y, z, w } = pose.rotation;
  const qx = 2 * (y * point.z - z * point.y);
  const qy = 2 * (z * point.x - x * point.z);
  const qz = 2 * (x * point.y - y * point.x);
  const rotated = {
    x: point.x + w * qx + (y * qz - z * qy),
    y: point.y + w * qy + (z * qx - x * qz),
    z: point.z + w * qz + (x * qy - y * qx)
  };
  return add3(pose.position, rotated);
}

/**
 * Couple one Rapier rigid body to Ultra-Water's asynchronous WaterQuery.
 *
 * The adapter does not create or step a Rapier world. Rapier remains the sole
 * owner of body integration, contacts, constraints and gravity. The host calls
 * submitQuery() before/around the renderer's WaterQuery pass, ingestQuery()
 * after readback completion, and applyForces() before world.step().
 *
 * Query order is stable: all volume samples first, then all surface samples.
 * Each descriptor position is body-local and expressed in metres.
 */
export function createRapierWaterBodyAdapter({
  body,
  waterQuery,
  volumeSamples = [],
  surfaceSamples = [],
  density = 1025,
  gravity = 9.81,
  buoyancyScale = 1,
  maxReadbackAge = 0.15,
  layoutTag = 1
}) {
  if (!body || typeof body.translation !== "function" ||
      typeof body.rotation !== "function" || typeof body.linvel !== "function" ||
      typeof body.angvel !== "function" || typeof body.addForceAtPoint !== "function") {
    throw new TypeError("body must expose Rapier RigidBody pose, velocity and addForceAtPoint methods");
  }
  if (!waterQuery || typeof waterQuery.submit !== "function") {
    throw new TypeError("waterQuery must expose Ultra-Water WaterQuery.submit()");
  }
  validateSamples(volumeSamples, "volume");
  validateSamples(surfaceSamples, "surface");
  if (volumeSamples.length + surfaceSamples.length === 0) {
    throw new RangeError("At least one volume or surface sample is required");
  }
  if (!finite(density) || density <= 0) throw new RangeError("density must be finite and positive");
  if (!finite(gravity) || gravity <= 0) throw new RangeError("gravity must be finite and positive");
  if (!finite(buoyancyScale) || buoyancyScale < 0) throw new RangeError("buoyancyScale must be finite and non-negative");
  if (!finite(maxReadbackAge) || maxReadbackAge <= 0) throw new RangeError("maxReadbackAge must be finite and positive");
  if (!Number.isInteger(layoutTag)) throw new TypeError("layoutTag must be an integer");

  const samples = [
    ...volumeSamples.map(sample => ({ ...sample, kind: "volume" })),
    ...surfaceSamples.map(sample => ({ ...sample, kind: "surface" }))
  ];
  const snapshots = new Map();
  let previousDisplacement = null;
  let previousResultTime = null;
  let latest = null;

  function collectQueryPoints() {
    const pose = bodyPose(body);
    const worldPoints = samples.map(sample => transformPoint(sample.position, pose));
    const xz = new Float32Array(worldPoints.length * 2);
    for (let i = 0; i < worldPoints.length; i++) {
      xz[i * 2] = worldPoints[i].x;
      xz[i * 2 + 1] = worldPoints[i].z;
    }
    return Object.freeze({ xz, worldPoints: Object.freeze(worldPoints.map(freeze3)) });
  }

  function submitQuery(time) {
    if (!finite(time)) throw new TypeError("query time must be finite");
    const snapshot = collectQueryPoints();
    // WaterQuery may decline submissions while two GPU readbacks are in flight.
    // Retain a bounded set of timestamps so completed results can be matched.
    waterQuery.submit(snapshot.xz, samples.length, layoutTag, time);
    snapshots.set(time, snapshot);
    while (snapshots.size > 8) snapshots.delete(snapshots.keys().next().value);
    return Object.freeze({ count: samples.length, layoutTag, time });
  }

  function ingestQuery() {
    const query = waterQuery;
    if (query.resultTag !== layoutTag || !finite(query.resultTime) ||
        !Number.isInteger(query.resultCount) || query.resultCount < samples.length ||
        !query.result || query.result.length < samples.length * 4) {
      return Object.freeze({ valid: false, reason: "no-matching-query" });
    }
    if (latest && query.resultTime === latest.time) {
      return Object.freeze({ valid: false, reason: "unchanged-query" });
    }
    const snapshot = snapshots.get(query.resultTime);
    if (!snapshot) return Object.freeze({ valid: false, reason: "unknown-query-timestamp" });

    const displacement = new Float64Array(samples.length * 3);
    const waterVelocity = new Array(samples.length);
    const dt = previousResultTime === null ? 0 : query.resultTime - previousResultTime;
    if (dt < 0) return Object.freeze({ valid: false, reason: "out-of-order-query" });

    for (let i = 0; i < samples.length; i++) {
      const h = query.result[i * 4];
      const dx = query.result[i * 4 + 1];
      const dz = query.result[i * 4 + 2];
      if (![h, dx, dz].every(finite)) {
        return Object.freeze({ valid: false, reason: "non-finite-query-result", sampleIndex: i });
      }
      displacement[i * 3] = dx;
      displacement[i * 3 + 1] = h;
      displacement[i * 3 + 2] = dz;
      let velocity = zero3();
      if (dt > 1e-6 && previousDisplacement) {
        velocity = {
          x: (dx - previousDisplacement[i * 3]) / dt,
          y: (h - previousDisplacement[i * 3 + 1]) / dt,
          z: (dz - previousDisplacement[i * 3 + 2]) / dt
        };
        if (!isFinite3(velocity)) {
          return Object.freeze({ valid: false, reason: "non-finite-water-velocity", sampleIndex: i });
        }
      }
      waterVelocity[i] = freeze3(velocity);
    }

    previousDisplacement = displacement;
    previousResultTime = query.resultTime;
    latest = Object.freeze({
      valid: true,
      time: query.resultTime,
      worldPoints: snapshot.worldPoints,
      heights: Object.freeze(samples.map((_, i) => query.result[i * 4])),
      waterVelocity: Object.freeze(waterVelocity)
    });
    // Older snapshots cannot be used after a newer result has been accepted.
    for (const time of snapshots.keys()) if (time <= query.resultTime) snapshots.delete(time);
    return Object.freeze({ valid: true, time: latest.time, sampleCount: samples.length });
  }

  function applyForces(simulationTime) {
    if (!finite(simulationTime)) throw new TypeError("simulationTime must be finite");
    if (!latest) return Object.freeze({ applied: false, reason: "no-water-query" });
    const age = simulationTime - latest.time;
    if (age < 0 || age > maxReadbackAge) {
      return Object.freeze({ applied: false, reason: "stale-water-query", age });
    }

    const pose = bodyPose(body);
    const linearVelocity = body.linvel();
    const angularVelocity = body.angvel();
    if (!isFinite3(linearVelocity) || !isFinite3(angularVelocity)) {
      throw new TypeError("Rapier body returned invalid velocity");
    }

    let buoyancyForce = zero3();
    let dragForce = zero3();
    let forceCount = 0;
    for (let i = 0; i < samples.length; i++) {
      const descriptor = samples[i];
      const point = transformPoint(descriptor.position, pose);
      const arm = sub3(point, pose.position);
      const pointVelocity = add3(linearVelocity, cross3(angularVelocity, arm));
      const waterVelocity = latest.waterVelocity[i];

      if (descriptor.kind === "volume") {
        const submerged = clamp01((latest.heights[i] - point.y) / descriptor.cellHeight + 0.5);
        if (submerged > 0) {
          const magnitude = density * gravity * descriptor.volume * submerged * buoyancyScale;
          const force = { x: 0, y: magnitude, z: 0 };
          body.addForceAtPoint(force, point, true);
          buoyancyForce = add3(buoyancyForce, force);
          forceCount++;
        }
      } else {
        const relative = sub3(pointVelocity, waterVelocity);
        const speed = length3(relative);
        if (speed > 0 && descriptor.dragCoefficient > 0) {
          const factor = -0.5 * density * descriptor.dragCoefficient * descriptor.area * speed;
          const force = scale3(relative, factor);
          if (!isFinite3(force)) throw new RangeError("Hydrodynamic drag force overflowed");
          body.addForceAtPoint(force, point, true);
          dragForce = add3(dragForce, force);
          forceCount++;
        }
      }
    }

    return Object.freeze({
      applied: true,
      age,
      forceCount,
      buoyancyForce: freeze3(buoyancyForce),
      dragForce: freeze3(dragForce)
    });
  }

  return Object.freeze({
    sampleCount: samples.length,
    submitQuery,
    ingestQuery,
    applyForces,
    get latestQuery() { return latest; }
  });
}
