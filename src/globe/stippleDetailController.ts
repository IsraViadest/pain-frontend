/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import * as THREE from "three";
import { sampleScarHeight01 } from "./scarDisplacement";
import {
  computeStippleNeighborAngles,
  stippleDetailAreaWeight,
  stippleDetailId,
  stippleShouldSplit,
  writeStippleChildren,
} from "./stippleDetail";

export type StippleDetailMode = "fixed" | "regrow" | "split1" | "split2" | "uniform";

interface DetailOptions {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  radius: number;
  isLand: (direction: THREE.Vector3) => boolean;
  capacity?: number;
}

interface Family {
  id: number;
  root: number;
  depth: 0 | 1;
  path: number;
  children: number[];
  directions: Float32Array;
  radii: Float64Array;
  fieldRevision: number;
  from: number;
  to: 0 | 1;
  start: number;
}

const MAX_CAPACITY = 131_072;
const ROOTS_PER_UPDATE = 4096;
function validateCapacity(value: number): void {
  if (!Number.isInteger(value) || value < 4 || value > MAX_CAPACITY || value % 4 !== 0) {
    throw new RangeError("Stipple capacity must be a multiple of four from 4 to 131072");
  }
}
const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Bounded display samples. This controller never changes base positions or source observations. */
export function createStippleDetailController({ points, material, radius, isLand, capacity = MAX_CAPACITY }: DetailOptions) {
  validateCapacity(capacity);
  let capacityLimit = capacity;
  let targetCapacity = capacity;
  const geometry = points.geometry;
  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const land = geometry.getAttribute("aLand") as THREE.BufferAttribute;
  if (!normals || !land || normals.itemSize !== 3 || land.count !== normals.count ||
      !Number.isFinite(radius) || radius <= 0) throw new Error("Invalid stipple root geometry");
  const directions = normals.array;
  const rootCount = normals.count;
  const angles = computeStippleNeighborAngles(directions);
  const rootData = new Float32Array(rootCount * 4);
  const rootSizes = new Float32Array(rootCount).fill(1);
  const rootFades = new Float32Array(rootCount * 3);
  const vector = new THREE.Vector3();
  for (let i = 0; i < rootCount; i++) {
    vector.fromBufferAttribute(normals, i).normalize();
    rootData[i * 4] = vector.x;
    rootData[i * 4 + 1] = vector.y;
    rootData[i * 4 + 2] = vector.z;
    rootData[i * 4 + 3] = angles[i];
    rootFades[i * 3] = rootFades[i * 3 + 1] = 1;
  }
  const rootAttributes = {
    aRoot: new THREE.BufferAttribute(rootData, 4),
    aSizeScale: new THREE.BufferAttribute(rootSizes, 1),
    aFade: new THREE.BufferAttribute(rootFades, 3).setUsage(THREE.DynamicDrawUsage),
  };
  const previousAttributes = new Map<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>();
  for (const [name, attribute] of Object.entries(rootAttributes)) {
    const previous = geometry.getAttribute(name);
    if (previous) previousAttributes.set(name, previous);
    geometry.setAttribute(name, attribute);
  }
  const uniforms = material.uniforms;
  uniforms.uDetailMode ??= { value: 0 };
  uniforms.uDetailTime ??= { value: 0 };
  uniforms.uDetailFadeSeconds ??= { value: 0.15 };
  uniforms.uDetailFocal ??= { value: 0 };

  let families = new Map<number, Family>();
  const transitions = new Set<number>();
  let slots = new Map<number, number>();
  const retiringRoots = new Set<number>();
  let childPoints: THREE.Points | null = null;
  let childAttributes: Record<string, THREE.BufferAttribute> = {};
  let slotIds: Uint32Array | null = null;
  let activeCount = 0;
  let identitySum = 0;
  let peakSlots = 0;
  let peakFamilies = 0;
  let capacityRefusals = 0;
  let uploads = 0;
  let mode: StippleDetailMode = "fixed";
  let disposed = false;
  let time = 0;
  let scanCursor = 0;
  let scanRemaining = 0;
  let rootsExamined = 0;
  let needsMembership = false;
  let rootDirtyMin = Infinity;
  let rootDirtyMax = -1;
  let childDirtyMin = Infinity;
  let childDirtyMax = -1;
  const rootRadii = new Float64Array(rootCount).fill(NaN);
  const rootDiameters = new Float64Array(rootCount);
  const rootVisible = new Uint8Array(rootCount);
  const rootRevisions = new Uint32Array(rootCount);
  let viewRevision = 1;
  let fieldRevision = 1;
  let fieldMap: THREE.DataTexture | null = null;
  let fieldVersion = -1;
  let fieldScale = 0;
  let fieldBias = 0;
  let fieldActive = 0;
  let fieldLandOnly = 0;
  let width = 0;
  let height = 0;
  let pointScale = NaN;
  let focal = 0;
  const view = new THREE.Matrix4();
  const projection = new THREE.Matrix4();
  const lastView = new Float64Array(32).fill(NaN);
  const normalView = new THREE.Vector3();
  const positionView = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const candidateDirections = new Float32Array(12);
  const candidateRadii = new Float64Array(4);
  const screen = new Float64Array(8);

  function scarRadius(direction: THREE.Vector3): number {
    if (!fieldActive || !fieldMap) return radius;
    let u = Math.atan2(direction.z, -direction.x) / (2 * Math.PI);
    if (u < 0) u += 1;
    const v = 0.5 - Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) / Math.PI;
    return radius + (sampleScarHeight01(fieldMap, u, v) * fieldScale + fieldBias) * fieldActive;
  }

  function evaluateRoot(root: number): number {
    if (rootRevisions[root] === viewRevision) return rootDiameters[root];
    vector.fromArray(rootData, root * 4).normalize();
    if (Number.isNaN(rootRadii[root])) rootRadii[root] = scarRadius(vector);
    const r = rootRadii[root];
    normalView.copy(vector).transformDirection(view);
    positionView.copy(vector).multiplyScalar(r).applyMatrix4(view);
    const depth = -positionView.z;
    const front = normalView.dot(projected.copy(positionView).negate().normalize());
    const fresnel = (1 - Math.abs(front)) ** 2;
    const base = (3.5 - smooth(fresnel)) * 0.72 * pointScale;
    const spacing = depth > 0 ? focal * r * angles[root] / depth * Math.max(0, front) : 0;
    const delta = Math.max(0, 0.27 * spacing - base);
    rootDiameters[root] = base + delta * smooth(delta);
    projected.copy(positionView).applyMatrix4(projection);
    rootVisible[root] = depth > 0 && front > 0 && Math.abs(projected.x) <= 1.15 &&
      Math.abs(projected.y) <= 1.15 && projected.z >= -1 && projected.z <= 1 ? 1 : 0;
    rootRevisions[root] = viewRevision;
    return rootDiameters[root];
  }

  function fillRadii(source: Float32Array, target: Float64Array): void {
    for (let i = 0; i < 4; i++) target[i] = scarRadius(vector.fromArray(source, i * 3).normalize());
  }

  function fits(source: Float32Array, radii: Float64Array, childDiameter: number, clearance: number): boolean {
    for (let i = 0; i < 4; i++) {
      projected.fromArray(source, i * 3).normalize().multiplyScalar(radii[i]).applyMatrix4(view);
      if (projected.z >= 0) return false;
      projected.applyMatrix4(projection);
      screen[i * 2] = projected.x * width / 2;
      screen[i * 2 + 1] = projected.y * height / 2;
    }
    const minimumSquared = (clearance * childDiameter) ** 2;
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        if ((screen[a * 2] - screen[b * 2]) ** 2 +
            (screen[a * 2 + 1] - screen[b * 2 + 1]) ** 2 < minimumSquared) return false;
      }
    }
    return true;
  }

  function ensureChildBuffer(): void {
    if (childPoints) return;
    const childGeometry = new THREE.BufferGeometry();
    for (const [name, size] of Object.entries({ position: 3, normal: 3, aLand: 1, aRoot: 4, aSizeScale: 1, aFade: 3 })) {
      const attribute = new THREE.BufferAttribute(new Float32Array(capacityLimit * size), size)
        .setUsage(THREE.DynamicDrawUsage);
      childAttributes[name] = attribute;
      childGeometry.setAttribute(name, attribute);
    }
    slotIds = new Uint32Array(capacityLimit);
    childGeometry.setDrawRange(0, 0);
    childPoints = new THREE.Points(childGeometry, material);
    childPoints.name = "stipple-detail";
    childPoints.renderOrder = points.renderOrder;
    childPoints.frustumCulled = false;
    points.add(childPoints);
  }

  function resizeBuffer(next: number): void {
    if (next < activeCount) throw new Error("Cannot resize stipple storage below live descendants");
    const shrinking = next < capacityLimit;
    if (childPoints && next !== capacityLimit) {
      const replacements: Record<string, THREE.BufferAttribute> = {};
      for (const [name, old] of Object.entries(childAttributes)) {
        const array = new Float32Array(next * old.itemSize);
        array.set((old.array as Float32Array).subarray(0, activeCount * old.itemSize));
        replacements[name] = new THREE.BufferAttribute(array, old.itemSize).setUsage(THREE.DynamicDrawUsage);
      }
      const ids = new Uint32Array(next);
      ids.set(slotIds!.subarray(0, activeCount));
      // Dispose while the old attributes are still attached, including Three's cached limits.
      childPoints.geometry.dispose();
      for (const [name, attribute] of Object.entries(replacements)) childPoints.geometry.setAttribute(name, attribute);
      childAttributes = replacements;
      slotIds = ids;
      childPoints.geometry.setDrawRange(0, activeCount);
      childDirtyMin = Infinity;
      childDirtyMax = -1;
      uploads++;
    }
    capacityLimit = next;
    if (shrinking) {
      families = new Map(families);
      slots = new Map(slots);
      peakSlots = activeCount;
      peakFamilies = families.size;
    }
    needsMembership = true;
    scanRemaining = rootCount;
  }

  function chooseRetirements(): void {
    retiringRoots.clear();
    const counts = new Map<number, number>();
    for (let slot = 0; slot < activeCount; slot++) {
      const root = Math.floor(slotIds![slot] / 21);
      counts.set(root, (counts.get(root) ?? 0) + 1);
    }
    let remaining = activeCount;
    // A stable order independent of source severity; every selected root returns to its base dot.
    for (const root of [...counts.keys()].sort((a, b) => b - a)) {
      if (remaining <= targetCapacity) break;
      retiringRoots.add(root);
      remaining -= counts.get(root)!;
    }
  }

  function markChild(slot: number): void {
    childDirtyMin = Math.min(childDirtyMin, slot);
    childDirtyMax = Math.max(childDirtyMax, slot);
  }

  function addSlot(root: number, depth: 1 | 2, path: number, direction: THREE.Vector3, opacity: number): void {
    if (activeCount >= capacityLimit) throw new Error("Stipple detail capacity exceeded");
    ensureChildBuffer();
    const id = stippleDetailId(root, depth, path);
    const slot = activeCount++;
    slots.set(id, slot);
    slotIds![slot] = id;
    identitySum += id;
    childAttributes.position.setXYZ(slot, direction.x * radius, direction.y * radius, direction.z * radius);
    childAttributes.normal.setXYZ(slot, direction.x, direction.y, direction.z);
    childAttributes.aLand.setX(slot, 1);
    childAttributes.aRoot.setXYZW(slot, rootData[root * 4], rootData[root * 4 + 1], rootData[root * 4 + 2], angles[root]);
    childAttributes.aSizeScale.setX(slot, Math.sqrt(stippleDetailAreaWeight(depth)));
    childAttributes.aFade.setXYZ(slot, opacity, opacity, time);
    markChild(slot);
    peakSlots = Math.max(peakSlots, activeCount);
  }

  function retireSlot(id: number): void {
    const slot = slots.get(id);
    if (slot === undefined) return;
    const last = --activeCount;
    slots.delete(id);
    identitySum -= id;
    if (slot !== last) {
      const movedId = slotIds![last];
      slotIds![slot] = movedId;
      slots.set(movedId, slot);
      for (const attribute of Object.values(childAttributes)) attribute.copyAt(slot, attribute, last);
      markChild(slot);
    }
  }

  function setFade(id: number, from: number, to: number, start: number): void {
    if (id % 21 === 0) {
      const root = id / 21;
      rootAttributes.aFade.setXYZ(root, from, to, start);
      rootDirtyMin = Math.min(rootDirtyMin, root);
      rootDirtyMax = Math.max(rootDirtyMax, root);
    } else {
      const slot = slots.get(id);
      if (slot !== undefined) {
        childAttributes.aFade.setXYZ(slot, from, to, start);
        markChild(slot);
      }
    }
  }

  function weight(family: Family): number {
    const duration = uniforms.uDetailFadeSeconds.value as number;
    const t = duration <= 0 ? 1 : smooth((time - family.start) / duration);
    return family.from + (family.to - family.from) * t;
  }

  function restoreParent(family: Family, opacity: number): void {
    if (family.depth === 0 || slots.has(family.id)) return;
    const rootFamily = families.get(family.root * 21)!;
    addSlot(family.root, 1, family.path, vector.fromArray(rootFamily.directions, family.path * 3), opacity);
  }

  function finish(family: Family): void {
    transitions.delete(family.id);
    family.from = family.to;
    if (family.to === 1) {
      if (family.depth === 1) retireSlot(family.id);
    } else {
      for (const id of family.children) retireSlot(id);
      restoreParent(family, 1);
      setFade(family.id, 1, 1, time);
      families.delete(family.id);
      if (family.depth === 0) retiringRoots.delete(family.root);
      scanRemaining = rootCount;
    }
    needsMembership = true;
  }

  function transition(family: Family, to: 0 | 1, snap = false): void {
    const current = weight(family);
    if (to === 0 && family.depth === 1 && !slots.has(family.id) && activeCount === capacityLimit) snap = true;
    if (snap && to === 0) {
      for (const id of family.children) retireSlot(id);
      restoreParent(family, 1);
    } else if (to === 0) restoreParent(family, 1 - current);
    family.from = snap ? to : current;
    family.to = to;
    family.start = time;
    setFade(family.id, 1 - family.from, 1 - to, time);
    for (const id of family.children) setFade(id, family.from, to, time);
    transitions.add(family.id);
    if (snap || uniforms.uDetailFadeSeconds.value <= 0 || family.from === to) finish(family);
  }

  function split(root: number, depth: 0 | 1, path: number): void {
    const id = stippleDetailId(root, depth, path);
    if (targetCapacity < capacityLimit || families.has(id) || angles[root] <= 0) return;
    if (activeCount + 4 > capacityLimit) {
      capacityRefusals++;
      return;
    }
    writeStippleChildren(directions, root, angles[root], depth, path, candidateDirections);
    for (let i = 0; i < 4; i++) {
      if (!isLand(vector.fromArray(candidateDirections, i * 3).normalize())) return;
    }
    fillRadii(candidateDirections, candidateRadii);
    if (!fits(candidateDirections, candidateRadii, evaluateRoot(root) / 2 ** (depth + 1), 1.2)) return;
    const family: Family = {
      id, root, depth, path, children: [], directions: candidateDirections.slice(),
      radii: candidateRadii.slice(), fieldRevision, from: 0, to: 1, start: time,
    };
    families.set(id, family);
    for (let child = 0; child < 4; child++) {
      const childPath = path * 4 + child;
      family.children.push(stippleDetailId(root, (depth + 1) as 1 | 2, childPath));
      addSlot(root, (depth + 1) as 1 | 2, childPath, vector.fromArray(family.directions, child * 3), 0);
    }
    peakFamilies = Math.max(peakFamilies, families.size);
    transition(family, 1);
    needsMembership = true;
  }

  function flush(): void {
    const upload = (attribute: THREE.BufferAttribute, start: number, count: number): void => {
      let end = start + count;
      // Preserve edits queued before the next render, including reset followed by update.
      for (const range of attribute.updateRanges) {
        start = Math.min(start, range.start);
        end = Math.max(end, range.start + range.count);
      }
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(start, end - start);
      attribute.needsUpdate = true;
    };
    if (rootDirtyMax >= rootDirtyMin) {
      upload(rootAttributes.aFade, rootDirtyMin * 3, (rootDirtyMax - rootDirtyMin + 1) * 3);
      uploads++;
    }
    if (childDirtyMax >= childDirtyMin) {
      for (const attribute of Object.values(childAttributes)) {
        upload(attribute, childDirtyMin * attribute.itemSize,
          (childDirtyMax - childDirtyMin + 1) * attribute.itemSize);
      }
      uploads++;
    }
    childPoints?.geometry.setDrawRange(0, activeCount);
    rootDirtyMin = childDirtyMin = Infinity;
    rootDirtyMax = childDirtyMax = -1;
  }

  function reset(release: boolean): void {
    for (const family of families.values()) {
      if (family.depth === 0) setFade(family.id, 1, 1, time);
    }
    families.clear();
    transitions.clear();
    slots.clear();
    retiringRoots.clear();
    activeCount = identitySum = 0;
    peakSlots = peakFamilies = 0;
    if (release && childPoints) {
      points.remove(childPoints);
      childPoints.geometry.dispose();
      childPoints = null;
      childAttributes = {};
      slotIds = null;
      childDirtyMin = Infinity;
      childDirtyMax = -1;
    }
    if (targetCapacity !== capacityLimit) resizeBuffer(targetCapacity);
    scanRemaining = rootCount;
    needsMembership = true;
    flush();
  }

  return {
    setCapacity(next: number): void {
      if (disposed) return;
      validateCapacity(next);
      if (next === targetCapacity) return;
      targetCapacity = next;
      retiringRoots.clear();
      if (activeCount <= next) resizeBuffer(next);
      else chooseRetirements();
      needsMembership = true;
    },
    setMode(next: StippleDetailMode): void {
      if (disposed || next === mode) return;
      mode = next;
      uniforms.uDetailMode.value = mode === "fixed" ? 0 : 1;
      if (mode === "fixed" || mode === "regrow") reset(true);
      else {
        scanRemaining = rootCount;
        needsMembership = true;
      }
    },
    update(camera: THREE.PerspectiveCamera, cssWidth: number, cssHeight: number, dtSeconds: number): void {
      if (disposed) return;
      if (!Number.isFinite(dtSeconds) || dtSeconds < 0 || !Number.isFinite(cssWidth) ||
          !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
        throw new RangeError("Invalid stipple viewport or elapsed time");
      }
      time += dtSeconds;
      uniforms.uDetailTime.value = time;
      rootsExamined = 0;
      focal = cssHeight * camera.projectionMatrix.elements[5] / 2;
      uniforms.uDetailFocal.value = focal;
      const map = uniforms.uScarMap.value as THREE.DataTexture | null;
      const scale = uniforms.uScarDispScale.value as number;
      const bias = uniforms.uScarDispBias.value as number;
      const active = uniforms.uScarActive.value as number;
      const landOnly = uniforms.uScarLandOnly.value as number;
      const fieldChanged = map !== fieldMap || (map?.version ?? -1) !== fieldVersion ||
        scale !== fieldScale || bias !== fieldBias || active !== fieldActive || landOnly !== fieldLandOnly;
      if (fieldChanged) {
        fieldMap = map;
        fieldVersion = map?.version ?? -1;
        fieldScale = scale;
        fieldBias = bias;
        fieldActive = active;
        fieldLandOnly = landOnly;
        fieldRevision++;
        rootRadii.fill(NaN);
      }
      view.multiplyMatrices(camera.matrixWorldInverse, points.matrixWorld);
      projection.copy(camera.projectionMatrix);
      let changed = fieldChanged || cssWidth !== width || cssHeight !== height ||
        pointScale !== uniforms.uPointScale.value;
      for (let i = 0; i < 16; i++) {
        if (lastView[i] !== view.elements[i] || lastView[16 + i] !== projection.elements[i]) changed = true;
        lastView[i] = view.elements[i];
        lastView[16 + i] = projection.elements[i];
      }
      width = cssWidth;
      height = cssHeight;
      pointScale = uniforms.uPointScale.value as number;
      if (changed) {
        viewRevision++;
        scanRemaining = rootCount;
        needsMembership = true;
      }
      for (const id of transitions) {
        const family = families.get(id)!;
        if (uniforms.uDetailFadeSeconds.value <= 0 || time - family.start >= uniforms.uDetailFadeSeconds.value) finish(family);
      }
      if ((mode === "split1" || mode === "split2") && (needsMembership || scanRemaining > 0)) {
        needsMembership = false;
        const maximumDepth = mode === "split2" ? 2 : 1;
        for (const depth of [1, 0] as const) {
          for (const family of families.values()) {
            if (family.depth !== depth) continue;
            const diameter = evaluateRoot(family.root) / 2 ** depth;
            if (family.fieldRevision !== fieldRevision) {
              fillRadii(family.directions, family.radii);
              family.fieldRevision = fieldRevision;
            }
            const keep = !retiringRoots.has(family.root) && depth < maximumDepth && rootVisible[family.root] === 1 &&
              stippleShouldSplit(family.to === 1, diameter) &&
              fits(family.directions, family.radii, diameter / 2, family.to === 1 ? 1.02 : 1.2);
            const hasDeeper = family.children.some((id) => families.has(id));
            if (!keep && !hasDeeper && family.to !== 0) {
              transition(family, 0, diameter < 2 || rootVisible[family.root] === 0);
            } else if (keep && family.to === 0) transition(family, 1);
            if (keep && depth === 0 && maximumDepth === 2 && !transitions.has(family.id) &&
                family.to === 1 && stippleShouldSplit(false, diameter / 2)) {
              for (let path = 0; path < 4; path++) split(family.root, 1, path);
            }
          }
        }
        rootsExamined = targetCapacity < capacityLimit ? 0 : Math.min(ROOTS_PER_UPDATE, scanRemaining);
        for (let candidate = 0; candidate < rootsExamined; candidate++) {
          const root = scanCursor;
          scanCursor = (scanCursor + 1) % rootCount;
          if (land.getX(root) < 0.5 || families.has(root * 21)) continue;
          const diameter = evaluateRoot(root);
          if (!rootVisible[root] || !stippleShouldSplit(false, diameter)) continue;
          if (!isLand(vector.fromBufferAttribute(normals, root).normalize())) continue;
          split(root, 0, 0);
        }
        scanRemaining -= rootsExamined;
      }
      if (targetCapacity < capacityLimit && retiringRoots.size === 0) {
        if (activeCount <= targetCapacity) resizeBuffer(targetCapacity);
        else chooseRetirements();
      }
      flush();
    },
    invalidateLand(): void {
      if (!disposed) reset(false);
    },
    dispose(): void {
      if (disposed) return;
      reset(true);
      uniforms.uDetailMode.value = 0;
      // Invalidate GPU buffers before removing attributes; the base object and CPU arrays remain owned by the caller.
      geometry.dispose();
      for (const [name, attribute] of Object.entries(rootAttributes)) {
        if (geometry.getAttribute(name) !== attribute) continue;
        const previous = previousAttributes.get(name);
        if (previous) geometry.setAttribute(name, previous);
        else geometry.deleteAttribute(name);
      }
      disposed = true;
    },
    stats() {
      const rootBytes = rootData.byteLength + rootSizes.byteLength + rootFades.byteLength;
      const childBytes = Object.values(childAttributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0);
      return {
        rootCount, descendantCount: activeCount, familyCount: families.size,
        additionalBytes: disposed ? 0 : 2 * (rootBytes + childBytes) + angles.byteLength +
          rootRadii.byteLength + rootDiameters.byteLength + rootVisible.byteLength + rootRevisions.byteLength +
          (slotIds?.byteLength ?? 0) + peakSlots * 256 + peakFamilies * 1024 + retiringRoots.size * 64 + 4096,
        descendantCapacity: childPoints ? capacityLimit : 0, capacityLimit, targetCapacity,
        pendingRootRetirements: retiringRoots.size,
        transitionCount: transitions.size, rootsExaminedLastUpdate: rootsExamined,
        rootScanRemaining: scanRemaining, uploadCount: uploads, capacityRefusals,
        descendantIdSum: identitySum,
      };
    },
  };
}
