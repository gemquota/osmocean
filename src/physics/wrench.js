import { isFinite3, add3, sub3, cross3 } from "../core/vector3.js";

const zero = () => ({ x: 0, y: 0, z: 0 });
const finite = (v, label) => {
  if (!isFinite3(v)) throw new TypeError(`${label} must be a finite vector`);
};

export function createWrenchAccumulator({ origin = zero() } = {}) {
  finite(origin, "Wrench origin");
  let force = zero();
  let torque = zero();
  let forceCount = 0;
  let torqueCount = 0;

  function addForce(value, applicationPoint = origin) {
    finite(value, "Force");
    finite(applicationPoint, "Application point");
    force = add3(force, value);
    torque = add3(torque, cross3(sub3(applicationPoint, origin), value));
    forceCount++;
  }

  function addTorque(value) {
    finite(value, "Torque");
    torque = add3(torque, value);
    torqueCount++;
  }

  function snapshot() {
    return Object.freeze({
      origin: Object.freeze({ ...origin }),
      force: Object.freeze({ ...force }),
      torque: Object.freeze({ ...torque }),
      forceCount,
      torqueCount
    });
  }

  function reset() {
    force = zero();
    torque = zero();
    forceCount = 0;
    torqueCount = 0;
  }

  return Object.freeze({ addForce, addTorque, snapshot, reset });
}
