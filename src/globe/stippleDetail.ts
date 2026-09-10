export type StippleDetailDepth = 0 | 1 | 2;

/** Nearest-neighbor angles in radians; the packed source directions are never changed. */
export function computeStippleNeighborAngles(directions: ArrayLike<number>): Float32Array {
  const count = directions.length / 3;
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError("Stipple spacing requires at least two packed XYZ directions");
  }
  // At most 64^3 bucket heads (1 MiB), regardless of the number of source points.
  const divisions = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(count / (4 * Math.PI)))));
  const width = 2 / divisions;
  const heads = new Int32Array(divisions ** 3).fill(-1);
  const next = new Int32Array(count);
  const unit = new Float64Array(directions.length);
  const angles = new Float32Array(count);
  const cell = (value: number): number =>
    Math.max(0, Math.min(divisions - 1, Math.floor((value + 1) / width)));
  const bucket = (x: number, y: number, z: number): number =>
    (x * divisions + y) * divisions + z;

  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    const length = Math.hypot(directions[offset], directions[offset + 1], directions[offset + 2]);
    if (!Number.isFinite(length) || length === 0) {
      throw new RangeError("Stipple directions must be finite and nonzero");
    }
    const x = unit[offset] = directions[offset] / length;
    const y = unit[offset + 1] = directions[offset + 1] / length;
    const z = unit[offset + 2] = directions[offset + 2] / length;
    const index = bucket(cell(x), cell(y), cell(z));
    next[i] = heads[index];
    heads[index] = i;
  }

  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    const px = unit[offset];
    const py = unit[offset + 1];
    const pz = unit[offset + 2];
    const cx = cell(px);
    const cy = cell(py);
    const cz = cell(pz);
    let bestSquared = Infinity;

    for (let radius = 0; radius < divisions; radius++) {
      const minX = Math.max(0, cx - radius);
      const maxX = Math.min(divisions - 1, cx + radius);
      const minY = Math.max(0, cy - radius);
      const maxY = Math.min(divisions - 1, cy + radius);
      const minZ = Math.max(0, cz - radius);
      const maxZ = Math.min(divisions - 1, cz + radius);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            if (radius > 0 && Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) < radius) {
              continue;
            }
            for (let other = heads[bucket(x, y, z)]; other !== -1; other = next[other]) {
              if (other === i) continue;
              const j = other * 3;
              const dx = px - unit[j];
              const dy = py - unit[j + 1];
              const dz = pz - unit[j + 2];
              bestSquared = Math.min(bestSquared, dx * dx + dy * dy + dz * dz);
            }
          }
        }
      }
      // Every unvisited bucket is beyond one of these cube faces. This also handles
      // sparse fixtures: expand until the nearest point is proved, not just guessed.
      const outsideDistance = Math.min(
        minX > 0 ? px - (-1 + minX * width) : Infinity,
        maxX < divisions - 1 ? -1 + (maxX + 1) * width - px : Infinity,
        minY > 0 ? py - (-1 + minY * width) : Infinity,
        maxY < divisions - 1 ? -1 + (maxY + 1) * width - py : Infinity,
        minZ > 0 ? pz - (-1 + minZ * width) : Infinity,
        maxZ < divisions - 1 ? -1 + (maxZ + 1) * width - pz : Infinity,
      );
      if (bestSquared <= outsideDistance * outsideDistance) break;
    }
    angles[i] = 2 * Math.asin(Math.min(1, Math.sqrt(bestSquared) / 2));
  }
  return angles;
}

/** A root owns 21 distinct IDs: root, four children, then sixteen grandchildren. */
export function stippleDetailId(rootIndex: number, depth: StippleDetailDepth, path: number): number {
  if (!Number.isSafeInteger(rootIndex) || rootIndex < 0 ||
      !Number.isInteger(depth) || depth < 0 || depth > 2 ||
      !Number.isInteger(path) || path < 0 || path >= 4 ** depth) {
    throw new RangeError("Invalid stipple root, depth or child path");
  }
  const id = rootIndex * 21 + (4 ** depth - 1) / 3 + path;
  if (!Number.isSafeInteger(id)) throw new RangeError("Stipple detail ID exceeds integer precision");
  return id;
}

