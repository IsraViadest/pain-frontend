import assert from "node:assert/strict";
import { boxBlurField } from "../src/globe/field-box-blur";

// Independent reference: preserve the original two-dimensional traversal and divisor.
function naive(src: Float32Array, width: number, height: number, radius: number, wrapX: boolean) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const iy = y + dy;
        if (iy < 0 || iy >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          let ix = x + dx;
          if (wrapX) ix = ((ix % width) + width) % width;
          else if (ix < 0 || ix >= width) continue;
          sum += src[iy * width + ix]!;
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

let state = 43;
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x100000000;
}

let cases = 0;
let samples = 0;
let floatDifferences = 0;
let maxAbsoluteError = 0;
let quantizationComparisons = 0;

function compare(src: Float32Array, width: number, height: number, radius: number, wrapX: boolean) {
  const before = src.slice();
  const actual = boxBlurField(src, width, height, radius, wrapX);
  const expected = naive(src, width, height, radius, wrapX);
  assert.deepEqual(src, before, "input mutated");
  assert.notEqual(actual, src, "output aliases input");
  const actualMax = actual.reduce((a, b) => Math.max(a, b), 0);
  const expectedMax = expected.reduce((a, b) => Math.max(a, b), 0);
  for (let i = 0; i < actual.length; i++) {
    const error = Math.abs(actual[i]! - expected[i]!);
    maxAbsoluteError = Math.max(maxAbsoluteError, error);
    if (error !== 0) floatDifferences++;
    assert.ok(error <= 2 ** -23, `float mismatch: ${width}x${height}, r=${radius}, wrap=${wrapX}, i=${i}`);
    assert.equal(Math.round(actual[i]! * 255), Math.round(expected[i]! * 255), "raw byte mismatch");
    assert.equal(
      actualMax > 0 ? Math.round(actual[i]! / actualMax * 255) : 0,
      expectedMax > 0 ? Math.round(expected[i]! / expectedMax * 255) : 0,
      "max-normalized byte mismatch",
    );
    quantizationComparisons += 2;
  }
  samples += actual.length;
  cases++;
  return actual;
}

for (const [width, height] of [[1, 1], [1, 7], [7, 1], [2, 3], [3, 2], [4, 4], [9, 6], [17, 13]]) {
  const n = width! * height!;
  const fields = [
    new Float32Array(n),
    new Float32Array(n).fill(0.375),
    new Float32Array(n).fill(1),
    Float32Array.from({ length: n }, random),
    Float32Array.from({ length: n }, () => random() * 2 ** -Math.floor(random() * 40)),
  ];
  for (const index of new Set([0, width! - 1, n - width!, n - 1, Math.floor(n / 2)])) {
    const impulse = new Float32Array(n);
    impulse[index] = 1;
    fields.push(impulse);
  }
  for (const wrapX of [false, true]) {
    for (const radius of new Set([0, 1, 3, 5, width! + 3, height! + 3])) {
      for (const field of fields) compare(field, width!, height!, radius, wrapX);
    }
    // Two passes exercise quantization after intermediate Float32 rounding.
    const noise = fields[3]!;
    for (const [first, second] of [[4, 1], [3, 1], [5, 3]]) {
      const actualFirst = compare(noise, width!, height!, first!, wrapX);
      const expectedFirst = naive(noise, width!, height!, first!, wrapX);
      const actual = boxBlurField(actualFirst, width!, height!, second!, wrapX);
      const expected = naive(expectedFirst, width!, height!, second!, wrapX);
      assert.deepEqual(actual, expected, "two-pass noise differs");
    }
  }
}

// A nonperiodic blur must not leak a west-edge impulse across the longitude seam.
const seam = new Float32Array(15);
seam[5] = 1;
assert.equal(boxBlurField(seam, 5, 3, 1, false)[9], 0);
assert.ok(boxBlurField(seam, 5, 3, 1, true)[9]! > 0);
assert.deepEqual(boxBlurField(seam, 5, 3, 0, true), seam);

console.log(JSON.stringify({ passed: true, seed: 43, cases, samples, floatDifferences, maxAbsoluteError, quantizationComparisons }));
