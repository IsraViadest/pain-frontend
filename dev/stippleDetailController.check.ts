import assert from "node:assert/strict";
import * as THREE from "three";
import { createStippleDetailController } from "../src/globe/stippleDetailController";

function fixture(count: number, landPredicate: (direction: THREE.Vector3) => boolean, fade = 0.15, initialCapacity?: number) {
  const coordinates = new Float32Array(count * 3);
  const lands = new Float32Array(count);
  const direction = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const y = 1 - i / (count - 1) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    direction.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
    coordinates.set(direction.toArray(), i * 3);
    lands[i] = Number(landPredicate(direction));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(coordinates, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(coordinates.slice(), 3));
  geometry.setAttribute("aLand", new THREE.BufferAttribute(lands, 1));
  const map = new THREE.DataTexture(new Uint8Array([128]), 1, 1, THREE.RedFormat);
  const material = new THREE.ShaderMaterial({ uniforms: {
    uPointScale: { value: 1 }, uScarMap: { value: map }, uScarDispScale: { value: 0.4 },
    uScarDispBias: { value: -0.2 }, uScarActive: { value: 1 }, uScarLandOnly: { value: 0 },
    uDetailFadeSeconds: { value: fade },
  } });
  const points = new THREE.Points(geometry, material);
  const camera = new THREE.PerspectiveCamera(45, 1500 / 950, 0.05, 50);
  camera.position.set(0, 0, 1.35);
  camera.lookAt(0, 0, 0);
  const controller = createStippleDetailController({ points, material, radius: 1, isLand: landPredicate,
    capacity: initialCapacity });
  const frame = (dt = 0.05, width = 1500, height = 950): void => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    points.updateMatrixWorld(true);
    controller.update(camera, width, height, dt);
    assert.ok(controller.stats().rootsExaminedLastUpdate <= 4096);
  };
  const settle = (frames = 12): void => { for (let i = 0; i < frames; i++) frame(); };
  const child = (): THREE.Points | undefined => points.children[0] as THREE.Points | undefined;
  function opacity(attribute: THREE.BufferAttribute, index: number): number {
    const from = attribute.getX(index);
    const to = attribute.getY(index);
    const duration = material.uniforms.uDetailFadeSeconds.value;
    const t = duration === 0 ? 1 : THREE.MathUtils.clamp(
      (material.uniforms.uDetailTime.value - attribute.getZ(index)) / duration, 0, 1);
    return THREE.MathUtils.lerp(from, to, t * t * (3 - 2 * t));
  }
  const checkWeights = (): void => {
    const rootFade = geometry.getAttribute("aFade") as THREE.BufferAttribute;
    let total = 0;
    for (let i = 0; i < count; i++) {
      const value = opacity(rootFade, i);
      total += value;
      if (lands[i] === 0) assert.equal(value, 1, "ocean root unchanged");
    }
    const children = child();
    if (children) {
      const { aFade, aSizeScale, aLand, normal } = children.geometry.attributes;
      const drawn = children.geometry.drawRange.count;
      assert.equal(drawn, controller.stats().descendantCount);
      for (let i = 0; i < drawn; i++) {
        const value = opacity(aFade as THREE.BufferAttribute, i);
        total += value * aSizeScale.getX(i) ** 2;
        assert.equal(aLand.getX(i), 1);
        assert.ok(landPredicate(direction.fromBufferAttribute(normal, i).normalize()), "own child land sample");
        const expired = material.uniforms.uDetailFadeSeconds.value === 0 ||
          material.uniforms.uDetailTime.value - aFade.getZ(i) > material.uniforms.uDetailFadeSeconds.value + 1e-6;
        assert.ok(!(expired && aFade.getY(i) === 0), "expired zero-alpha descendant retired");
      }
    }
    assert.ok(Math.abs(total - count) < 1e-3, `uniform field weight ${total} != ${count}`);
  };
  return { controller, points, geometry, material, map, camera, frame, settle, child, checkWeights, coordinates, lands };
}

