import { isFinite3 } from "./vector3.js";

const finiteQuaternion = q => q && [q.x, q.y, q.z, q.w].every(Number.isFinite);
const magnitude = q => Math.hypot(q.x, q.y, q.z, q.w);

export const quat = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });

export function normalizeQuat(q) {
  if (!finiteQuaternion(q)) throw new TypeError("Quaternion components must be finite");
  const length = magnitude(q);
  if (length <= Number.EPSILON) throw new RangeError("Cannot normalize a zero quaternion");
  return quat(q.x / length, q.y / length, q.z / length, q.w / length);
}

export function conjugateQuat(q) {
  if (!finiteQuaternion(q)) throw new TypeError("Quaternion components must be finite");
  return quat(-q.x, -q.y, -q.z, q.w);
}

/** Hamilton product a*b; with column-vector transforms, b is applied before a. */
export function multiplyQuat(a, b) {
  if (!finiteQuaternion(a) || !finiteQuaternion(b)) throw new TypeError("Quaternion components must be finite");
  return quat(
    a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z
  );
}

export function quatFromAxisAngle(axis, angleRadians) {
  if (!isFinite3(axis)) throw new TypeError("Rotation axis must be finite");
  if (!Number.isFinite(angleRadians)) throw new TypeError("Angle must be finite radians");
  const length = Math.hypot(axis.x, axis.y, axis.z);
  if (length <= Number.EPSILON) throw new RangeError("Rotation axis must be non-zero");
  const half = angleRadians * 0.5;
  const s = Math.sin(half) / length;
  return quat(axis.x*s, axis.y*s, axis.z*s, Math.cos(half));
}

export function rotateVector3(qInput, v) {
  if (!isFinite3(v)) throw new TypeError("Vector components must be finite");
  const q = normalizeQuat(qInput);
  const p = quat(v.x, v.y, v.z, 0);
  const result = multiplyQuat(multiplyQuat(q, p), conjugateQuat(q));
  return { x: result.x, y: result.y, z: result.z };
}
