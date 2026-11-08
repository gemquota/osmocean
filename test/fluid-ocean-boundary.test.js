import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOceanSurfaceBoundary } from '../src/adapters/fluid-ocean-boundary.js';

const config = { smoothingRadius: 0.5 };
const points = [{ x: -1, z: 0 }, { x: 1, z: 0 }];
const makeState = (particles) => ({
  count: particles.length,
  positions: new Float32Array(particles.flatMap(p => [p.x, p.y])),
  velocities: new Float32Array(particles.flatMap(p => [p.vx ?? 0, p.vy ?? 0])),
});
const sample = (heights, time = 1, dx = [0, 0]) => ({
  count: 2,
  time,
  points,
  data: new Float32Array([heights[0], dx[0], 0, 0, heights[1], dx[1], 0, 0]),
});

test('ocean crest drives local SPH surface particles upward', () => {
  const state = makeState([{ x: 0.9, y: 2, vy: 0 }]);
  const result = applyOceanSurfaceBoundary({
    state, config, sample: sample([0, 0.4]), baseSurfaceY: 2,
    heightScale: 1, blend: 1, spring: 2,
  });
  assert.ok(state.velocities[1] > 0);
  assert.equal(result.appliedParticles, 1);
});

test('ocean trough drives local SPH surface particles downward', () => {
  const state = makeState([{ x: 0.9, y: 2, vy: 0 }]);
  applyOceanSurfaceBoundary({
    state, config, sample: sample([0, -0.4]), baseSurfaceY: 2,
    heightScale: 1, blend: 1, spring: 2,
  });
  assert.ok(state.velocities[1] < 0);
});

test('particles far below the free surface are not directly forced', () => {
  const state = makeState([{ x: 0, y: -1, vy: 0 }]);
  const result = applyOceanSurfaceBoundary({
    state, config, sample: sample([0, 0.4]), baseSurfaceY: 2,
  });
  assert.equal(result.appliedParticles, 0);
  assert.equal(state.velocities[1], 0);
});

test('successive water-query displacements inject bounded horizontal velocity', () => {
  const state = makeState([{ x: 0.9, y: 2, vx: 0 }]);
  const result = applyOceanSurfaceBoundary({
    state, config, sample: sample([0, 0], 1.1, [0, 0.2]),
    previousSample: sample([0, 0], 1, [0, 0]),
    baseSurfaceY: 2, blend: 1,
  });
  assert.ok(state.velocities[0] > 0);
  assert.ok(result.meanWaveVelocity === 0);
});

test('the boundary forcing remains bounded for large wave displacement', () => {
  const state = makeState([{ x: 0.9, y: 2, vx: 0, vy: 0 }]);
  applyOceanSurfaceBoundary({
    state, config, sample: sample([0, 100]), baseSurfaceY: 2,
    heightScale: 10, blend: 1, maxVelocityDelta: 0.5,
  });
  assert.ok(Math.abs(state.velocities[1]) <= 0.5 + 1e-9);
});
