/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
// node --import tsx scripts/verify-stipple-surface-contact.ts [physical-layer.json]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { stippleSurfaceRadii } from "../src/globe/stipple-surface-contact";
import { createPainScarDisplacementTexture } from "../src/globe/painScarField";
import { applyScarToSpherePositions, sampleScarHeight01 } from "../src/globe/scarDisplacement";

let seed = 43;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
const points = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8")).map((r: {lat:number;lng:number;value:number}) => ({lat:r.lat,lng:r.lng,intensity:r.value}))
  : Array.from({length: 1500}, () => ({lat: random() * 170 - 85, lng: random() * 360 - 180, intensity: random()}));
const field = createPainScarDisplacementTexture(points, "physpain", {roundedShoulder:true,
  stampRadiusMin:1, stampRadiusMul:.15, stampPeakMul:.35, falloffSigma:1.05, blurPass1Radius:4, blurPass2Radius:1});
const coordinates = new Float32Array(82000 * 3);
for (let i = 0; i < 82000; i++) {
  const y = 1 - i / 81999 * 2, radius = Math.sqrt(1 - y * y), angle = i * Math.PI * (3 - Math.sqrt(5));
  coordinates.set([Math.cos(angle) * radius, y, Math.sin(angle) * radius], i * 3);
}
const dots = new THREE.BufferAttribute(coordinates, 3);
const direction = new THREE.Vector3();
const results = [];
for (const detail of [1, 2]) {
  const geometry = new THREE.SphereGeometry(1.001, 192 * detail, 128 * detail);
  applyScarToSpherePositions(new Float32Array(geometry.attributes.position!.array),
    geometry.attributes.position!.array as Float32Array, field, .4, -.2, .001);
  const began = performance.now();
  const floors = stippleSurfaceRadii(dots, geometry, .0008);
  const elapsedMs = performance.now() - began;
  assert.equal(floors.length, dots.count);
  assert(floors.every(radius => Number.isFinite(radius) && radius > .79 && radius < 1.3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  const ray = new THREE.Raycaster(new THREE.Vector3(), direction);
  // Independent full-mesh raycast checks the local-grid search, including both poles and seam.
  for (let i = 0; i < dots.count; i += 641) {
    direction.fromBufferAttribute(dots, i).normalize();
    const hit = ray.intersectObject(mesh)[0];
    assert(hit, `Missing reference intersection at ${i}`);
    assert(Math.abs(floors[i]! - hit.distance - .0008) < 3e-6, `Surface mismatch at ${i}`);
  }
  let corrected = 0;
  for (let i = 0; i < dots.count; i++) {
    direction.fromBufferAttribute(dots, i).normalize();
    const u = ((Math.atan2(direction.z, -direction.x) / (2 * Math.PI)) % 1 + 1) % 1;
    const v = .5 - Math.asin(direction.y) / Math.PI;
    const previous = 1 + sampleScarHeight01(field, u, v) * .4 - .2;
    if (previous < floors[i]!) corrected++;
    assert(Math.max(previous, floors[i]!) >= floors[i]!);
  }
  results.push({detail, dots:dots.count, corrected, elapsedMs:Math.round(elapsedMs), additionalBytes:floors.byteLength * 2});
  geometry.dispose(); mesh.material.dispose();
}
field.dispose();
console.log(JSON.stringify({passed:true, results}));
