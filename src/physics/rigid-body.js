import { add3, dot3, isFinite3, scale3 } from "../core/vector3.js";
import { normalizeQuat, multiplyQuat, quatFromAxisAngle, rotateVector3 } from "../core/quaternion.js";

const zero3 = () => ({ x: 0, y: 0, z: 0 });
const finite3 = v => v && isFinite3(v);
const freeze3 = v => Object.freeze({ x: v.x, y: v.y, z: v.z });
const transpose = a => a[0].map((_, j) => a.map(row => row[j]));
const matMul = (a, b) => a.map((row, i) => b[0].map((_, j) =>
  row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
const matVec = (a, v) => ({
  x: a[0][0] * v.x + a[0][1] * v.y + a[0][2] * v.z,
  y: a[1][0] * v.x + a[1][1] * v.y + a[1][2] * v.z,
  z: a[2][0] * v.x + a[2][1] * v.y + a[2][2] * v.z
});

function validateInertia(input) {
  if (!Array.isArray(input) || input.length !== 3 ||
      input.some(row => !Array.isArray(row) || row.length !== 3 ||
        row.some(value => !Number.isFinite(value)))) {
    throw new TypeError("inertiaBody must be a finite 3x3 matrix");
  }
  const scale = Math.max(1, ...input.flat().map(Math.abs));
  const tolerance = 1e-10 * scale;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (Math.abs(input[i][j] - input[j][i]) > tolerance) {
        throw new RangeError("inertiaBody must be symmetric");
      }
    }
  }
  const a = input[0][0];
  const b = 0.5 * (input[0][1] + input[1][0]);
  const c = 0.5 * (input[0][2] + input[2][0]);
  const d = input[1][1];
  const e = 0.5 * (input[1][2] + input[2][1]);
  const f = input[2][2];
  const minor2 = a * d - b * b;
  const determinant = a * (d * f - e * e) - b * (b * f - c * e) + c * (b * e - c * d);
  if (!(a > 0 && minor2 > 0 && determinant > 0) || !Number.isFinite(determinant)) {
    throw new RangeError("inertiaBody must be positive definite");
  }
  const matrix = [[a, b, c], [b, d, e], [c, e, f]];
  const inverse = [
    [(d * f - e * e) / determinant, (c * e - b * f) / determinant, (b * e - c * d) / determinant],
    [(c * e - b * f) / determinant, (a * f - c * c) / determinant, (b * c - a * e) / determinant],
    [(b * e - c * d) / determinant, (b * c - a * e) / determinant, (a * d - b * b) / determinant]
  ];
  if (inverse.flat().some(value => !Number.isFinite(value))) {
    throw new RangeError("inertiaBody inverse is not finite");
  }
  return {
    matrix: Object.freeze(matrix.map(row => Object.freeze(row))),
    inverse: Object.freeze(inverse.map(row => Object.freeze(row)))
  };
}

function rotationMatrix(orientation) {
  const x = rotateVector3(orientation, { x: 1, y: 0, z: 0 });
  const y = rotateVector3(orientation, { x: 0, y: 1, z: 0 });
  const z = rotateVector3(orientation, { x: 0, y: 0, z: 1 });
  return [
    [x.x, y.x, z.x],
    [x.y, y.y, z.y],
    [x.z, y.z, z.z]
  ];
}

function worldInverseInertia(orientation, inverseBody) {
  const rotation = rotationMatrix(orientation);
  return matMul(matMul(rotation, inverseBody), transpose(rotation));
}

function worldInertia(orientation, inertiaBody) {
  const rotation = rotationMatrix(orientation);
  return matMul(matMul(rotation, inertiaBody), transpose(rotation));
}

function freezeState({ position, orientation, linearVelocity, angularMomentum, mass, inertiaBody, inverseInertiaBody }) {
  return Object.freeze({
    position: freeze3(position),
    orientation: Object.freeze(normalizeQuat(orientation)),
    linearVelocity: freeze3(linearVelocity),
    angularMomentum: freeze3(angularMomentum),
    mass,
    inertiaBody,
    inverseInertiaBody
  });
}

