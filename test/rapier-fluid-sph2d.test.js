import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSphBoundaryLoad } from '../src/adapters/rapier-fluid-sph2d.js';

const config = { obstacleSize: { x: 2, y: 2 }, smoothingRadius: 0.5, targetDensity: 10, pressureMultiplier: 100 };
const state = (particles) => ({
  count: particles.length,
  positions: new Float32Array(particles.flatMap(p => [p.x, p.y])),
  velocities: new Float32Array(particles.flatMap(p => [p.vx ?? 0, p.vy ?? 0])),
  densities: new Float32Array(particles.flatMap(p => [p.density ?? 10, 0])),
});

test('fluid pressure on the left face pushes a Rapier body to the right', () => {
  const result = estimateSphBoundaryLoad({
    state: state([{ x: -1.1, y: 0, density: 20 }]),
    config, bodyPosition: { x: 0, y: 0 }, pressureScale: 0.01, dragScale: 0,
  });
  assert.ok(result.pressureForce.x > 0);
  assert.equal(result.contactParticles, 1);
});

test('fluid pressure on the right face pushes a Rapier body to the left', () => {
  const result = estimateSphBoundaryLoad({
    state: state([{ x: 1.1, y: 0, density: 20 }]),
    config, bodyPosition: { x: 0, y: 0 }, pressureScale: 0.01, dragScale: 0,
  });
  assert.ok(result.pressureForce.x < 0);
});

test('viscous loading follows fluid velocity relative to the body', () => {
  const result = estimateSphBoundaryLoad({
    state: state([{ x: 0, y: 1.1, vx: 2, density: 10 }]),
    config, bodyPosition: { x: 0, y: 0 }, bodyVelocity: { x: 1, y: 0 }, pressureScale: 0, dragScale: 1,
  });
  assert.ok(result.dragForce.x > 0);
});

test('particles outside the interaction band contribute no load', () => {
  const result = estimateSphBoundaryLoad({
    state: state([{ x: 0, y: 2, density: 100, vx: 50 }]),
    config, bodyPosition: { x: 0, y: 0 },
  });
  assert.equal(result.contactParticles, 0);
  assert.deepEqual(result.force, { x: 0, y: 0 });
});

test('resultant load is bounded', () => {
  const result = estimateSphBoundaryLoad({
    state: state(Array.from({ length: 30 }, (_, i) => ({ x: -1.01, y: i / 100, density: 10000, vx: -100 }))),
    config, bodyPosition: { x: 0, y: 0 }, maxForce: 5,
  });
  assert.ok(Math.hypot(result.force.x, result.force.y) <= 5 + 1e-9);
});
