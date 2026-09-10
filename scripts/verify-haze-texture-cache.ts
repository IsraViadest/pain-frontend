/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// Run: node --import tsx scripts/verify-haze-texture-cache.ts
import assert from "node:assert/strict";
import * as THREE from "three";
import type { PainPoint } from "../src/types/api";
import { HazeTextureCache } from "../src/globe/hazeTextureCache";
import {
  CO2_HAZE_TUNE_DEFAULTS, createCo2HazeTexture, filterCo2HazePoints,
} from "../src/globe/co2HazeField";
import {
  TEMPERATURE_HAZE_TUNE_DEFAULTS, createTemperatureHazeTexture, filterTemperatureHazePoints,
} from "../src/globe/temperatureHazeField";

const points: PainPoint[] = [
  { id: 1, lat: 43, lng: 16, intensity: 0.75, category: "Temperature", uiLayer: "envpain", createdAt: "" },
  { id: 2, lat: -20, lng: 40, intensity: 0.5, category: "CO2", uiLayer: "envpain", createdAt: "" },
];
const cache = new HazeTextureCache();
const tune = { ...CO2_HAZE_TUNE_DEFAULTS };
const records: { texture: THREE.DataTexture; disposals: number }[] = [];
const build = () => {
  assert.ok(records.every((record) => record.disposals === 1), "Only one live generation per cache");
  const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2, THREE.RGBAFormat);
  const record = { texture, disposals: 0 };
  texture.addEventListener("dispose", () => record.disposals++);
  records.push(record);
  return texture;
};
const get = (nextPoints = points, nextTune = tune) =>
  cache.getTexture(nextPoints, nextTune, "smooth", build)!;
const first = get();
const signatureBytes = points.length * 4 * Float64Array.BYTES_PER_ELEMENT;
assert.equal(cache.additionalStorageBytes(first), signatureBytes);
assert.equal(get(points.map((point) => ({ ...point, id: point.id + 10, country: "changed metadata" }))), first);
assert.equal(cache.getTexture([], tune, "smooth", build), null);
assert.equal(records[0].disposals, 0);
assert.equal(cache.additionalStorageBytes(null), signatureBytes + first.image.data.byteLength * 2);
assert.equal(get(), first, "Empty input must preserve the most recent field for re-entry");

for (const scalar of ["lat", "lng", "intensity"] as const) {
  const before = records.at(-1)!.texture;
  points[0][scalar]! += scalar === "intensity" ? Number.EPSILON : 0.001;
  assert.notEqual(get(), before, "In-place " + scalar + " mutation must invalidate exact scalar input");
}
const beforeReverse = get();
assert.notEqual(get([...points].reverse()), beforeReverse, "Stamp order is part of the input");
const beforeShorter = records.at(-1)!.texture;
assert.notEqual(get(points.slice(0, 1)), beforeShorter);
for (const lat of [null, 0, NaN, Infinity, -Infinity, -0]) {
  const before = records.at(-1)!.texture;
  const next = [{ ...points[0], lat }];
  assert.notEqual(get(next), before, "Null and numeric coordinates must stay distinct");
  assert.equal(get(next.map((point) => ({ ...point }))), records.at(-1)!.texture);
}
const missingLongitude = [{ ...points[0], lat: 0, lng: null }];
assert.notEqual(get(missingLongitude), get([{ ...missingLongitude[0], lng: 0 }]));
get();
for (const key of Object.keys(tune) as (keyof typeof tune)[]) {
  const before = records.at(-1)!.texture;
  if (key === "normMode") tune[key] = "log";
  else tune[key] += 1;
  assert.notEqual(get(), before, "Full tune key must include " + key);
}
const beforePattern = get();
const patterned = cache.getTexture(points, tune, "grain", build);
assert.notEqual(patterned, beforePattern);
assert.equal(cache.getTexture(points.map((point) => ({ ...point })), { ...tune }, "grain", build), patterned);
assert.equal(cache.getTexture([], tune, "hex", build), null);
assert.notEqual(cache.getTexture(points, tune, "hex", build), patterned,
  "A pattern change while inactive must rebuild on re-entry");
const beforeHiddenTune = get();
assert.equal(cache.getTexture([], tune, "smooth", build), null);
tune.hazeColor++;
assert.notEqual(get(), beforeHiddenTune, "A tune change while inactive must rebuild on re-entry");
const beforeHiddenData = get();
assert.equal(cache.getTexture([], tune, "smooth", build), null);
points[0].intensity += Number.EPSILON;
assert.notEqual(get(), beforeHiddenData, "A data change while inactive must rebuild on re-entry");
assert.throws(() => cache.getTexture(points, tune, "grain", () => { throw Error("allocation failed"); }),
  /allocation failed/);
assert.equal(cache.additionalStorageBytes(null), 0, "Failed replacement cannot keep the disposed entry");
get();
cache.dispose(); cache.dispose();
assert.ok(records.every((record) => record.disposals === 1), "Every generation is disposed exactly once");
assert.equal(cache.additionalStorageBytes(null), 0);

// Real builders retain exact RGBA output and texture settings for each separately filtered field.
const fieldRows: object[] = [];
for (const [filter, fieldTune, create] of [
  [filterTemperatureHazePoints, TEMPERATURE_HAZE_TUNE_DEFAULTS,
    (p: PainPoint[]) => createTemperatureHazeTexture(p, TEMPERATURE_HAZE_TUNE_DEFAULTS, "fine-grain")],
  [filterCo2HazePoints, CO2_HAZE_TUNE_DEFAULTS,
    (p: PainPoint[]) => createCo2HazeTexture(p, CO2_HAZE_TUNE_DEFAULTS, "fine-grain")],
] as const) {
  const fieldCache = new HazeTextureCache();
  const filtered = filter(points);
  assert.equal(filtered.length, 1);
  const buildField = () => create(filtered);
  const texture = fieldCache.getTexture(filtered, fieldTune, "fine-grain", buildField)!;
  const expected = buildField();
  assert.deepEqual(texture.image.data, expected.image.data);
  for (const setting of ["format", "type", "flipY", "wrapS", "wrapT", "minFilter", "magFilter",
    "colorSpace", "generateMipmaps"] as const) assert.equal(texture[setting], expected[setting]);
  const version = texture.version;
  assert.equal(fieldCache.getTexture(filter(points.map((point) => ({ ...point }))),
    { ...fieldTune }, "fine-grain", buildField), texture);
  assert.equal(texture.version, version, "Reuse must not trigger another texture upload");
  fieldRows.push({ category: filtered[0].category, rgbaBytes: texture.image.data.byteLength,
    activeAdditionalBytes: fieldCache.additionalStorageBytes(texture),
    inactiveAdditionalBytes: fieldCache.additionalStorageBytes(null) });
  expected.dispose(); fieldCache.dispose();
}
console.log(JSON.stringify({ passed: true, generations: records.length, fieldRows }));
