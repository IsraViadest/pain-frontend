/**
 * Ways of joining points on a sphere into a network.
 *
 * Kept separate from the rendering in arcs.ts because these are pure functions over unit vectors:
 * they take directions and return index pairs, which is what makes their properties measurable
 * rather than merely asserted.
 *
 * THE NON-CROSSING FAMILY. The convex hull of points on a sphere *is* their Delaunay
 * triangulation, and Delaunay is planar, so no two of its great-circle edges cross. The classic
 * chain of subgraphs
 *
 *     EMST  subset of  RNG  subset of  Gabriel  subset of  Delaunay
 *
 * inherits that, so all four are non-crossing and all four are connected. Over the 195 country
 * label points, measured with an explicit great-circle crossing test:
 *
 *   | graph    | edges | median arc | max  | components | crossings |
 *   | MST      |   194 |      5 deg |  35  |          1 |         0 |
 *   | RNG      |   233 |      5 deg |  82  |          1 |         0 |
 *   | Gabriel  |   360 |      7 deg |  87  |          1 |         0 |
 *   | Delaunay |   579 |      9 deg | 105  |          1 |         0 |
 *   | kNN k=3  |   389 |      6 deg |  36  |          2 |        43 |
 *
 * So the density ladder is MST to Delaunay, and only kNN and random can cross themselves.
 */
import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { mulberry32 } from "./rng";

/** How to join every country to every other. Only the middle four are guaranteed non-crossing. */
export type EmoWorldGraph =
  | "knn"
  | "mst"
  | "rng"
  | "gabriel"
  | "delaunay"
  | "random";

/** How to join the countries inside one pain category. */
export type EmoCategoryGraph = "knn" | "complete" | "gabriel" | "delaunay";

type Edge = [number, number];

function makeUnionFind(size: number): {
  find: (x: number) => number;
  union: (a: number, b: number) => boolean;
} {
  const parent = [...Array(size).keys()];
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  return {
    find,
    union(a: number, b: number): boolean {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return false;
      parent[ra] = rb;
      return true;
    },
  };
}

function componentCount(size: number, edges: Edge[]): number {
  const uf = makeUnionFind(size);
  for (const [a, b] of edges) uf.union(a, b);
  return new Set(Array.from({ length: size }, (_, i) => uf.find(i))).size;
}

const key = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Neighbour indices of `i`, closest first. Largest dot product is smallest great-circle distance. */
function neighboursByDistance(dirs: THREE.Vector3[], i: number): number[] {
  return dirs
    .map((_, j) => j)
    .filter((j) => j !== i)
    .sort((x, y) => dirs[i]!.dot(dirs[y]!) - dirs[i]!.dot(dirs[x]!));
}

function knnEdges(dirs: THREE.Vector3[], k: number): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (let i = 0; i < dirs.length; i++) {
    for (const j of neighboursByDistance(dirs, i).slice(0, k)) {
      const id = key(i, j);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push([i, j]);
    }
  }
  return out;
}

/**
 * Spherical Delaunay, obtained as the convex hull. Every input must be a unit vector, or a point
 * inside the hull would simply be dropped from the network.
 */
function delaunayEdges(dirs: THREE.Vector3[]): Edge[] {
  const index = new Map<THREE.Vector3, number>(dirs.map((v, i) => [v, i]));
  const hull = new ConvexHull().setFromPoints(dirs);
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      const a = index.get(edge.tail().point);
      const b = index.get(edge.head().point);
      if (a !== undefined && b !== undefined) {
        const id = key(a, b);
        if (!seen.has(id)) {
          seen.add(id);
          out.push([a, b]);
        }
      }
      edge = edge.next;
    } while (edge !== face.edge);
  }
  return out;
}

/** Gabriel: no third point inside the sphere that has this edge as its diameter. */
function gabrielFilter(dirs: THREE.Vector3[], edges: Edge[]): Edge[] {
  const mid = new THREE.Vector3();
  return edges.filter(([a, b]) => {
    mid.copy(dirs[a]!).add(dirs[b]!).multiplyScalar(0.5);
    const r2 = dirs[a]!.distanceToSquared(mid);
    for (let c = 0; c < dirs.length; c++) {
      if (c === a || c === b) continue;
      if (dirs[c]!.distanceToSquared(mid) < r2 - 1e-12) return false;
    }
    return true;
  });
}

