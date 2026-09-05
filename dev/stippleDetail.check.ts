import assert from "node:assert/strict";
import {
  computeStippleNeighborAngles,
  stippleDetailAreaWeight,
  stippleDetailId,
  stippleShouldSplit,
  writeStippleChildren,
  type StippleDetailDepth,
} from "../src/globe/stippleDetail";

// Match the existing earthStippleGlobe Fibonacci root formula and Float32 storage.
function fibonacciDirections(count: number): Float32Array {
  const directions = new Float32Array(count * 3);
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - i / (count - 1) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    directions[i * 3] = Math.cos(i * increment) * radius;
    directions[i * 3 + 1] = y;
    directions[i * 3 + 2] = Math.sin(i * increment) * radius;
  }
  return directions;
}

function bruteForceAngles(directions: Float32Array, indices: number[]): number[] {
  const normalized = Float64Array.from(directions);
  for (let i = 0; i < normalized.length; i += 3) {
    const length = Math.hypot(normalized[i], normalized[i + 1], normalized[i + 2]);
    for (let axis = 0; axis < 3; axis++) normalized[i + axis] /= length;
  }
  return indices.map((index) => {
    const i = index * 3;
    let best = Infinity;
    for (let j = 0; j < normalized.length; j += 3) {
      if (j === i) continue;
      const dx = normalized[i] - normalized[j];
      const dy = normalized[i + 1] - normalized[j + 1];
      const dz = normalized[i + 2] - normalized[j + 2];
      best = Math.min(best, dx * dx + dy * dy + dz * dz);
    }
    return 2 * Math.asin(Math.min(1, Math.sqrt(best) / 2));
  });
}

function verifyNeighbors(directions: Float32Array, indices: number[], angles = computeStippleNeighborAngles(directions)): void {
  const expected = bruteForceAngles(directions, indices);
  indices.forEach((index, i) => {
    assert.ok(Math.abs(angles[index] - expected[i]) <= Math.max(1e-9, expected[i] * 1e-7),
      `root ${index}: ${angles[index]} differs from brute-force ${expected[i]}`);
  });
}

for (const count of [2, 9, 256]) {
  verifyNeighbors(fibonacciDirections(count), Array.from({ length: count }, (_, i) => i));
}
const sparse = new Float32Array(513 * 3);
for (let i = 0; i < 512; i++) sparse[i * 3 + 1] = 1;
sparse[512 * 3 + 1] = -1;
verifyNeighbors(sparse, [0, 255, 511, 512]); // Duplicate roots and an isolated opposite pole.
verifyNeighbors(new Float32Array([2, 0, 0, 0, 3, 0, 0, 0, 4]), [0, 1, 2]);
assert.throws(() => computeStippleNeighborAngles(new Float32Array()), RangeError);
assert.throws(() => computeStippleNeighborAngles(new Float32Array([0, 0, 0, 0, 1, 0])), RangeError);
assert.throws(() => computeStippleNeighborAngles(new Float32Array([NaN, 0, 0, 0, 1, 0])), RangeError);
assert.throws(() => computeStippleNeighborAngles(new Float32Array(7)), RangeError);

const directions = fibonacciDirections(82_000);
const original = directions.slice();
const start = performance.now();
const angles = computeStippleNeighborAngles(directions);
const spacingMilliseconds = performance.now() - start;
assert.equal(angles.length, 82_000);
const subset = [0, 1, 2, 3, 81_996, 81_997, 81_998, 81_999];
let seed = 43;
for (let i = 0; i < 128; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  subset.push(seed % 82_000);
}
verifyNeighbors(directions, subset, angles); // Each selected root compares with ALL 81,999 others.

