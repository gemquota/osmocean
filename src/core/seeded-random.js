/** Small deterministic 32-bit PRNG. Suitable for reproducible simulation variation, not cryptography. */
function hashSeed(seed) {
  const input = String(seed);
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed = 0) {
  let state = hashSeed(seed);
  return Object.freeze({
    nextUint32() {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    next() {
      return this.nextUint32() / 0x100000000;
    },
    fork(label) {
      return createSeededRandom(`${state}:${String(label)}`);
    }
  });
}
