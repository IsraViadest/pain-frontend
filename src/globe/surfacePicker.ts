import * as THREE from "three";

/** Tight bounds prune triangle ranges while every hit still uses the actual shared surface. */
export function createSurfacePicker(surface: THREE.Mesh) {
  const leaves: THREE.Mesh[] = [];
  let source: THREE.BufferGeometry | null = null;
  let positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null = null;
  let index: THREE.BufferAttribute | null = null;
  let positionVersion = -1, indexVersion = -1, rangeStart = -1, rangeCount = -1;
  const point = new THREE.Vector3();
  const localRay = new THREE.Ray();
  const inverseWorld = new THREE.Matrix4();

  function refresh(): void {
    const geometry = surface.geometry;
    const nextPositions = geometry.getAttribute("position");
    const nextIndex = geometry.index;
    const version = nextPositions instanceof THREE.InterleavedBufferAttribute
      ? nextPositions.data.version : nextPositions.version;
    if (source === geometry && positions === nextPositions && index === nextIndex &&
      positionVersion === version && indexVersion === nextIndex?.version &&
      rangeStart === geometry.drawRange.start && rangeCount === geometry.drawRange.count) return;
    if (!nextIndex) throw new Error("Country surface picking requires indexed geometry");
    source = geometry;
    positions = nextPositions;
    index = nextIndex;
    positionVersion = version;
    indexVersion = nextIndex.version;
    rangeStart = geometry.drawRange.start;
    rangeCount = geometry.drawRange.count;
    const end = Math.min(index.count, rangeStart + rangeCount);
    const stride = Math.max(3, Math.ceil((end - rangeStart) / (128 * 3)) * 3);
    let leafCount = 0;
    for (let start = rangeStart; start < end; start += stride) {
      let leaf = leaves[leafCount++];
      if (!leaf) {
        const part = new THREE.BufferGeometry();
        part.boundingBox = new THREE.Box3();
        part.boundingSphere = new THREE.Sphere();
        leaf = new THREE.Mesh(part, surface.material);
        leaf.matrixAutoUpdate = false;
        leaves.push(leaf);
      }
      const part = leaf.geometry;
      part.setAttribute("position", positions);
      part.setIndex(index);
      part.setDrawRange(start, Math.min(stride, end - start));
      part.boundingBox!.makeEmpty();
      for (let i = start; i < start + part.drawRange.count; i++) {
        point.fromBufferAttribute(positions, index.getX(i));
        part.boundingBox!.expandByPoint(point);
      }
      part.boundingBox!.getBoundingSphere(part.boundingSphere!);
    }
    while (leaves.length > leafCount) leaves.pop()!.geometry.dispose();
  }

  return {
    pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
      refresh();
      surface.updateWorldMatrix(true, false);
      localRay.copy(raycaster.ray).applyMatrix4(inverseWorld.copy(surface.matrixWorld).invert());
      const candidates: { leaf: THREE.Mesh; distance: number }[] = [];
      for (const leaf of leaves) {
        const box = leaf.geometry.boundingBox!;
        if (box.containsPoint(localRay.origin)) candidates.push({ leaf, distance: 0 });
        else if (localRay.intersectBox(box, point)) {
          candidates.push({ leaf,
            distance: point.applyMatrix4(surface.matrixWorld).distanceTo(raycaster.ray.origin) });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const hits: THREE.Intersection[] = [];
      let nearest: THREE.Intersection | undefined;
      for (const { leaf, distance } of candidates) {
        if (distance > (nearest?.distance ?? raycaster.far)) break;
        leaf.material = surface.material;
        leaf.matrixWorld.copy(surface.matrixWorld);
        hits.length = 0;
        leaf.raycast(raycaster, hits);
        for (const hit of hits) if (!nearest || hit.distance < nearest.distance) nearest = hit;
      }
      if (nearest) nearest.object = surface;
      return nearest;
    },
    // The index/position buffers are borrowed. This reserves only bounded CPU range metadata.
    storageBytes: () => leaves.length * 1024,
    dispose(): void { for (const leaf of leaves) leaf.geometry.dispose(); },
  };
}
