/**
 * The one seeded pseudo-random generator these views use.
 *
 * Extracted from graphs.ts when the legend needed the same thing: a random pick that a screenshot
 * can be taken of. Two copies of a PRNG are two sequences that look alike and are not, which is
 * exactly the kind of difference nobody notices until a capture stops reproducing.
 */

/**
 * mulberry32. Deterministic from its seed, so a random network or a random pick is the same one
 * on every reload and a screenshot of it means something.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