/** Relative neighbourhood: no third point closer to both ends than the ends are to each other. */
function rngFilter(dirs: THREE.Vector3[], edges: Edge[]): Edge[] {
  const angle = (x: number, y: number): number =>
    Math.acos(THREE.MathUtils.clamp(dirs[x]!.dot(dirs[y]!), -1, 1));
  return edges.filter(([a, b]) => {
    const d = angle(a, b);
    for (let c = 0; c < dirs.length; c++) {
      if (c === a || c === b) continue;
      if (Math.max(angle(a, c), angle(b, c)) < d - 1e-12) return false;
    }
    return true;
  });
}

/** Kruskal over the given candidate edges, shortest first. */
function minimumSpanningTree(dirs: THREE.Vector3[], candidates: Edge[]): Edge[] {
  const uf = makeUnionFind(dirs.length);
  const sorted = [...candidates].sort(
    (x, y) => dirs[y[0]]!.dot(dirs[y[1]]!) - dirs[x[0]]!.dot(dirs[x[1]]!),
  );
  const out: Edge[] = [];
  for (const [a, b] of sorted) {
    if (uf.union(a, b)) out.push([a, b]);
  }
  return out;
}

/** Each node joins k partners chosen at random rather than by distance. Crossings are expected. */
function randomEdges(count: number, k: number, seed: number): Edge[] {
  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (let i = 0; i < count; i++) {
    for (let picked = 0, guard = 0; picked < k && guard < k * 12; guard++) {
      const j = Math.floor(rand() * count);
      if (j === i) continue;
      const id = key(i, j);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push([i, j]);
      picked += 1;
    }
  }
  return out;
}

/**
 * Add the fewest edges that make `edges` a single connected component: Kruskal restricted to
 * edges joining two different components, so each bridge taken is the shortest one that still
 * merges something.
 *
 * The Delaunay family is already connected, so this is a no-op there. kNN is not: over these
 * points it leaves 2 components at k=3 and 9 at k=2.
 */
function connectComponents(dirs: THREE.Vector3[], edges: Edge[]): Edge[] {
  const uf = makeUnionFind(dirs.length);
  for (const [a, b] of edges) uf.union(a, b);
  const candidates: { a: number; b: number; dot: number }[] = [];
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      candidates.push({ a: i, b: j, dot: dirs[i]!.dot(dirs[j]!) });
    }
  }
  candidates.sort((x, y) => y.dot - x.dot);
  const bridges: Edge[] = [];
  for (const { a, b } of candidates) {
    if (uf.union(a, b)) bridges.push([a, b]);
  }
  return bridges;
}

/**
 * The classifier-agnostic network over every country, always returned as a single connected
 * component. `components` reports how many the chosen rule produced on its own, and `bridges` how
 * many edges had to be added to reach one, so the guarantee is visible rather than assumed.
 */
export function buildWorldGraph(
  dirs: THREE.Vector3[],
  mode: EmoWorldGraph,
  k: number,
  seed: number,
): { edges: Edge[]; components: number; bridges: number; crossingFree: boolean } {
  let edges: Edge[];
  let crossingFree = true;
  switch (mode) {
    case "delaunay":
      edges = delaunayEdges(dirs);
      break;
    case "gabriel":
      edges = gabrielFilter(dirs, delaunayEdges(dirs));
      break;
    case "rng":
      edges = rngFilter(dirs, delaunayEdges(dirs));
      break;
    case "mst":
      edges = minimumSpanningTree(dirs, delaunayEdges(dirs));
      break;
    case "random":
      edges = randomEdges(dirs.length, k, seed);
      crossingFree = false;
      break;
    default:
      edges = knnEdges(dirs, k);
      crossingFree = false;
  }
  const components = componentCount(dirs.length, edges);
  const bridges = connectComponents(dirs, edges);
  return { edges: [...edges, ...bridges], components, bridges: bridges.length, crossingFree };
}

/**
 * The network inside one pain category. Never bridged: a category is not required to connect.
 *
 * The same non-crossing family as the world graph is available here, computed over the category's
 * own points rather than over all 195. A category holds 7 to 24 countries, and a hull needs 4
 * points, so anything smaller falls back to all-to-all, which for 3 points is the triangulation.
 */
export function buildCategoryGraph(
  dirs: THREE.Vector3[],
  mode: EmoCategoryGraph,
  k: number,
): Edge[] {
  if (mode === "knn") return knnEdges(dirs, k);
  if (mode === "delaunay" && dirs.length >= 4) return delaunayEdges(dirs);
  if (mode === "gabriel" && dirs.length >= 4) return gabrielFilter(dirs, delaunayEdges(dirs));
  const out: Edge[] = [];
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) out.push([i, j]);
  }
  return out;
}
