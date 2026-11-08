import { rigidBodyAngularVelocity, integrateRigidBody } from "./rigid-body.js";
import { transformSurfaceQuadrature } from "./surface-quadrature.js";
import { calculateHydrodynamicWrench } from "./hydrodynamics.js";
import { calculateBuoyancyWrench } from "./buoyancy.js";
import { add3, scale3, isFinite3 } from "../core/vector3.js";

const freeze3 = v => Object.freeze({ x: v.x, y: v.y, z: v.z });
const invalid = result => Object.freeze({
  valid: false,
  reason: result.reason,
  sampleIndex: result.sampleIndex,
  sample: result.sample,
  wrench: null,
  drag: result.drag ?? null,
  buoyancy: result.buoyancy ?? null,
  state: null
});

/**
 * Evaluate body-local surface drag and volume buoyancy in one world-space
 * frame. Neither load is exposed as a partial total if either field query fails.
 */
export function calculateBodyFluidWrench({
  bodyState,
  surfaceSamples,
  volumeSamples,
  waterSurface,
  waterField,
  gravity,
  time = 0
}) {
  if (!bodyState || !isFinite3(bodyState.position) || !bodyState.orientation ||
      !isFinite3(bodyState.linearVelocity)) {
    throw new TypeError("bodyState must be a valid rigid-body state");
  }
  const transform = { position: bodyState.position, rotation: bodyState.orientation };
  const worldSurfaceSamples = transformSurfaceQuadrature({ transform, samples: surfaceSamples });
  const angularVelocity = rigidBodyAngularVelocity(bodyState);
  const drag = calculateHydrodynamicWrench({
    centerOfMass: bodyState.position,
    linearVelocity: bodyState.linearVelocity,
    angularVelocity,
    surfaceSamples: worldSurfaceSamples,
    waterField,
    time
  });
  if (!drag.valid) return invalid({ ...drag, drag, buoyancy: null });

  const buoyancy = calculateBuoyancyWrench({
    centerOfMass: bodyState.position,
    transform,
    volumeSamples,
    waterSurface,
    waterField,
    gravity,
    time
  });
  if (!buoyancy.valid) return invalid({ ...buoyancy, drag, buoyancy });

  const force = add3(drag.wrench.force, buoyancy.wrench.force);
  const torque = add3(drag.wrench.torque, buoyancy.wrench.torque);
  if (!isFinite3(force) || !isFinite3(torque)) {
    throw new RangeError("Combined fluid wrench overflowed finite range");
  }
  return Object.freeze({
    valid: true,
    reason: null,
    sampleIndex: null,
    wrench: Object.freeze({
      origin: freeze3(bodyState.position),
      force: freeze3(force),
      torque: freeze3(torque),
      forceCount: drag.wrench.forceCount + buoyancy.wrench.forceCount
    }),
    drag,
    buoyancy
  });
}

/**
 * One coupled rigid-body step. Body weight is applied as mass*gravity;
 * buoyancy and drag are supplied by the fluid-load calculation.
 */
export function stepRigidBodyInWater({
  bodyState,
  surfaceSamples,
  volumeSamples,
  waterSurface,
  waterField,
  gravity,
  time = 0,
  dt
}) {
  if (!isFinite3(gravity)) throw new TypeError("gravity must be a finite vector");
  const loads = calculateBodyFluidWrench({
    bodyState, surfaceSamples, volumeSamples, waterSurface, waterField, gravity, time
  });
  if (!loads.valid) return Object.freeze({ valid: false, loads, state: null });
  const weight = scale3(gravity, bodyState.mass);
  const totalForce = add3(loads.wrench.force, weight);
  const state = integrateRigidBody(bodyState, {
    force: totalForce,
    torque: loads.wrench.torque
  }, dt);
  return Object.freeze({ valid: true, loads, state });
}
