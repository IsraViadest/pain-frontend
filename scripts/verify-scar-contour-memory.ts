/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
// node --expose-gc --import tsx scripts/verify-scar-contour-memory.ts
import assert from "node:assert/strict";
import * as THREE from "three";
import { createScarContourLayer } from "../src/globe/scarContourLayer";

// Supply raster output at the canvas boundary, including fractional edge coverage
// and independent alpha bytes. Packing must preserve red without thresholding.
const w = 1024, h = 512;
const rasterRefs: WeakRef<Uint8ClampedArray>[] = [];
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
Object.defineProperty(globalThis, "document", { configurable: true, value: {
  createElement(name: string) {
    assert.equal(name, "canvas");
    return { width: 0, height: 0, getContext(kind: string) {
      assert.equal(kind, "2d");
      return { fillRect() {}, getImageData(x: number, y: number, width: number, height: number) {
        assert.deepEqual([x, y, width, height], [0, 0, w, h]);
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) data.set([i % 256, 255 - i % 256, 43, i * 43 % 256], i * 4);
        rasterRefs.push(new WeakRef(data));
        return { data, width, height };
      } };
    } };
  },
} });

function geometryBytes(geometry: THREE.BufferGeometry): number {
  return geometry.index!.array.byteLength + Object.values(geometry.attributes)
    .reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
}

const layers: ReturnType<typeof createScarContourLayer>[] = [];
const rows: object[] = [];
try {
  for (const detail of [1, 2] as const) {
    const layer = createScarContourLayer(detail, []);
    layers.push(layer);
    const { geometry, material } = layer.object;
    const reference = new THREE.SphereGeometry(1, 192 * detail, 128 * detail);
    assert.deepEqual(Object.keys(geometry.attributes), ["position"]);
    assert.deepEqual(geometry.getAttribute("position").array, reference.getAttribute("position").array);
    assert.deepEqual(geometry.index!.array, reference.index!.array);
    assert.deepEqual(geometry.parameters, reference.parameters);
    const landMap = material.uniforms.uLandMap.value as THREE.DataTexture;
    const neutral = material.uniforms.uScarMap.value as THREE.DataTexture;
    assert.equal(landMap.format, THREE.RedFormat);
    assert.equal(landMap.type, THREE.UnsignedByteType);
    assert.deepEqual([landMap.image.width, landMap.image.height], [w, h]);
    assert.equal(landMap.image.data.byteLength, w * h);
    for (let i = 0; i < w * h; i++) assert.equal(landMap.image.data[i], i % 256);
    assert.equal(landMap.flipY, false);
    assert.equal(landMap.wrapS, THREE.RepeatWrapping);
    assert.equal(landMap.wrapT, THREE.ClampToEdgeWrapping);
    assert.equal(landMap.minFilter, THREE.LinearFilter);
    assert.equal(landMap.magFilter, THREE.LinearFilter);
    assert.equal(landMap.colorSpace, THREE.NoColorSpace);
    assert.equal(landMap.generateMipmaps, false);
    assert.equal(landMap.unpackAlignment, 1);
    const beforeGeometryBytes = geometryBytes(reference);
    const afterGeometryBytes = geometryBytes(geometry);
    const textureBytesSaved = w * h * 3;
    const geometryBytesSaved = beforeGeometryBytes - afterGeometryBytes;
    const accountedBytesSaved = 2 * (geometryBytesSaved + textureBytesSaved);
    assert.equal(layer.stats().additionalBytes, 2 * (afterGeometryBytes + w * h) + 4096);
    assert.equal(accountedBytesSaved, detail === 1 ? 4141608 : 7103528);
    rows.push({ detail, beforeGeometryBytes, afterGeometryBytes, geometryBytesSaved,
      textureBytesSaved, accountedBytesSaved, releasedRasterCpuBytes: w * h * 4,
      totalCpuAndGpuBytesSaved: accountedBytesSaved + w * h * 4 });
    const resources = [geometry, material, landMap, neutral];
    const disposals = resources.map(() => 0);
    resources.forEach((resource, index) => resource.addEventListener("dispose", () => disposals[index]++));
    const parent = new THREE.Group();
    parent.add(layer.object);
    reference.dispose();
    // Keep the layer and its resources alive through the collection check below.
    layer.object.userData.verifyDispose = () => {
      layer.dispose();
      assert.equal(layer.object.parent, null);
      assert.deepEqual(disposals, [1, 1, 1, 1]);
    };
  }
  assert.notEqual(layers[0].object.geometry, layers[1].object.geometry);
  assert.ok(global.gc, "Run with --expose-gc to verify that raster buffers are released");
  await new Promise<void>((resolve) => setImmediate(resolve));
  global.gc();
  assert.ok(rasterRefs.every((reference) => reference.deref() === undefined),
    "Contour methods must not retain the original RGBA raster");
  console.log(JSON.stringify({ passed: true, rasterBuffersReleased: rasterRefs.length, rows }));
} finally {
  for (const layer of layers) layer.object.userData.verifyDispose?.();
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
}
