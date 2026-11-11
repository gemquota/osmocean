/**
 * Water-relative fish mechanics in world units.
 *
 * The water surface solver is a free-surface height solver, not a volumetric
 * underwater Navier-Stokes field. This model therefore combines its sampled
 * surface height with a depth-sheared subsurface current field, then applies
 * buoyancy, quadratic relative-flow drag and active depth regulation.
 */
export function calculateAquaticAcceleration({
  velocity,
  waterVelocity,
  positionY,
  surfaceY,
  preferredDepth,
  bodySize = 1,
  waterDensity = 1025,
  bodyDensity = 1025,
  dragCoefficient = 0.82,
  gravity = 9.81,
  depthStiffness = 0.72,
  verticalDamping = 1.55,
  maxVerticalAcceleration = 3
}) {
  for (const [name, v] of Object.entries({ velocity, waterVelocity })) {
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
      throw new TypeError(name + ' must be a finite 3D vector');
    }
  }
  for (const [name, value] of Object.entries({
    positionY, surfaceY, preferredDepth, bodySize, waterDensity, bodyDensity,
    dragCoefficient, gravity, depthStiffness, verticalDamping, maxVerticalAcceleration
  })) if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
  if (bodySize <= 0 || waterDensity <= 0 || bodyDensity <= 0 || gravity < 0) {
    throw new RangeError('body size, densities and gravity are outside their physical range');
  }

  const rx = velocity.x - waterVelocity.x;
  const ry = velocity.y - waterVelocity.y;
  const rz = velocity.z - waterVelocity.z;
  const relativeSpeed = Math.hypot(rx, ry, rz);
  // A compact allometric approximation: frontal area / body mass scales as 1/L.
  const dragScale = 0.5 * dragCoefficient * (waterDensity / 1025) *
    (0.65 / Math.max(0.25, bodySize)) * relativeSpeed;
  const buoyancy = Math.max(-0.65, Math.min(0.65,
    gravity * (waterDensity / bodyDensity - 1)));
  const targetY = surfaceY - preferredDepth;
  const depthControl = Math.max(-maxVerticalAcceleration, Math.min(maxVerticalAcceleration,
    (targetY - positionY) * depthStiffness - velocity.y * verticalDamping));

  return Object.freeze({
    x: -rx * dragScale,
    y: -ry * dragScale + buoyancy + depthControl,
    z: -rz * dragScale
  });
}

export function constrainFishDepth(position, velocity, surfaceY, minDepth, maxDepth) {
  if (!position || !velocity || ![position.y, velocity.y, surfaceY, minDepth, maxDepth].every(Number.isFinite)) {
    throw new TypeError('depth constraint requires finite position, velocity and bounds');
  }
  if (!(minDepth >= 0 && maxDepth > minDepth)) throw new RangeError('invalid fish depth interval');
  const shallow = surfaceY - minDepth;
  const deep = surfaceY - maxDepth;
  if (position.y > shallow) {
    position.y = shallow;
    if (velocity.y > 0) velocity.y *= -0.12;
  } else if (position.y < deep) {
    position.y = deep;
    if (velocity.y < 0) velocity.y *= -0.12;
  }
  return position;
}