/**
 * Write four unit XYZ children into caller-owned storage, without temporary objects.
 * Paths append one base-four digit: childPath = parentPath * 4 + childIndex.
 * Both generations use the same root frame and spacing, independent of camera or LOD history.
 */
export function writeStippleChildren(
  directions: ArrayLike<number>,
  rootIndex: number,
  nearestAngle: number,
  parentDepth: 0 | 1,
  parentPath: number,
  target: Float32Array | Float64Array,
  offset = 0,
): void {
  if (!Number.isInteger(rootIndex) || rootIndex < 0 || rootIndex * 3 + 2 >= directions.length ||
      (parentDepth !== 0 && parentDepth !== 1) ||
      !Number.isInteger(parentPath) || parentPath < 0 || parentPath >= 4 ** parentDepth ||
      !Number.isFinite(nearestAngle) || nearestAngle <= 0 || nearestAngle > Math.fround(Math.PI) ||
      !Number.isInteger(offset) || offset < 0 || offset + 12 > target.length ||
      (ArrayBuffer.isView(directions) && directions.buffer === target.buffer)) {
    throw new RangeError("Invalid stipple child family or output range");
  }
  const root = rootIndex * 3;
  let nx = directions[root];
  let ny = directions[root + 1];
  let nz = directions[root + 2];
  const length = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(length) || length === 0) {
    throw new RangeError("Stipple root direction must be finite and nonzero");
  }
  nx /= length;
  ny /= length;
  nz /= length;

  // A stable axis away from parallel, including exact north/south pole roots.
  let ex = Math.abs(ny) < 0.9 ? nz : 0;
  let ey = Math.abs(ny) < 0.9 ? 0 : -nz;
  let ez = Math.abs(ny) < 0.9 ? -nx : ny;
  const tangentLength = Math.hypot(ex, ey, ez);
  ex /= tangentLength;
  ey /= tangentLength;
  ez /= tangentLength;
  const fx = ny * ez - nz * ey;
  const fy = nz * ex - nx * ez;
  const fz = nx * ey - ny * ex;

  let hash = (rootIndex ^ 43) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  const rotation = ((hash ^ (hash >>> 15)) >>> 0) / 2 ** 32 * 2 * Math.PI;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const side = 0.8 * nearestAngle;
  const parentX = parentDepth === 0 ? 0 : ((parentPath & 1) ? 1 : -1) * side / 4;
  const parentY = parentDepth === 0 ? 0 : ((parentPath & 2) ? 1 : -1) * side / 4;
  const step = side / (parentDepth === 0 ? 4 : 8);

  for (let child = 0; child < 4; child++) {
    const u = parentX + ((child & 1) ? step : -step);
    const v = parentY + ((child & 2) ? step : -step);
    const a = u * cosine - v * sine;
    const b = u * sine + v * cosine;
    const x = nx + a * ex + b * fx;
    const y = ny + a * ey + b * fy;
    const z = nz + a * ez + b * fz;
    const inverseLength = 1 / Math.hypot(x, y, z);
    target[offset + child * 3] = x * inverseLength;
    target[offset + child * 3 + 1] = y * inverseLength;
    target[offset + child * 3 + 2] = z * inverseLength;
  }
}

/** Activate at 5 CSS px; retain the split until diameter falls below 4.25 CSS px. */
export function stippleShouldSplit(wasSplit: boolean, diameterCssPx: number): boolean {
  if (!Number.isFinite(diameterCssPx) || diameterCssPx < 0) {
    throw new RangeError("Stipple diameter must be finite and nonnegative");
  }
  return diameterCssPx >= (wasSplit ? 4.25 : 5);
}

/** Half diameter at each depth already supplies this area factor; do not also scale alpha. */
export function stippleDetailAreaWeight(depth: StippleDetailDepth): number {
  return 4 ** -depth;
}