let latitudeCutoff = 0;
const world = fixture(512, (direction) => direction.y > latitudeCutoff);
const originalPositions = world.coordinates.slice();
const originalPositionAttribute = world.geometry.getAttribute("position");
world.frame();
assert.equal(world.controller.stats().descendantCapacity, 0, "fixed allocates no descendants");
world.controller.setMode("regrow");
world.settle();
assert.equal(world.controller.stats().descendantCount, 0);
assert.equal(world.material.uniforms.uDetailMode.value, 1);
world.controller.setMode("split1");
world.frame(0.04);
assert.ok(world.controller.stats().descendantCount > 0);
world.checkWeights();
world.camera.position.z = 45;
world.frame(0.04);
world.checkWeights(); // Reverse a partial split while all geographic IDs remain stable.
world.camera.position.z = 1.35;
world.frame(0.03);
world.checkWeights();
world.settle();
world.checkWeights();
const firstIds = world.controller.stats().descendantIdSum;
const firstCount = world.controller.stats().descendantCount;
const snapshots = new Map<string, number[]>();
const children = world.child()!;
for (let i = 0; i < children.geometry.drawRange.count; i++) {
  const n = children.geometry.getAttribute("normal");
  const r = children.geometry.getAttribute("aRoot");
  snapshots.set(`${r.getX(i)},${r.getY(i)},${r.getZ(i)}:${n.getX(i)},${n.getY(i)},${n.getZ(i)}`,
    [n.getX(i), n.getY(i), n.getZ(i)]);
}
world.controller.setMode("fixed");
world.checkWeights();
assert.equal(world.controller.stats().descendantCount, 0);
assert.equal(world.controller.stats().familyCount, 0);
assert.equal(world.controller.stats().descendantCapacity, 0);
world.controller.setMode("split1");
world.settle();
assert.equal(world.controller.stats().descendantIdSum, firstIds, "stable IDs after split/merge");
assert.equal(world.controller.stats().descendantCount, firstCount);
for (let i = 0; i < world.child()!.geometry.drawRange.count; i++) {
  const n = world.child()!.geometry.getAttribute("normal");
  const r = world.child()!.geometry.getAttribute("aRoot");
  assert.ok(snapshots.has(`${r.getX(i)},${r.getY(i)},${r.getZ(i)}:${n.getX(i)},${n.getY(i)},${n.getZ(i)}`));
}
world.controller.setMode("split2");
for (let i = 0; i < 12; i++) { world.frame(); world.checkWeights(); }
assert.ok(world.controller.stats().descendantCount > firstCount, "second refinement active");
world.settle();
const settled = world.controller.stats();
world.frame();
assert.equal(world.controller.stats().rootsExaminedLastUpdate, 0, "steady view skips root candidates");
assert.equal(world.controller.stats().uploadCount, settled.uploadCount, "steady view skips membership uploads");
world.material.uniforms.uPointScale.value = 1.2;
world.frame();
assert.ok(world.controller.stats().rootsExaminedLastUpdate > 0, "point tune invalidates membership");
world.map.image.data[0] = 0;
world.map.needsUpdate = true;
world.frame();
assert.ok(world.controller.stats().rootsExaminedLastUpdate > 0, "same map new version invalidates radii");
world.checkWeights();
latitudeCutoff = 0.4;
const normal = world.geometry.getAttribute("normal");
for (let i = 0; i < world.lands.length; i++) world.lands[i] = Number(normal.getY(i) > latitudeCutoff);
world.controller.invalidateLand();
assert.equal(world.controller.stats().descendantCount, 0);
world.settle();
world.checkWeights();
world.material.uniforms.uDetailFadeSeconds.value = 0;
world.controller.setMode("split1");
world.frame();
world.checkWeights();
assert.equal(world.controller.stats().transitionCount, 0, "reduced motion snaps fades");
world.camera.position.z = 45;
world.frame();
world.checkWeights();
assert.equal(world.controller.stats().descendantCount, 0, "fast zoom retires undersized descendants");
assert.deepEqual(world.coordinates, originalPositions);
assert.equal(world.geometry.getAttribute("position"), originalPositionAttribute);
let materialDisposals = 0;
world.material.addEventListener("dispose", () => materialDisposals++);
world.controller.dispose();
world.controller.dispose();
assert.equal(materialDisposals, 0);
assert.equal(world.points.geometry, world.geometry, "base geometry ownership retained");
assert.equal(world.geometry.getAttribute("position"), originalPositionAttribute);
assert.equal(world.geometry.getAttribute("aRoot"), undefined);
assert.equal(world.points.children.length, 0);

const capacity = fixture(40_000, () => true, 0);
capacity.camera.position.z = 5;
capacity.controller.setMode("split2");
for (let i = 0; i < 24; i++) capacity.frame(0.02, 1_500_000, 950_000);
const full = capacity.controller.stats();
assert.ok(full.capacityRefusals > 0, "capacity limit exercised");
assert.ok(full.descendantCount <= 131_072 && full.descendantCount >= 131_060);
capacity.checkWeights();
assert.ok(full.additionalBytes >= 2 * 131_072 * 15 * 4, "estimate includes CPU and GPU descendant buffers");
capacity.material.uniforms.uDetailFadeSeconds.value = 0.15;
capacity.controller.setMode("split1");
capacity.frame(0.02, 1_500_000, 950_000);
capacity.checkWeights();
assert.ok(capacity.controller.stats().descendantCount <= 131_072, "merge parents fit full pool");
capacity.controller.setMode("split2");
capacity.frame(0.03, 1_500_000, 950_000);
capacity.checkWeights();
for (let i = 0; i < 40; i++) capacity.frame(0.05, 1_500_000, 950_000);
capacity.checkWeights();
assert.equal(capacity.controller.stats().transitionCount, 0);
capacity.controller.setMode("regrow");
capacity.frame();
capacity.checkWeights();
assert.equal(capacity.controller.stats().descendantCapacity, 0);
assert.equal(capacity.geometry.getAttribute("aSizeScale").getX(0), 1);
capacity.controller.dispose();

