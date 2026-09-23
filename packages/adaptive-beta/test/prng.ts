/**
 * A tiny deterministic PRNG (mulberry32) plus Box-Muller, used only by
 * tests. SPEC.md §16: "All stochastic tests MUST store random seeds" —
 * every test using this records its seed literally in the test source.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussianSampler(seed: number, mean: number, stdDev: number): () => number {
  const rng = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return mean + stdDev * value;
    }
    let u1 = 0;
    let u2 = 0;
    do {
      u1 = rng();
      u2 = rng();
    } while (u1 <= Number.EPSILON);
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    spare = radius * Math.sin(angle);
    return mean + stdDev * radius * Math.cos(angle);
  };
}
