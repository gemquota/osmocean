import test from "node:test";
import assert from "node:assert/strict";
import { createSeededRandom } from "../src/core/seeded-random.js";

test("same seed reproduces the same sequence", () => {
  const a = createSeededRandom("reef-17"), b = createSeededRandom("reef-17");
  assert.deepEqual(Array.from({length:100},()=>a.nextUint32()), Array.from({length:100},()=>b.nextUint32()));
});

test("forked streams are repeatable and label-separated", () => {
  const a = createSeededRandom(42), b = createSeededRandom(42);
  assert.equal(a.fork("fish-1").nextUint32(), b.fork("fish-1").nextUint32());
  assert.notEqual(createSeededRandom(42).fork("fish-1").nextUint32(), createSeededRandom(42).fork("fish-2").nextUint32());
});

test("floating output is in [0, 1)", () => {
  const rng = createSeededRandom(9);
  for (let i=0;i<1000;i++) assert.ok(rng.next() >= 0 && rng.next() < 1);
});
