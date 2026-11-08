const finite = Number.isFinite;

export function estimateSphBoundaryLoad({
  state,
  config,
  bodyPosition,
  bodyVelocity = { x: 0, y: 0 },
  pressureScale = 0.0005,
  dragScale = 0.025,
  maxForce = 80,
  fluidDensity = 1,
  gravity = 12,
  buoyancyScale = 1,
}) {
  if (!state || !config || !bodyPosition) throw new TypeError('state, config and bodyPosition are required');
  if (!Number.isInteger(state.count) || state.count < 0) throw new RangeError('state.count must be a non-negative integer');
  if (!finite(config.smoothingRadius) || config.smoothingRadius <= 0) throw new RangeError('smoothingRadius must be positive');
  if (!config.obstacleSize || !finite(config.obstacleSize.x) || !finite(config.obstacleSize.y) || config.obstacleSize.x <= 0 || config.obstacleSize.y <= 0) throw new RangeError('obstacleSize dimensions must be positive');
  if (!finite(config.targetDensity) || !finite(config.pressureMultiplier)) throw new TypeError('SPH pressure parameters must be finite');
  if (![bodyPosition.x, bodyPosition.y, bodyVelocity.x, bodyVelocity.y, pressureScale, dragScale, maxForce, fluidDensity, gravity, buoyancyScale].every(finite)) {
    throw new TypeError('boundary load inputs must be finite');
  }
  if (pressureScale < 0 || dragScale < 0 || maxForce <= 0 || fluidDensity <= 0 || gravity <= 0 || buoyancyScale < 0) {
    throw new RangeError('force scales and fluid properties are invalid');
  }

  const halfX = config.obstacleSize.x * 0.5;
  const halfY = config.obstacleSize.y * 0.5;
  const h = config.smoothingRadius;
  const positions = state.positions;
  const velocities = state.velocities;
  const densities = state.densities;
  let pressureX = 0, pressureY = 0, dragX = 0, dragY = 0, contacts = 0;
  let localSurfaceY = -Infinity;

  for (let i = 0; i < state.count; i++) {
    const index = i * 2;
    const particleX = positions[index];
    const particleY = positions[index + 1];
    if (Math.abs(particleX - bodyPosition.x) <= halfX + h) {
      localSurfaceY = Math.max(localSurfaceY, particleY);
    }
    const dx = particleX - bodyPosition.x;
    const dy = particleY - bodyPosition.y;
    const edgeX = Math.abs(dx) - halfX;
    const edgeY = Math.abs(dy) - halfY;

    // The SPH solver already resolves particles inside its AABB obstacle.
    // Only particles in the external smoothing-radius band contribute loads.
    if (edgeX < 0 && edgeY < 0) continue;
    const distance = Math.hypot(Math.max(0, edgeX), Math.max(0, edgeY));
    if (distance >= h) continue;

    let normalX = 0, normalY = 0, surfaceDistance;
    if (edgeX > 0 && edgeY > 0) {
      normalX = (Math.sign(dx) || 1) * edgeX / distance;
      normalY = (Math.sign(dy) || 1) * edgeY / distance;
      surfaceDistance = distance;
    } else if (edgeX >= edgeY) {
      normalX = Math.sign(dx) || 1;
      surfaceDistance = Math.max(0, edgeX);
    } else {
      normalY = Math.sign(dy) || 1;
      surfaceDistance = Math.max(0, edgeY);
    }
    const weight = Math.max(0, 1 - surfaceDistance / h);
    const density = densities[index] || 0;
    const pressure = Math.max(0, density - config.targetDensity) * config.pressureMultiplier;

    // Positive compressive pressure pushes the body opposite the outward normal.
    pressureX -= normalX * pressure * weight * pressureScale;
    pressureY -= normalY * pressure * weight * pressureScale;

    // Relative-velocity drag is a deliberately scaled boundary-load estimate.
    dragX += (velocities[index] - bodyVelocity.x) * weight * dragScale;
    dragY += (velocities[index + 1] - bodyVelocity.y) * weight * dragScale;
    contacts++;
  }

  // The upstream SPH solver is not SI-calibrated and does not produce a
  // hydrostatic pressure column. Estimate Archimedes buoyancy from the local
  // particle envelope, treating the 2D cross-section as unit depth.
  const submerged = localSurfaceY > -Infinity
    ? Math.max(0, Math.min(1, (localSurfaceY - (bodyPosition.y - halfY)) / (2 * halfY)))
    : 0;
  const buoyancyY = fluidDensity * gravity * config.obstacleSize.x * config.obstacleSize.y * submerged * buoyancyScale;

  let forceX = pressureX + dragX;
  let forceY = pressureY + dragY + buoyancyY;
  const magnitude = Math.hypot(forceX, forceY);
  if (magnitude > maxForce) {
    const scale = maxForce / magnitude;
    forceX *= scale;
    forceY *= scale;
  }

  return Object.freeze({
    force: Object.freeze({ x: forceX, y: forceY }),
    pressureForce: Object.freeze({ x: pressureX, y: pressureY }),
    buoyancyForce: Object.freeze({ x: 0, y: buoyancyY }),
    dragForce: Object.freeze({ x: dragX, y: dragY }),
    contactParticles: contacts,
    submergedFraction: submerged,
  });
}
