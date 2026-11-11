import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAquaticAcceleration, constrainFishDepth } from '../src/ecology/aquatic-physics.js';

test('quadratic drag accelerates a fish toward the local water velocity', () => {
  const a = calculateAquaticAcceleration({
    velocity: { x: 4, y: 0, z: 0 }, waterVelocity: { x: 1, y: 0, z: 0 },
    positionY: -10, surfaceY: 0, preferredDepth: 10
  });
  assert.ok(a.x < 0);
  assert.ok(Math.abs(a.z) < 1e-12);
});

test('buoyancy is positive for a fish less dense than seawater', () => {
  const a = calculateAquaticAcceleration({
    velocity: { x: 0, y: 0, z: 0 }, waterVelocity: { x: 0, y: 0, z: 0 },
    positionY: -10, surfaceY: 0, preferredDepth: 10, bodyDensity: 1015
  });
  assert.ok(a.y > 0);
});

test('depth regulation returns fish toward its preferred depth', () => {
  const a = calculateAquaticAcceleration({
    velocity: { x: 0, y: 0, z: 0 }, waterVelocity: { x: 0, y: 0, z: 0 },
    positionY: -4, surfaceY: 0, preferredDepth: 14
  });
  assert.ok(a.y < 0);
});

test('fish are constrained to the submerged depth band without bouncing violently', () => {
  const shallowPosition = { x: 0, y: 2, z: 0 }, shallowVelocity = { x: 0, y: 3, z: 0 };
  constrainFishDepth(shallowPosition, shallowVelocity, 0, 3, 26);
  assert.equal(shallowPosition.y, -3);
  assert.ok(shallowVelocity.y < 0 && Math.abs(shallowVelocity.y) < 1);
  const deepPosition = { x: 0, y: -40, z: 0 }, deepVelocity = { x: 0, y: -4, z: 0 };
  constrainFishDepth(deepPosition, deepVelocity, 0, 3, 26);
  assert.equal(deepPosition.y, -26);
  assert.ok(deepVelocity.y > 0 && Math.abs(deepVelocity.y) < 1);
});

test('fish body clearance keeps the entire model below the water surface', () => {
  const position = { x: 0, y: 2, z: 0 }, velocity = { x: 0, y: 3, z: 0 };
  constrainFishDepth(position, velocity, 0, 3, 26, 1.4);
  assert.equal(position.y, -4.4);
  assert.ok(position.y + 1.4 <= -3);
});

test('fish body clearance preserves the deep boundary', () => {
  const position = { x: 0, y: -40, z: 0 }, velocity = { x: 0, y: -4, z: 0 };
  constrainFishDepth(position, velocity, 0, 3, 26, 1.4);
  assert.equal(position.y, -24.6);
  assert.ok(position.y - 1.4 >= -26);
});
