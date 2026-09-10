import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCountryGeometries,
  findCountryInGeometries,
  type CountryGeometry,
  type IndexedCountryGeometry,
} from "../src/globe/countryGeometry";
import { buildCountryDisplayGeometry } from "../src/globe/countryDisplayGeometry";

const key = (point: number[]): string => point.join(",");
const edgeKey = (a: number[], b: number[]): string =>
  key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`;
const feature = (id: string, geometry: CountryGeometry) => ({
  properties: { ISO_A3: id }, geometry,
});
const rings = (country: IndexedCountryGeometry): number[][][] =>
  country.geometry.type === "Polygon"
    ? country.geometry.coordinates : country.geometry.coordinates.flat();
const area = (ring: number[][]): number => ring.slice(1).reduce((sum, point, i) =>
  sum + ring[i][0] * point[1] - point[0] * ring[i][1], 0);

function freeze(value: unknown): void {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
}

function checkStructure(source: readonly IndexedCountryGeometry[],
  display: ReturnType<typeof buildCountryDisplayGeometry>): void {
  assert.deepEqual(display.countries.map((country) => country.key), source.map((country) => country.key));
  source.forEach((country, i) => {
    const result = display.countries[i];
    assert.equal(result.geometry.type, country.geometry.type);
    assert.equal(result.polygons.length, country.polygons.length, "component count");
    assert.deepEqual(result.polygons.map((polygon) => polygon.rings.length),
      country.polygons.map((polygon) => polygon.rings.length), "hole count");
    rings(country).forEach((ring, j) => {
      const derived = rings(result)[j];
      assert.deepEqual(derived[0], derived[derived.length - 1], "closed ring");
      assert.equal(Math.sign(area(derived)), Math.sign(area(ring)), "ring orientation");
    });
  });
  for (const { source: original, display: derived } of display.displacementPairs) {
    assert.ok(Math.hypot(original[0] - derived[0], original[1] - derived[1]) <= 0.005 + 1e-12);
  }

  const occurrences = new Map<string, number>();
  for (const country of display.countries) {
    for (const ring of rings(country)) {
      ring.slice(1).forEach((point, i) => {
        if (key(ring[i]) === key(point)) return; // Four bundled source edges have zero length.
        const id = edgeKey(ring[i], point);
        occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
      });
    }
  }
  const lineEdges = new Set<string>();
  for (const [lines, owners] of [[display.coastLines, 1], [display.borderLines, 2]] as const) {
    for (const line of lines) {
      line.slice(1).forEach((point, i) => {
        const id = edgeKey(line[i], point);
        assert.equal(occurrences.get(id), owners, "line and fill share exact coordinates");
        assert.ok(!lineEdges.has(id), "boundary rendered once");
        lineEdges.add(id);
      });
    }
  }
  assert.equal(lineEdges.size, occurrences.size,
    `every ring edge has a display line: ${[...occurrences.keys()].filter((id) => !lineEdges.has(id)).join("; ")}`);
}

// Compare geographic intersections using a grid solely to keep this check small and fast.
function crossings(lines: number[][][]): Set<string> {
  const cells = new Map<string, number[]>();
  const segments: Array<[number[], number[]]> = [];
  const result = new Set<string>();
  const cross = (a: number[], b: number[], p: number[]): number =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (const line of lines) {
    line.slice(1).forEach((b, i) => {
      const a = line[i];
      if (Math.abs(a[0] - b[0]) > 180) return;
      const checked = new Set<number>();
      for (let x = Math.floor(Math.min(a[0], b[0]) / 2); x <= Math.floor(Math.max(a[0], b[0]) / 2); x++) {
        for (let y = Math.floor(Math.min(a[1], b[1]) / 2); y <= Math.floor(Math.max(a[1], b[1]) / 2); y++) {
          const cellKey = `${x},${y}`;
          const cell = cells.get(cellKey) ?? [];
          for (const index of cell) {
            if (checked.has(index)) continue;
            checked.add(index);
            const [p, q] = segments[index];
            const one = cross(a, b, p);
            const two = cross(a, b, q);
            const three = cross(p, q, a);
            const four = cross(p, q, b);
            if (one * two < 0 && three * four < 0 &&
                Math.min(Math.abs(one), Math.abs(two), Math.abs(three), Math.abs(four)) > 1e-12) {
              const t = three / (three - four);
              result.add([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
                .map((value) => value.toFixed(8)).join(","));
            }
          }
          cell.push(segments.length);
          cells.set(cellKey, cell);
        }
      }
      segments.push([a, b]);
    });
  }
  return result;
}

const adjacent = buildCountryGeometries({ features: [
  feature("LFT", { type: "Polygon", coordinates: [
    [[0, 0], [2, 0], [2.2, 1], [2, 2], [0, 2], [0, 0]],
  ] }),
  feature("RGT", { type: "Polygon", coordinates: [
    [[2, 0], [4, 0], [4, 2], [2, 2], [2.2, 1], [2, 0]],
  ] }),
] });
freeze(adjacent);
const joined = buildCountryDisplayGeometry(adjacent, 0.005);
checkStructure(adjacent, joined);
assert.equal(joined.borderLines.length, 1);
assert.equal(joined.borderLines[0].length, 7, "one shared rounded interior corner");
assert.deepEqual(joined.borderLines[0][0], [2, 0], "coast-border junction pinned");
assert.deepEqual(joined.borderLines[0].at(-1), [2, 2]);
const shared = joined.borderLines[0].map(key);
const left = rings(joined.countries[0])[0].map(key);
const right = rings(joined.countries[1])[0].map(key);
assert.deepEqual(left.slice(left.indexOf(shared[0]), left.indexOf(shared[0]) + shared.length), shared);
assert.deepEqual(right.slice(right.indexOf(shared.at(-1)!), right.indexOf(shared.at(-1)!) + shared.length),
  shared.slice().reverse());
assert.equal(crossings([...joined.coastLines, ...joined.borderLines]).size, 0);
assert.equal(buildCountryDisplayGeometry(adjacent, 0).countries, adjacent, "zero uses canonical array");
assert.equal(buildCountryDisplayGeometry(adjacent, 0).displacementPairs.length, 0);
assert.throws(() => buildCountryDisplayGeometry(adjacent, -1), RangeError);
assert.throws(() => buildCountryDisplayGeometry(adjacent, NaN), RangeError);
assert.equal(buildCountryDisplayGeometry(adjacent, 2).stats.maxDeviationDegrees, 0.005);
const tighter = buildCountryDisplayGeometry(adjacent, 0.0001);
assert.ok(tighter.stats.maxActualDeviationDegrees <= 0.0001);

const junction = buildCountryGeometries({ features: [
  feature("ONE", { type: "Polygon", coordinates: [[[0, 0], [2, 0], [1, 1], [0, 0]]] }),
  feature("TWO", { type: "Polygon", coordinates: [[[2, 0], [2, 2], [1, 1], [2, 0]]] }),
  feature("THR", { type: "Polygon", coordinates: [[[2, 2], [0, 2], [0, 0], [1, 1], [2, 2]]] }),
] });
const meeting = buildCountryDisplayGeometry(junction, 0.005);
checkStructure(junction, meeting);
assert.equal(meeting.borderLines.length, 3);
for (const line of meeting.borderLines) {
  assert.ok(key(line[0]) === "1,1" || key(line.at(-1)!) === "1,1", "triple junction pinned");
}

const fixtures = buildCountryGeometries({ features: [
  feature("HOL", { type: "Polygon", coordinates: [
    [[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]],
    [[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]],
    [[-4.996, -4.996], [-4.996, -4.992], [-4.992, -4.992], [-4.992, -4.996], [-4.996, -4.996]],
  ] }),
  feature("ISL", { type: "MultiPolygon", coordinates: [
    [[[10, 0], [10.008, 0], [10.008, 1], [10, 1], [10, 0]]],
    [[[12, 0], [13, 0], [13, 1], [12, 1], [12, 0]]],
  ] }),
  feature("COR", { type: "Polygon", coordinates: [
    [[20, -1], [22, -1], [22, -0.004], [24, -0.004], [24, -1], [26, -1],
      [26, 1], [24, 1], [24, 0.004], [22, 0.004], [22, 1], [20, 1], [20, -1]],
  ] }),
  feature("DAT", { type: "Polygon", coordinates: [
    [[179, -10], [-179, -10], [-179, 10], [179, 10], [179, -10]],
  ] }),
  feature("POL", { type: "Polygon", coordinates: [
    [[-20, 86], [-10, 86], [-10, 89], [-20, 89], [-20, 86]],
  ] }),
] });
freeze(fixtures);
const safety = buildCountryDisplayGeometry(fixtures, 0.005);
checkStructure(fixtures, safety);
assert.deepEqual(rings(safety.countries[0])[2], rings(fixtures[0])[2], "tiny hole retained exactly");
assert.ok(rings(safety.countries[0])[0].some((point) => key(point) === "-5,-5"),
  "nearby hole pins outer corner");
assert.deepEqual(rings(safety.countries[1])[0], rings(fixtures[1])[0], "narrow island pinned");
for (const point of [[22, -0.004], [24, -0.004], [24, 0.004], [22, 0.004]]) {
  assert.ok(rings(safety.countries[2])[0].some((derived) => key(derived) === key(point)),
    "opposite corridor edge pins corner");
}
assert.deepEqual(safety.countries[3].geometry, fixtures[3].geometry, "dateline pinned");
assert.deepEqual(safety.countries[4].geometry, fixtures[4].geometry, "polar contour pinned");
for (const [lat, lng, expected] of [[0, 0, null], [-4.994, -4.994, null], [2, 2, "HOL"], [0.5, 10.004, "ISL"],
  [0.5, 12.5, "ISL"], [0, 23, "COR"], [0, 179.5, "DAT"], [88, -15, "POL"]] as const) {
  assert.equal(findCountryInGeometries(safety.countries, lat, lng), expected);
}
const beforeFixtureCrossings = crossings([
  ...buildCountryDisplayGeometry(fixtures, 0).coastLines,
]);
for (const crossing of crossings([...safety.coastLines, ...safety.borderLines])) {
  assert.ok(beforeFixtureCrossings.has(crossing), "no new fixture crossing");
}

const countries = buildCountryGeometries(JSON.parse(readFileSync(new URL(
  "../public/borders/ne_110m_admin_0_countries.geojson", import.meta.url,
), "utf8")));
const original = JSON.stringify(countries);
freeze(countries);
const start = performance.now();
const display = buildCountryDisplayGeometry(countries, 0.005);
const buildMilliseconds = performance.now() - start;
checkStructure(countries, display);
assert.equal(JSON.stringify(countries), original, "canonical input immutable");
assert.equal(display.stats.edgeOccurrences, 10360);
assert.equal(display.stats.uniqueEdges, 7697);
assert.equal(display.stats.sharedEdges, 2663);
assert.ok(display.stats.roundedCorners > 5000, "rounds eligible real corners");
assert.equal(display.countries.length, 177);

const canonical = buildCountryDisplayGeometry(countries, 0);
const beforeCrossings = crossings([...canonical.coastLines, ...canonical.borderLines]);
const afterCrossings = crossings([...display.coastLines, ...display.borderLines]);
for (const crossing of afterCrossings) {
  assert.ok(beforeCrossings.has(crossing), `new real-asset crossing: ${crossing}`);
}
let seed = 43;
const random = (): number => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
for (let i = 0; i < 1500; i++) {
  const lat = random() * 170 - 85;
  const lng = random() * 360 - 180;
  assert.equal(findCountryInGeometries(display.countries, lat, lng),
    findCountryInGeometries(countries, lat, lng), "seed-43 memberships away from edge strip");
}
for (const [lat, lng] of [[48.2082, 16.3738], [28.6139, 77.209], [-41.2866, 174.7756], [-80, 150]]) {
  assert.equal(findCountryInGeometries(display.countries, lat, lng),
    findCountryInGeometries(countries, lat, lng), "retained city and polar memberships");
}
console.info("country display geometry check passed", {
  ...display.stats, buildMilliseconds: Math.round(buildMilliseconds),
  canonicalCrossings: beforeCrossings.size, displayCrossings: afterCrossings.size,
});