/**
 * Create an immutable six-degree-of-freedom rigid-body state.
 * Inertia is a full symmetric positive-definite tensor in body coordinates.
 * Angular momentum is stored in world coordinates.
 */
export function createRigidBodyState({
  mass,
  inertiaBody,
  position = zero3(),
  orientation = { x: 0, y: 0, z: 0, w: 1 },
  linearVelocity = zero3(),
  angularVelocity = zero3()
}) {
  if (!Number.isFinite(mass) || mass <= 0) throw new RangeError("mass must be finite and positive");
  if (!finite3(position) || !finite3(linearVelocity) || !finite3(angularVelocity)) {
    throw new TypeError("Rigid-body position and velocities must be finite vectors");
  }
  const inertia = validateInertia(inertiaBody);
  const q = normalizeQuat(orientation);
  const momentum = matVec(worldInertia(q, inertia.matrix), angularVelocity);
  if (!finite3(momentum)) throw new RangeError("Initial angular momentum overflowed");
  return freezeState({
    position, orientation: q, linearVelocity, angularMomentum: momentum, mass,
    inertiaBody: inertia.matrix, inverseInertiaBody: inertia.inverse
  });
}

/** Derive world angular velocity from world angular momentum and body inertia. */
export function rigidBodyAngularVelocity(state) {
  if (!state || !state.orientation || !state.inverseInertiaBody || !finite3(state.angularMomentum)) {
    throw new TypeError("Invalid rigid-body state");
  }
  const omega = matVec(worldInverseInertia(state.orientation, state.inverseInertiaBody), state.angularMomentum);
  if (!finite3(omega)) throw new RangeError("Angular velocity is not finite");
  return omega;
}

/**
 * Semi-implicit Euler translation plus world-angular-momentum orientation
 * update. Wrench force and torque are world-space and torque is about COM.
 * Gravity is an ordinary external force and is intentionally not implicit.
 */
export function integrateRigidBody(state, wrench, dt) {
  if (!state || !Number.isFinite(state.mass) || state.mass <= 0 ||
      !finite3(state.position) || !finite3(state.linearVelocity) ||
      !finite3(state.angularMomentum) || !state.orientation ||
      !state.inertiaBody || !state.inverseInertiaBody) {
    throw new TypeError("state must be created by createRigidBodyState");
  }
  if (!wrench || !finite3(wrench.force) || !finite3(wrench.torque)) {
    throw new TypeError("wrench must contain finite world-space force and torque");
  }
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError("dt must be finite and positive");

  const linearVelocity = add3(state.linearVelocity, scale3(wrench.force, dt / state.mass));
  const position = add3(state.position, scale3(linearVelocity, dt));
  const angularMomentum = add3(state.angularMomentum, scale3(wrench.torque, dt));
  if (!finite3(linearVelocity) || !finite3(position) || !finite3(angularMomentum)) {
    throw new RangeError("Rigid-body integration overflowed finite state");
  }

  const provisional = { ...state, angularMomentum };
  const omega = rigidBodyAngularVelocity(provisional);
  const angularSpeed = Math.hypot(omega.x, omega.y, omega.z);
  if (!Number.isFinite(angularSpeed) || !Number.isFinite(angularSpeed * dt)) {
    throw new RangeError("Angular integration increment is not finite");
  }
  const orientation = angularSpeed > 0
    ? normalizeQuat(multiplyQuat(quatFromAxisAngle(omega, angularSpeed * dt), state.orientation))
    : normalizeQuat(state.orientation);

  return freezeState({
    position, orientation, linearVelocity, angularMomentum,
    mass: state.mass, inertiaBody: state.inertiaBody, inverseInertiaBody: state.inverseInertiaBody
  });
}

/** Translational plus rotational kinetic energy, in joules. */
export function rigidBodyKineticEnergy(state) {
  const omega = rigidBodyAngularVelocity(state);
  const translational = 0.5 * state.mass * dot3(state.linearVelocity, state.linearVelocity);
  const rotational = 0.5 * dot3(state.angularMomentum, omega);
  const energy = translational + rotational;
  if (!Number.isFinite(energy) || energy < 0) throw new RangeError("Rigid-body kinetic energy is invalid");
  return energy;
}
