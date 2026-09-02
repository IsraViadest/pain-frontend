/**
 * Great-circle arcs linking each country to its nearest neighbours in the same pain category.
 *
 * The network is partitioned, not multiplex: the 14 categories share no countries, so each is its
 * own component. Kivela et al. (2014) reserve "multiplex" for layers over a shared node set, and
 * the precise term for this is a partitioned multilayer network. "Multiplex" stays as the name of
 * the stacked view because that is what it is called in this project.
 *
 * Arcs follow the sphere rather than cutting through it: every point is a true slerp between the
 * two country directions at a fixed radius. Lerp-then-normalise would look the same on the short
 * arcs and bunch its vertices toward the ends on the long ones.
 *
 * The group is a child of `globe.earthContent`, which is the object the globe's auto-spin rotates.
 * That is why this needs no change to GlobeView and cannot be forgotten in `syncWorldRotation()`,
 * which is the documented trap for anything added to the scene directly.
 */
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { GlobeView } from "../globe/GlobeView";
import { latLngToVector3 } from "../globe/latLng";
import { ensureCountryCentroidsLoaded, getCountryCentroid } from "../api/countryCentroids";
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";

/**
 * Subdivisions per arc. A constant, not a parameter: it trades vertex count against visible
 * faceting and no view depends on the value, so there is nothing to compare between presets.
 */
const ARC_SEGMENTS = 24;

/** Arcs stay white like the labels; colour remains opt-in and is a label concern for now. */
const ARC_COLOUR = 0xffffff;

/** Mesh key for the classifier-agnostic network, which is not one of the 14 categories. */
const GLOBAL_KEY = "__global__";

/**
 * Ceiling on the end trim, as a fraction of the arc's own length.
 *
 * Without it the trim deletes edges instead of shortening them: the connected network's median
 * arc is about 6 degrees, so a fixed 1.5 degree trim at each end silently dropped every arc under
 * 3 degrees, which was 19 percent of the network and broke the connectivity guarantee that had
 * just been computed. A trim must never remove an edge.
 */
const MAX_TRIM_FRACTION = 0.35;

/**
 * Union-find over node indices, used only to guarantee the connected network is connected.
 */
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

interface ArcNode {
  iso3: string;
  /** Unit direction on the unrotated globe. */
  dir: THREE.Vector3;
}

export interface EmoArcLayer {
  /** Call once per frame. Only syncs the fat-line resolution when the canvas size changes. */
  update(): void;
  setParams(next: EmoViewParams): void;
  /**
   * Whether the emotional views own the globe right now. Unlike the DOM labels, arcs live in the
   * scene graph, so the selected layer and the control preset have to be able to hide them
   * independently of `networkMode`.
   */
  setVisible(visible: boolean): void;
  /**
   * The category whose network to show in `networkMode: "selected"`. Ignored in the other
   * modes, so a preset can carry a selection gesture without changing what is drawn by default.
   */
  setSelectedCategory(cat: string | null): void;
  destroy(): void;
}

/**
 * Build the arc layer. Resolves once country centroids are loaded, since every endpoint is a
 * country label point.
 */
