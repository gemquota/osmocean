const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function applyOceanSurfaceBoundary({
  state,
  config,
  sample,
  previousSample = null,
  baseSurfaceY,
  heightScale = 0.65,
  blend = 0.12,
  spring = 2.4,
  maxVelocityDelta = 2.5,
}) {
  if (!state || !config || !sample || !Number.isFinite(baseSurfaceY)) {
    throw new TypeError('state, config, sample and baseSurfaceY are required');
  }
  const count = sample.count;
  if (!Number.isInteger(count) || count < 2 || sample.data?.length < count * 4 || sample.points?.length < count) {
    throw new RangeError('ocean sample must contain at least two complete probes');
  }
  if (!Number.isFinite(config.smoothingRadius) || config.smoothingRadius <= 0) {
    throw new RangeError('smoothingRadius must be positive');
  }
  if (![heightScale, blend, spring, maxVelocityDelta].every(Number.isFinite) ||
      heightScale < 0 || blend < 0 || blend > 1 || spring < 0 || maxVelocityDelta <= 0) {
    throw new RangeError('ocean boundary coefficients are invalid');
  }

  let minX = Infinity, maxX = -Infinity, meanHeight = 0;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, sample.points[i].x);
    maxX = Math.max(maxX, sample.points[i].x);
    meanHeight += sample.data[i * 4];
  }
  meanHeight /= count;
  const width = Math.max(1e-6, maxX - minX);
  const h = config.smoothingRadius;
  const band = h * 3;
  const dt = previousSample && Number.isFinite(previousSample.time)
    ? sample.time - previousSample.time
    : 0;
  const hasVelocity = dt > 1e-4 && dt < 0.5 && previousSample.data?.length >= count * 4;
  const positions = state.positions;
  const velocities = state.velocities;
  let appliedParticles = 0, maxWaveHeight = 0, meanWaveVelocity = 0;

  for (let i = 0; i < count; i++) {
    maxWaveHeight = Math.max(maxWaveHeight, Math.abs(sample.data[i * 4] - meanHeight));
    if (hasVelocity) {
      meanWaveVelocity += (sample.data[i * 4] - previousSample.data[i * 4]) / dt;
    }
  }
  if (hasVelocity) meanWaveVelocity /= count;

  for (let i = 0; i < state.count; i++) {
    const k = i * 2;
    const x = positions[k], y = positions[k + 1];
    const u = clamp((x - minX) / width, 0, 1);
    const probe = Math.min(count - 1, Math.round(u * (count - 1)));
    const sampleIndex = probe * 4;
    const targetY = baseSurfaceY + (sample.data[sampleIndex] - meanHeight) * heightScale;
    const error = targetY - y;
    const distance = Math.abs(error);
    if (distance >= band) continue;
    const weight = 1 - distance / band;
    const currentVx = velocities[k], currentVy = velocities[k + 1];
    const targetVy = hasVelocity
      ? clamp((sample.data[sampleIndex] - previousSample.data[sampleIndex]) / dt * heightScale, -3, 3)
      : 0;
    const targetVx = hasVelocity
      ? clamp((sample.data[sampleIndex + 1] - previousSample.data[sampleIndex + 1]) / dt, -3, 3)
      : 0;
    const correctionY = clamp(error * spring + targetVy - currentVy, -maxVelocityDelta, maxVelocityDelta);
    const correctionX = clamp(targetVx - currentVx, -maxVelocityDelta, maxVelocityDelta);
    velocities[k] += correctionX * blend * weight * 0.35;
    velocities[k + 1] += correctionY * blend * weight;
    appliedParticles++;
  }

  return Object.freeze({
    appliedParticles,
    meanWaveHeight: meanHeight,
    maxWaveHeight,
    meanWaveVelocity: hasVelocity ? meanWaveVelocity : 0,
    sampleTime: sample.time,
  });
}