assert.throws(() => fixture(8, () => true, 0, 5), RangeError);
const resized = fixture(1024, () => true, 0.15, 32);
const resizeRoots = resized.coordinates.slice();
resized.camera.position.z = 5;
assert.equal(resized.controller.stats().capacityLimit, 32);
assert.equal(resized.controller.stats().targetCapacity, 32);
assert.equal(resized.controller.stats().descendantCapacity, 0);
resized.controller.setMode("split2");
resized.frame(0.01, 150000, 95000);
resized.frame(0.04, 150000, 95000);
resized.checkWeights();
const beforeResize = resized.controller.stats();
assert.ok(beforeResize.descendantCount > 0 && beforeResize.descendantCount <= 32);
const childGeometry = resized.child()!.geometry;
let expectedOldPosition = childGeometry.getAttribute("position");
let bufferDisposals = 0;
childGeometry.addEventListener("dispose", () => {
  assert.equal(childGeometry.getAttribute("position"), expectedOldPosition, "GPU disposal precedes attribute replacement");
  bufferDisposals++;
});
const liveCopies = Object.fromEntries(Object.entries(childGeometry.attributes).map(([name, attribute]) =>
  [name, attribute.array.slice(0, beforeResize.descendantCount * attribute.itemSize)]));
for (const next of [64, 48]) {
  resized.controller.setCapacity(next);
  assert.equal(resized.controller.stats().capacityLimit, next);
  assert.equal(resized.controller.stats().targetCapacity, next);
  assert.equal(resized.controller.stats().descendantIdSum, beforeResize.descendantIdSum);
  assert.equal(resized.child()!.geometry, childGeometry);
  for (const [name, saved] of Object.entries(liveCopies)) {
    assert.deepEqual(childGeometry.getAttribute(name).array.slice(0, saved.length), saved,
      "resize preserves live attribute and fade bits");
  }
  resized.checkWeights();
  expectedOldPosition = childGeometry.getAttribute("position");
}
assert.equal(bufferDisposals, 2);
for (const invalid of [0, 1, 5, 32769, 131076, Infinity, NaN]) {
  assert.throws(() => resized.controller.setCapacity(invalid), RangeError);
}
assert.equal(resized.controller.stats().capacityLimit, 48);
assert.equal(resized.controller.stats().targetCapacity, 48);
for (let i = 0; i < 24; i++) resized.frame(0.05, 150000, 95000);
assert.ok(resized.controller.stats().descendantCount > 16, "crowded shrink fixture");
const crowded = resized.controller.stats();
resized.controller.setCapacity(16);
assert.equal(resized.controller.stats().capacityLimit, 48, "keep old storage while families fade");
assert.equal(resized.controller.stats().targetCapacity, 16);
assert.equal(resized.controller.stats().descendantCount, crowded.descendantCount);
for (let i = 0; i < 80 && resized.controller.stats().capacityLimit !== 16; i++) {
  resized.frame(0.02, 150000, 95000);
  resized.checkWeights();
}
assert.equal(resized.controller.stats().capacityLimit, 16);
assert.equal(resized.controller.stats().targetCapacity, 16);
assert.ok(resized.controller.stats().descendantCount <= 16);
assert.ok(resized.controller.stats().additionalBytes < crowded.additionalBytes, "shrink releases buffer and Map high water");
expectedOldPosition = childGeometry.getAttribute("position");
for (const next of [64, 4, 32, 8]) {
  resized.controller.setCapacity(next);
  for (let i = 0; i < 100 && resized.controller.stats().capacityLimit !== next; i++) {
    resized.frame(0.02, 150000, 95000);
    resized.checkWeights();
  }
  assert.equal(resized.controller.stats().capacityLimit, next);
  assert.ok(resized.controller.stats().descendantCount <= next);
  expectedOldPosition = childGeometry.getAttribute("position");
  resized.frame(0.02, 150000, 95000);
  resized.checkWeights();
}
assert.deepEqual(resized.coordinates, resizeRoots, "resizing never changes roots");
resized.controller.setMode("fixed");
assert.equal(resized.controller.stats().descendantCapacity, 0);
resized.controller.setCapacity(12);
assert.equal(resized.controller.stats().capacityLimit, 12);
assert.equal(resized.controller.stats().descendantCapacity, 0, "changing an inactive cap stays lazy");
resized.controller.dispose();
resized.controller.dispose();
console.info("stipple detail controller check passed", {
  stableFirstLevelDescendants: firstCount,
  capacityDescendants: full.descendantCount,
  capacityFamilies: full.familyCount,
  additionalBytes: full.additionalBytes,
  resizeDisposals: bufferDisposals,
});
