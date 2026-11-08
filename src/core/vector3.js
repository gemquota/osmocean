/** Immutable plain-object Vector3 primitives. All values are world-space SI quantities unless documented otherwise. */
export const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

export function add3(a, b) {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function sub3(a, b) {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scale3(a, scalar) {
  return vec3(a.x * scalar, a.y * scalar, a.z * scalar);
}

export function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length3(a) {
  return Math.hypot(a.x, a.y, a.z);
}

export function isFinite3(a) {
  return Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
}
