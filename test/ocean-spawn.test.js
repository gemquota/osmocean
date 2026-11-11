import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleOceanSpawn } from '../src/ecology/aquatic-physics.js';

function sequence(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test('ocean spawn sampler keeps a nursery fraction near the starting reef', () => {
  const spawn = sampleOceanSpawn(sequence([0.1, 0.25, 0.5]), 1800, 140, 0.35);
  assert.ok(Math.abs(spawn.radius - 70) < 1e-9);
  assert.equal(spawn.range, 140);
});

test('ocean spawn sampler distributes pelagic births across the full world radius', () => {
  const spawn = sampleOceanSpawn(sequence([0.99, 0.81, 0.25]), 1800, 140, 0.35);
  assert.ok(Math.abs(spawn.radius - 1620) < 1e-9);
  assert.equal(spawn.range, 1800);
  assert.ok(Math.abs(Math.hypot(spawn.x, spawn.z) - spawn.radius) < 1e-9);
});

test('ocean spawn sampler rejects invalid world bounds and nursery fractions', () => {
  assert.throws(() => sampleOceanSpawn(Math.random, 0), /valid radius/);
  assert.throws(() => sampleOceanSpawn(Math.random, 100, 20, 1.1), /valid radius/);
});