export async function createEmoArcLayer(options: {
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
}): Promise<EmoArcLayer> {
  const { globe, data } = options;
  let params = options.params;

  await ensureCountryCentroidsLoaded();

  const byCategory = new Map<string, ArcNode[]>();
  for (const [iso3, country] of Object.entries(data.countries)) {
    const centroid = getCountryCentroid(iso3);
    if (!centroid) continue;
    const nodes = byCategory.get(country.cat) ?? [];
    nodes.push({ iso3, dir: latLngToVector3(centroid.lat, centroid.lng, 1).normalize() });
    byCategory.set(country.cat, nodes);
  }

  /** Every country, for the classifier-agnostic network. */
  const allNodes: ArcNode[] = [...byCategory.values()].flat();

  const group = new THREE.Group();
  group.name = "emo-arcs";
  globe.earthContent.add(group);

  const resolution = new THREE.Vector2(1, 1);
  const meshes = new Map<string, LineSegments2>();

  for (const key of [...byCategory.keys(), GLOBAL_KEY]) {
    const material = new LineMaterial({
      color: ARC_COLOUR,
      linewidth: params.arcWidth,
      worldUnits: true,
      resolution,
      transparent: true,
      opacity: params.arcOpacity,
      // Tested against the globe so the far hemisphere occludes its arcs, but not written, so
      // the 14 overlapping networks do not punch holes in each other.
      depthTest: true,
      depthWrite: false,
    });
    const mesh = new LineSegments2(new LineSegmentsGeometry(), material);
    mesh.renderOrder = 3;
    group.add(mesh);
    meshes.set(key, mesh);
  }

  /**
   * One arc, subdivided and trimmed, appended as independent segments because
   * LineSegmentsGeometry reads its input as disjoint point pairs.
   *
   * Returns false for an arc too short to survive trimming, which is what keeps two countries
   * with near-identical label points from producing a degenerate line.
   */
  function appendArc(a: THREE.Vector3, b: THREE.Vector3, out: number[]): boolean {
    const omega = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    if (omega < 1e-4 || omega > Math.PI - 1e-4) return false;
    // The trim is angular, because a trim expressed as a world distance would swallow a short arc
    // whole, and capped at a fraction of the arc, so a short arc is shortened and never removed.
    const trim = Math.min(THREE.MathUtils.degToRad(params.arcEndTrimDeg), omega * MAX_TRIM_FRACTION);
    const t0 = trim / omega;
    const t1 = 1 - t0;

    const sinOmega = Math.sin(omega);
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = t0 + ((t1 - t0) * s) / ARC_SEGMENTS;
      const wa = Math.sin((1 - t) * omega) / sinOmega;
      const wb = Math.sin(t * omega) / sinOmega;
      const x = (a.x * wa + b.x * wb) * params.arcLift;
      const y = (a.y * wa + b.y * wb) * params.arcLift;
      const z = (a.z * wa + b.z * wb) * params.arcLift;
      if (s > 0) out.push(px, py, pz, x, y, z);
      px = x;
      py = y;
      pz = z;
    }
    return true;
  }

  /**
   * k nearest same-category neighbours, deduplicated so an undirected edge is drawn once.
   *
   * Nearest by great-circle distance is largest dot product, so the angle never has to be
   * computed here. Group sizes run 7 to 24, so the quadratic scan is not worth avoiding.
   */
  function buildCategory(nodes: ArcNode[]): { positions: Float32Array; edges: number } {
    const k = Math.max(1, Math.round(params.kNeighbours));
    const seen = new Set<string>();
    const out: number[] = [];
    let edges = 0;
    const scored: { j: number; dot: number }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      scored.length = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        scored.push({ j, dot: nodes[i]!.dir.dot(nodes[j]!.dir) });
      }
      scored.sort((x, y) => y.dot - x.dot);
      for (const { j } of scored.slice(0, k)) {
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (appendArc(nodes[i]!.dir, nodes[j]!.dir, out)) edges += 1;
      }
    }
    return { positions: new Float32Array(out), edges };
  }

  /**
   * The classifier-agnostic network: every country to its k nearest neighbours anywhere, plus the
   * fewest extra edges needed to make the whole thing a single connected component.
   *
   * kNN alone fragments. Over these 195 label points it leaves 2 components at k=3 and 9 at k=2,
   * so "nearest neighbours" on its own does not answer "connect everything". The augmentation is
   * Kruskal restricted to edges that join two different components: it adds the shortest possible
   * bridge across each split and nothing else, so connectivity costs 1 edge at k=3 and 8 at k=2.
   *
   * Ignoring the category also makes the arcs local. Within a category the median arc is 25
   * degrees, because the categories are scattered; here it is about 6.
   */
  function buildGlobal(nodes: ArcNode[]): {
    positions: Float32Array;
    edges: number;
    components: number;
    bridges: number;
  } {
    const k = Math.max(1, Math.round(params.kNeighbours));
    const n = nodes.length;
    const pairs: [number, number][] = [];
    const seen = new Set<string>();
    const union = makeUnionFind(n);

    const scored: { j: number; dot: number }[] = [];
    for (let i = 0; i < n; i++) {
      scored.length = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        scored.push({ j, dot: nodes[i]!.dir.dot(nodes[j]!.dir) });
      }
      scored.sort((x, y) => y.dot - x.dot);
      for (const { j } of scored.slice(0, k)) {
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([i, j]);
        union.union(i, j);
      }
    }
    const components = new Set(Array.from({ length: n }, (_, i) => union.find(i))).size;

    // Closest first, so each bridge taken is the shortest one that still joins two components.
    const candidates: { a: number; b: number; dot: number }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        candidates.push({ a: i, b: j, dot: nodes[i]!.dir.dot(nodes[j]!.dir) });
      }
    }
    candidates.sort((x, y) => y.dot - x.dot);
    let bridges = 0;
    for (const { a, b } of candidates) {
      if (!union.union(a, b)) continue;
      pairs.push([a, b]);
      bridges += 1;
    }

    const out: number[] = [];
    let edges = 0;
    for (const [a, b] of pairs) {
      if (appendArc(nodes[a]!.dir, nodes[b]!.dir, out)) edges += 1;
    }
    return { positions: new Float32Array(out), edges, components, bridges };
  }

  /** Regenerate every category's geometry. Cheap enough to run on a slider drag. */
  function rebuild(): void {
    const counts: string[] = [];
    for (const [key, nodes] of byCategory) {
      const { positions, edges } = buildCategory(nodes);
      const mesh = meshes.get(key);
      if (!mesh) continue;
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      counts.push(`${key}=${nodes.length}n/${edges}e`);
    }
    const globalMesh = meshes.get(GLOBAL_KEY);
    if (globalMesh) {
      const g = buildGlobal(allNodes);
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(g.positions);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      globalMesh.geometry.dispose();
      globalMesh.geometry = geometry;
      counts.push(
        `global=${allNodes.length}n/${g.edges}e (kNN left ${g.components} components, ${g.bridges} bridges added)`,
      );
    }
    console.info(`[emoArcs] k=${params.kNeighbours} ${counts.join(" ")}`);
  }

  let layerVisible = true;
  let selectedCat: string | null = null;
  function syncVisibility(): void {
    group.visible = layerVisible && params.networkMode !== "off";
    // "connected" is the resting-plus-selection view: the whole world joined while nothing is
    // clicked, and only the clicked country's category once something is.
    for (const [key, mesh] of meshes) {
      const isGlobal = key === GLOBAL_KEY;
      switch (params.networkMode) {
        case "all":
          mesh.visible = !isGlobal;
          break;
        case "selected":
          mesh.visible = !isGlobal && key === selectedCat;
          break;
        case "connected":
          mesh.visible = selectedCat === null ? isGlobal : !isGlobal && key === selectedCat;
          break;
        default:
          mesh.visible = false;
      }
    }
  }

  rebuild();
  syncVisibility();

  return {
    update(): void {
      const canvas = globe.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      // LineMaterial needs the canvas size, and gets it wrong silently after a resize.
      if (w !== resolution.x || h !== resolution.y) {
        resolution.set(w, h);
        for (const mesh of meshes.values()) {
          (mesh.material as LineMaterial).resolution.copy(resolution);
        }
      }
    },
    setParams(next: EmoViewParams): void {
      const geometryChanged =
        next.kNeighbours !== params.kNeighbours ||
        next.arcLift !== params.arcLift ||
        next.arcEndTrimDeg !== params.arcEndTrimDeg;
      params = next;
      syncVisibility();
      for (const mesh of meshes.values()) {
        const material = mesh.material as LineMaterial;
        material.linewidth = next.arcWidth;
        material.opacity = next.arcOpacity;
      }
      if (geometryChanged) rebuild();
    },
    setVisible(visible: boolean): void {
      layerVisible = visible;
      syncVisibility();
    },
    setSelectedCategory(cat: string | null): void {
      if (cat === selectedCat) return;
      selectedCat = cat;
      syncVisibility();
    },
    destroy(): void {
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as LineMaterial).dispose();
      }
      meshes.clear();
      globe.earthContent.remove(group);
    },
  };
}
