import { add3, sub3, isFinite3 } from "./vector3.js";
import { normalizeQuat, rotateVector3, multiplyQuat, conjugateQuat } from "./quaternion.js";

export function rigidTransform({ position = { x: 0, y: 0, z: 0 }, rotation } = {}) {
  if (!isFinite3(position)) throw new TypeError("Transform position must be finite");
  if (!rotation) rotation = { x: 0, y: 0, z: 0, w: 1 };
  return Object.freeze({
    position: Object.freeze({ ...position }),
    rotation: Object.freeze(normalizeQuat(rotation))
  });
}

/** Compose parent<-local transforms. */
export function composeTransform(parent, local) {
  return rigidTransform({
    position: add3(parent.position, rotateVector3(parent.rotation, local.position)),
    rotation: multiplyQuat(parent.rotation, local.rotation)
  });
}

/** Convert a world-space point into this transform's local frame. */
export function inverseTransformPoint(transform, worldPoint) {
  if (!isFinite3(worldPoint)) throw new TypeError("Point must be finite");
  return rotateVector3(conjugateQuat(transform.rotation), sub3(worldPoint, transform.position));
}

/** Convert a local-space point into world space. */
export function transformPoint(transform, localPoint) {
  if (!isFinite3(localPoint)) throw new TypeError("Point must be finite");
  return add3(transform.position, rotateVector3(transform.rotation, localPoint));
}