const family = new Float64Array(60);
const repeated = new Float64Array(12);
let checkedChildren = 0;
for (let root = 0; root < angles.length; root++) {
  const i = root * 3;
  const rootLength = Math.hypot(directions[i], directions[i + 1], directions[i + 2]);
  const nx = directions[i] / rootLength;
  const ny = directions[i + 1] / rootLength;
  const nz = directions[i + 2] / rootLength;
  assert.ok(angles[root] > 0 && Number.isFinite(angles[root]));
  for (let parent = -1; parent < 4; parent++) {
    const parentDepth = parent === -1 ? 0 : 1;
    const parentPath = Math.max(0, parent);
    const offset = (parent + 1) * 12;
    writeStippleChildren(directions, root, angles[root], parentDepth, parentPath, family, offset);
    writeStippleChildren(directions, root, angles[root], parentDepth, parentPath, repeated);
    const bound = Math.SQRT2 * 0.8 * (parentDepth === 0 ? 1 / 4 : 3 / 8) * angles[root];
    for (let component = 0; component < 12; component++) {
      assert.equal(family[offset + component], repeated[component], "stable after regeneration");
    }
    for (let child = 0; child < 4; child++) {
      const j = offset + child * 3;
      const x = family[j];
      const y = family[j + 1];
      const z = family[j + 2];
      assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-14, "child on unit sphere");
      const angle = Math.atan2(Math.hypot(ny * z - nz * y, nz * x - nx * z, nx * y - ny * x),
        nx * x + ny * y + nz * z);
      assert.ok(angle <= bound + 1e-14, "child inside root patch");
      checkedChildren++;
    }
  }
  for (let a = 0; a < 20; a++) {
    for (let b = a + 1; b < 20; b++) {
      const dx = family[a * 3] - family[b * 3];
      const dy = family[a * 3 + 1] - family[b * 3 + 1];
      const dz = family[a * 3 + 2] - family[b * 3 + 2];
      assert.ok(dx * dx + dy * dy + dz * dz > 1e-16, "twenty distinct child directions");
    }
  }
}
assert.equal(checkedChildren, 1_640_000);
assert.deepEqual(directions, original, "existing 82k Float32 roots unchanged");

const north = new Float32Array([0, 1, 0]);
const golden = new Float64Array(12);
writeStippleChildren(north, 0, 0.1, 0, 0, golden);
const expectedSeed43 = [0.028232477320904167, 0.9996002398401119, -0.0015125263354268735];
expectedSeed43.forEach((value, axis) => assert.ok(Math.abs(golden[axis] - value) < 1e-15, "seed-43 frame"));
const target = new Float32Array(20).fill(-999);
writeStippleChildren(north, 0, 0.1, 0, 0, target, 4);
assert.deepEqual(target.slice(0, 4), new Float32Array(4).fill(-999));
assert.deepEqual(target.slice(16), new Float32Array(4).fill(-999));
assert.deepEqual(target.slice(4, 16), Float32Array.from(golden));
assert.throws(() => writeStippleChildren(north, 0, 0.1, 0, 0, target, 9), RangeError);
assert.throws(() => writeStippleChildren(north, 0, 0, 0, 0, target), RangeError);
assert.throws(() => writeStippleChildren(north, 0, 0.1, 1, 4, target), RangeError);
assert.throws(() => writeStippleChildren(directions, 0, angles[0], 0, 0, directions.subarray(0, 12)), RangeError);

for (const root of [0, 1, 43, 81_999]) {
  const ids: number[] = [];
  for (const depth of [0, 1, 2] as const) {
    for (let path = 0; path < 4 ** depth; path++) ids.push(stippleDetailId(root, depth, path));
  }
  assert.deepEqual(ids, Array.from({ length: 21 }, (_, i) => root * 21 + i));
}
assert.equal(stippleDetailId(81_999, 2, 15), 1_721_999);
assert.throws(() => stippleDetailId(0, 1, 4), RangeError);
assert.throws(() => stippleDetailId(-1, 0, 0), RangeError);
assert.throws(() => stippleDetailId(Number.MAX_SAFE_INTEGER, 0, 0), RangeError);

let split = false;
const states = [4.9, 5.01, 4.99, 4.3, 4.24, 4.9, 5.01].map((diameter) =>
  split = stippleShouldSplit(split, diameter));
assert.deepEqual(states, [false, true, true, true, false, false, true]);
assert.equal(stippleShouldSplit(false, 5), true);
assert.equal(stippleShouldSplit(true, 4.25), true);
assert.equal(stippleShouldSplit(true, 4.25 - 1e-9), false);
assert.throws(() => stippleShouldSplit(false, NaN), RangeError);
assert.throws(() => stippleShouldSplit(false, -1), RangeError);
for (const depth of [0, 1] as const) {
  const parentArea = stippleDetailAreaWeight(depth);
  const childArea = stippleDetailAreaWeight((depth + 1) as StippleDetailDepth);
  for (const fade of [0, 0.25, 0.5, 0.75, 1, 0.35, 0.1, 0]) {
    assert.ok(Math.abs((1 - fade) * parentArea + 4 * fade * childArea - parentArea) < 1e-15,
      "split and reversed fade conserve alpha-weighted area");
  }
}
assert.equal(stippleDetailAreaWeight(1) + 12 * stippleDetailAreaWeight(2), 1,
  "mixed-depth leaves conserve root area");
console.info("stipple detail check passed", {
  roots: angles.length, bruteForceRoots: subset.length, checkedChildren,
  spacingMilliseconds: Math.round(spacingMilliseconds),
});
