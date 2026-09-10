/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/** Run: node --import tsx scripts/verify-surface-picker.ts */
import assert from "node:assert/strict";
import * as THREE from "three";
import { createSurfacePicker } from "../src/globe/surfacePicker";

const surface = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial());
const parent = new THREE.Group();
parent.add(surface);
const picker = createSurfacePicker(surface);
const camera = new THREE.PerspectiveCamera(45, 1.5, 0.05, 50);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let comparisons = 0;

function check(label: string): void {
  for (let i = 0; i < 64; i++) {
    camera.position.set(i % 3 === 0 ? 1.9 : 0, i % 3 === 1 ? 2 : 0, i % 3 === 2 ? 2.6 : 1.7);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    pointer.set(Math.sin(i * 43) * 0.9, Math.cos(i * 43) * 0.9);
    raycaster.setFromCamera(pointer, camera);
    const actual = picker.pick(raycaster);
    const expected = raycaster.intersectObject(surface, false)[0];
    assert.equal(Boolean(actual), Boolean(expected), `${label}: hit/miss ${i}`);
    if (actual && expected) {
      assert.ok(actual.point.distanceTo(expected.point) < 1e-8, `${label}: point ${i}`);
      assert.equal(actual.faceIndex, expected.faceIndex, `${label}: triangle ${i}`);
    }
    comparisons++;
  }
}

check("sphere");
parent.rotation.set(0.2, 1.1, 0);
surface.scale.setScalar(0.994);
check("transformed");
const positions = surface.geometry.getAttribute("position");
for (let i = 0; i < positions.count; i++) {
  const radius = 0.86 + 0.12 * Math.sin(positions.getX(i) * 13) * Math.cos(positions.getY(i) * 7);
  positions.setXYZ(i, positions.getX(i) * radius, positions.getY(i) * radius, positions.getZ(i) * radius);
}
positions.needsUpdate = true;
surface.geometry.computeBoundingSphere();
check("live dents");
const indices = surface.geometry.index!;
const saved = indices.array.slice();
const half = Math.floor(indices.count / 6) * 3;
indices.array.set(saved.subarray(half), 0);
indices.array.set(saved.subarray(0, half), saved.length - half);
indices.needsUpdate = true;
check("live index reorder");
surface.geometry.setDrawRange(0, half);
check("draw range");
surface.geometry.dispose();
surface.geometry = new THREE.SphereGeometry(1, 384, 256);
check("rich geometry replacement");
assert.ok(picker.storageBytes() <= 128 * 1024, "picker metadata exceeded its bound");
picker.dispose();
surface.geometry.dispose();
surface.material.dispose();
console.log(JSON.stringify({ passed: true, comparisons, cases: 6 }));
