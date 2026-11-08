import test from 'node:test';
import assert from 'node:assert/strict';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const submergedFraction = (surfaceY, sampleY, cellHeight) =>
  clamp((surfaceY - sampleY) / cellHeight + 0.5, 0, 1);

test('buoyancy sample fraction is zero above the water', () => {
  assert.equal(submergedFraction(0, 2, 1), 0);
});
test('buoyancy sample fraction is one below the water cell', () => {
  assert.equal(submergedFraction(1, -1, 1), 1);
});
test('buoyancy sample fraction is continuous through the interface', () => {
  assert.equal(submergedFraction(0, 0, 1), 0.5);
});
test('submerged fraction remains bounded for degenerate and extreme inputs', () => {
  assert.equal(submergedFraction(100, -100, 0.01), 1);
  assert.equal(submergedFraction(-100, 100, 0.01), 0);
});
