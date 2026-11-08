import { isFinite3 } from "../core/vector3.js";
import { transformPoint } from "../core/rigid-transform.js";

/**
 * Transform local surface quadrature samples into world space.
 * Each sample's area is its represented patch area, not a point radius.
 */
export function transformSurfaceQuadrature({ transform, samples }) {
  if (!transform || !isFinite3(transform.position) || !transform.rotation) {
    throw new TypeError("transform must contain a finite position and rotation");
  }
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new RangeError("samples must be a non-empty array");
  }
  const result = samples.map((sample, index) => {
    if (!sample || !isFinite3(sample.position)) {
      throw new TypeError("samples[" + index + "].position must be finite and body-local");
    }
    if (!Number.isFinite(sample.area) || sample.area <= 0) {
      throw new RangeError("samples[" + index + "].area must be finite and positive");
    }
    if (!Number.isFinite(sample.dragCoefficient) || sample.dragCoefficient < 0) {
      throw new RangeError("samples[" + index + "].dragCoefficient must be finite and non-negative");
    }
    return Object.freeze({
      position: Object.freeze(transformPoint(transform, sample.position)),
      localPosition: Object.freeze({ ...sample.position }),
      area: sample.area,
      dragCoefficient: sample.dragCoefficient
    });
  });
  return Object.freeze(result);
}
