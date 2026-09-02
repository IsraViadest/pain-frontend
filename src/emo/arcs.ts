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

  const group = new THREE.Group();
  group.name = "emo-arcs";
  globe.earthContent.add(group);

  const resolution = new THREE.Vector2(1, 1);
  const meshes = new Map<string, LineSegments2>();

  for (const key of byCategory.keys()) {
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
    // The trim is angular. A trim expressed as a world distance would swallow a short arc whole.
    const t0 = THREE.MathUtils.degToRad(params.arcEndTrimDeg) / omega;
    const t1 = 1 - t0;
    if (t1 - t0 < 1e-3) return false;

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
    console.info(`[emoArcs] k=${params.kNeighbours} ${counts.join(" ")}`);
  }

  let layerVisible = true;
  function syncVisibility(): void {
    group.visible = layerVisible && params.networkMode !== "off";
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
