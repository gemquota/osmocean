import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_FRAME,
  SI_UNITS,
  assertFiniteNumber,
  assertPositiveFinite,
  assertNonNegativeFinite
} from "../src/core/units.js";

test("world frame is explicit, right-handed and immutable", () => {
  assert.equal(WORLD_FRAME.handedness, "right");
  assert.deepEqual(WORLD_FRAME.right, { x: 1, y: 0, z: 0 });
  assert.deepEqual(WORLD_FRAME.up, { x: 0, y: 1, z: 0 });
  assert.deepEqual(WORLD_FRAME.towardViewer, { x: 0, y: 0, z: 1 });
  assert.equal(Object.isFrozen(WORLD_FRAME), true);
  assert.equal(Object.isFrozen(WORLD_FRAME.up), true);
});

test("kernel physical quantities declare SI units", () => {
  assert.equal(SI_UNITS.distance, "m");
  assert.equal(SI_UNITS.mass, "kg");
  assert.equal(SI_UNITS.time, "s");
  assert.equal(SI_UNITS.angle, "rad");
  assert.equal(SI_UNITS.force, "N");
  assert.equal(SI_UNITS.torque, "N*m");
  assert.equal(SI_UNITS.density, "kg/m^3");
});

test("numeric contract helpers accept valid values", () => {
  assert.equal(assertFiniteNumber(0), 0);
  assert.equal(assertPositiveFinite(0.1), 0.1);
  assert.equal(assertNonNegativeFinite(0), 0);
});

test("numeric contract helpers reject invalid values", () => {
  assert.throws(() => assertFiniteNumber(Infinity), TypeError);
  assert.throws(() => assertPositiveFinite(0), RangeError);
  assert.throws(() => assertPositiveFinite(-1), RangeError);
  assert.throws(() => assertNonNegativeFinite(-0.01), RangeError);
});
