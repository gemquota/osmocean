import { add3, scale3, isFinite3 } from "../core/vector3.js";
import { normalizeQuat, conjugateQuat, rotateVector3, multiplyQuat, quat } from "../core/quaternion.js";

function validatePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`);
}

/** Create an immutable 6-DOF rigid-body state. Inertia is diagonal in body-local axes. */
export function rigidBodyState({
  position = { x: 0, y: 0, z: 0 },
  orientation = quat(),
  linearVelocity = { x: 0, y: 0, z: 0 },
  angularMomentum = { x: 0, y: 0, z: 0 }
} = {}) {
  if (!isFinite3(position) || !isFinite3(linearVelocity) || !isFinite3(angularMomentum)) {
    throw new TypeError("Rigid-body vectors must be finite");
  }
  return Object.freeze({
    position: Object.freeze({ ...position }),
    orientation: Object.freeze(normalizeQuat(orientation)),
    linearVelocity: Object.freeze({ ...linearVelocity }),
    angularMomentum: Object.freeze({ ...angularMomentum })
  });
}

/**
 * Semi-implicit Euler step. Angular momentum is stored in world space; diagonal
 * inertia is body-local. External torque updates angular momentum before orientation.
 * This is a baseline integrator, not a high-order or constraint-coupled solver.
 */
export function integrateRigidBody({ state, mass, inertia, force, torque, dt }) {
  validatePositive(mass, "Mass");
  if (!inertia || !["x", "y", "z"].every(k => Number.isFinite(inertia[k]) && inertia[k] > 0)) {
    throw new RangeError("Body-local diagonal inertia components must be finite and positive");
  }
  if (!isFinite3(force) || !isFinite3(torque)) throw new TypeError("Force and torque must be finite");
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError("dt must be finite and positive");

  const linearVelocity = add3(state.linearVelocity, scale3(force, dt / mass));
  const position = add3(state.position, scale3(linearVelocity, dt));
  const angularMomentum = add3(state.angularMomentum, scale3(torque, dt));

  const inverseOrientation = conjugateQuat(state.orientation);
  const localMomentum = rotateVector3(inverseOrientation, angularMomentum);
  const localOmega = {
    x: localMomentum.x / inertia.x,
    y: localMomentum.y / inertia.y,
    z: localMomentum.z / inertia.z
  };
  const omegaWorld = rotateVector3(state.orientation, localOmega);
  const omegaQuat = quat(omegaWorld.x, omegaWorld.y, omegaWorld.z, 0);
  const derivative = multiplyQuat(omegaQuat, state.orientation);
  const orientation = normalizeQuat({
    x: state.orientation.x + 0.5 * derivative.x * dt,
    y: state.orientation.y + 0.5 * derivative.y * dt,
    z: state.orientation.z + 0.5 * derivative.z * dt,
    w: state.orientation.w + 0.5 * derivative.w * dt
  });

  return rigidBodyState({ position, orientation, linearVelocity, angularMomentum });
}
