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
 *
 * ONE MESH PER CATEGORY, WHICH IS WHY A REPLACED NETWORK HAS TO FINISH LEAVING. A wavefront is
 * drawn by writing the segments in the order the wave reaches them and then drawing the first n
 * of them, so the ordering and the mesh are one thing. A second click on the same category needs
 * a different ordering, and the outgoing network is still using the old one to take itself apart,
 * so the new ordering is held in `pendingPlan` until the motion says its wave has left the lead-in
 * and the mesh is free. That is also what keeps a newly chosen category from flashing whole during
 * the lead-in: a mesh with no ordering yet draws all of its segments.
 *
 * RADIUS IS A SCALE, NOT A COORDINATE. Every arc is built on the unit sphere and each category's
 * mesh is scaled to its radius once per frame. An arc at constant radius is a curve on a sphere,
 * so a uniform scale about the origin moves it to another radius exactly, which is what lets the
 * arcs follow the labels' zoom ramp and sit on 14 separate category shells without rebuilding any
 * geometry. See layout.ts for the ramp itself.
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
import { buildCategoryGraph, buildWorldGraph } from "./graphs";
import { planSpread } from "./spread";
import { applyEmoFacingFade, makeEmoFadeUniform, updateEmoFadeUniform } from "./facingFade";
import { emoArcRadius, emoCategoryShells, emoLabelStandoff, emoSunkStandoff, emoZoomRamp } from "./layout";
import { clampLeaderShare, type EmoSelectionMotion } from "./selectionMotion";

/**
 * Degrees of arc per subdivision. A constant, not a parameter: it trades vertex count against
 * visible faceting and no view depends on the value, so there is nothing to compare between
 * presets.
 *
 * WHY THIS REPLACED A FIXED 24 SUBDIVISIONS. Every join between two segments is a place where two
 * rounded line caps overlap, and at an opacity below 1 that lens of doubled coverage blends twice:
 * 0.55 over 0.55 paints 0.80, which is a 45 percent brightness step. That is the bright dotting
 * visible along the arcs and absent from the single-segment leader lines. A fixed 24 subdivisions
 * put those joins about 3 screen pixels apart on a 5 degree world arc, which is why the dots read
 * as a bead chain rather than as noise.
 *
 * Two degrees is far below the point where faceting could be seen: the sagitta of a 2 degree chord
 * on the unit sphere is 1.5e-4 radii, which at the gallery camera's 543 pixels per radius is 0.08
 * of a pixel. So this spaces the joins roughly eight times further apart on the short arcs and
 * costs nothing visible.
 *
 * IT REDUCES THE DOTS, IT DOES NOT REMOVE THEM. The overlap is inherent to drawing a polyline as
 * capped segments, so any arc below full opacity still shows faint joins, just fewer of them. The
 * fix for the dots themselves is `arcOpacity: 1`, where the blend is a replace and two coats of
 * the same colour are one.
 */
const ARC_SEGMENT_DEG = 2;

/** Floor and ceiling on the subdivision count, so neither a 1 degree nor a 170 degree arc is odd. */
const ARC_SEGMENTS_MIN = 2;
const ARC_SEGMENTS_MAX = 96;

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
   * The category whose network to show in `networkMode: "selected"`, and the country the click
   * came from. Ignored in the other modes, so a preset can carry a selection gesture without
   * changing what is drawn by default.
   *
   * The country matters only to the spread: it is the root of the breadth-first search, so the
   * same category clicked from two different members grows in two different orders.
   */
  setSelectedCategory(cat: string | null, originIso3?: string | null): void;
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
  /** The eased per-category state a selection puts the globe into. See selectionMotion.ts. */
  motion: EmoSelectionMotion;
}): Promise<EmoArcLayer> {
  const { globe, data, motion } = options;
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
  /** Sorted per-segment reveal times, 0 to 1, for whichever mesh currently carries a wavefront. */
  const meshOrder = new Map<string, Float32Array>();
  const fadeUniform = makeEmoFadeUniform(params);
  // The world network spans every category, so it stays on the base shell rather than picking one.
  const categoryShell = emoCategoryShells(data);
  const shellOf = (key: string): number => categoryShell.get(key) ?? 0;

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
    // Depth alone leaks a ring of far-side arc past the globe's silhouette, so the alpha follows
    // the labels' own limb fade. See facingFade.ts for why the depth mask cannot cover it.
    applyEmoFacingFade(material, fadeUniform);
    const mesh = new LineSegments2(new LineSegmentsGeometry(), material);
    mesh.renderOrder = 3;
    group.add(mesh);
    meshes.set(key, mesh);
  }

  /**
   * One arc, subdivided and trimmed, appended as independent segments because
   * LineSegmentsGeometry reads its input as disjoint point pairs.
   *
   * Returns the number of segments written, and 0 for an arc too short to survive trimming, which
   * is what keeps two countries with near-identical label points from producing a degenerate line.
   * Points run from `a` to `b`, so an arc handed its endpoints in wavefront order grows outward
   * from the country the wave came from.
   */
  function appendArc(a: THREE.Vector3, b: THREE.Vector3, out: number[]): number {
    const omega = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    if (omega < 1e-4 || omega > Math.PI - 1e-4) return 0;
    // The trim is angular, because a trim expressed as a world distance would swallow a short arc
    // whole, and capped at a fraction of the arc, so a short arc is shortened and never removed.
    const trim = Math.min(THREE.MathUtils.degToRad(params.arcEndTrimDeg), omega * MAX_TRIM_FRACTION);
    const t0 = trim / omega;
    const t1 = 1 - t0;

    // Subdivide the span that is actually drawn, not the untrimmed arc, so a heavily trimmed
    // short arc does not keep the subdivision count of the long one it was cut down from.
    const drawnDeg = THREE.MathUtils.radToDeg((t1 - t0) * omega);
    const segments = THREE.MathUtils.clamp(
      Math.ceil(drawnDeg / ARC_SEGMENT_DEG),
      ARC_SEGMENTS_MIN,
      ARC_SEGMENTS_MAX,
    );

    const sinOmega = Math.sin(omega);
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let s = 0; s <= segments; s++) {
      const t = t0 + ((t1 - t0) * s) / segments;
      const wa = Math.sin((1 - t) * omega) / sinOmega;
      const wb = Math.sin(t * omega) / sinOmega;
      const x = a.x * wa + b.x * wb;
      const y = a.y * wa + b.y * wb;
      const z = a.z * wa + b.z * wb;
      if (s > 0) out.push(px, py, pz, x, y, z);
      px = x;
      py = y;
      pz = z;
    }
    return segments;
  }

  /**
   * Turn index pairs into arc geometry and hand it to a mesh. Returns the edges actually drawn.
   *
   * With a `plan`, the segments are written in wavefront order rather than in edge order and the
   * mesh gains a `revealAt` table, so drawing the first n of them is drawing the first n moments
   * of the spread. That works because LineSegmentsGeometry is an InstancedBufferGeometry whose
   * `instanceCount` the renderer honours: the animation is then one integer per frame, with no
   * shader, no second geometry and no rebuild. Every edge is still present, so the settled
   * picture is exactly the unordered one.
   */
  function setMeshEdges(
    key: string,
    nodes: ArcNode[],
    pairs: [number, number][],
    plan: { nodeDepth: number[]; span: number } | null,
  ): number {
    const mesh = meshes.get(key);
    if (!mesh) return 0;
    const out: number[] = [];
    /** Reveal time of each segment, in depth steps. Parallel to the segments in `out`. */
    const revealSteps: number[] = [];
    let drawn = 0;
    for (const [a, b] of pairs) {
      // The wave crosses an edge from whichever end it reaches first, so that is the end the arc
      // is drawn from and the moment it starts growing.
      const forward = plan === null || plan.nodeDepth[a]! <= plan.nodeDepth[b]!;
      const from = forward ? a : b;
      const to = forward ? b : a;
      const written = appendArc(nodes[from]!.dir, nodes[to]!.dir, out);
      if (written === 0) continue;
      drawn += 1;
      if (plan === null) continue;
      const base = plan.nodeDepth[from]!;
      // The arc crosses in the first part of its depth step and the rest of the step belongs to
      // the leader line coming down at the far end, so the next hop cannot start before that line
      // has landed. At a share of 0 this is the whole step, which is what every earlier round did.
      const arcShare = 1 - clampLeaderShare(params.selectionLeaderShare);
      for (let seg = 0; seg < written; seg++) revealSteps.push(base + (arcShare * seg) / written);
    }

    let positions: Float32Array;
    if (plan === null) {
      positions = new Float32Array(out);
      meshOrder.delete(key);
    } else {
      // Gather into wavefront order through an index sort, rather than building one small object
      // per segment: a dense category is 12000 segments and a click should not allocate 12000
      // objects to draw them.
      const order = revealSteps.map((_, i) => i);
      order.sort((x, y) => revealSteps[x]! - revealSteps[y]!);
      positions = new Float32Array(out.length);
      const revealAt = new Float32Array(order.length);
      for (let n = 0; n < order.length; n++) {
        const src = order[n]! * 6;
        for (let f = 0; f < 6; f++) positions[n * 6 + f] = out[src + f]!;
        revealAt[n] = revealSteps[order[n]!]! / plan.span;
      }
      meshOrder.set(key, revealAt);
    }

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    return drawn;
  }

  /**
   * How many of a mesh's segments are drawn at a given point in the sweep. The reveal times are
   * sorted, so this is a binary search rather than a scan over 12000 of them every frame.
   *
   * STRICTLY BEFORE THE FRONT, NOT AT IT. Every edge leaving the country that was clicked has its
   * first segment at a reveal time of exactly 0, so a test of `<=` draws a stub of every one of
   * them while the front is still at 0. That was invisible for one frame in every round before
   * this one and is plainly visible now, because the lead-in holds the front at 0 for as long as
   * the first leader line takes to grow. The settled picture is unaffected: no reveal time can
   * reach 1, since the last segment of the deepest edge lands short of it.
   */
  function segmentsRevealed(revealAt: Float32Array, front: number): number {
    let lo = 0;
    let hi = revealAt.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (revealAt[mid]! < front) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Regenerate every network. Cheap enough to run on a slider drag. */
  function rebuild(): void {
    const k = Math.max(1, Math.round(params.kNeighbours));
    let categoryEdges = 0;
    for (const [key, nodes] of byCategory) {
      const pairs = buildCategoryGraph(nodes.map((n) => n.dir), params.categoryGraph, k);
      categoryEdges += setMeshEdges(key, nodes, pairs, null);
    }
    const world = buildWorldGraph(
      allNodes.map((n) => n.dir),
      params.worldGraph,
      k,
      Math.round(params.randomSeed),
    );
    const worldEdges = setMeshEdges(GLOBAL_KEY, allNodes, world.edges, null);
    // A rebuild throws away the wavefront ordering along with the geometry, and a slider drag
    // rebuilds. Re-order without restarting the clock, so a selection survives a parameter change
    // instead of silently becoming a network that can no longer spread.
    if (selectedCat !== null && selectedOrigin !== null) orderSpread(false);
    // Counted off the geometry rather than off the loop, so the number reported is the number of
    // segments the GPU is actually given. Each one carries two line caps that can double-blend.
    let segments = 0;
    for (const mesh of meshes.values()) {
      segments += mesh.geometry.attributes.instanceStart?.count ?? 0;
    }
    console.info(
      `[emoArcs] category=${params.categoryGraph} k=${k} ${categoryEdges}e | ` +
        `world=${params.worldGraph} ${worldEdges}e, rule left ${world.components} components, ` +
        `${world.bridges} bridges added, crossing-free ${world.crossingFree} | ` +
        `${segments} segments at ${ARC_SEGMENT_DEG} deg each`,
    );
  }

  let layerVisible = true;
  let selectedCat: string | null = null;
  /** The country the selection came from, which is the root of the wavefront. */
  let selectedOrigin: string | null = null;

  /**
   * A wavefront ordering computed at click time and not yet written into its mesh.
   *
   * It waits because the mesh may still be drawing the previous wave of the same category in the
   * previous order while that one unbuilds itself. `atGeneration` is the motion's spread
   * generation when this was stashed, so the plan lands on the frame that number changes, which
   * is the frame the new wave leaves its lead-in.
   */
  let pendingPlan:
    | {
        cat: string;
        nodes: ArcNode[];
        pairs: [number, number][];
        plan: { nodeDepth: number[]; span: number };
        atGeneration: number;
      }
    | null = null;

  /**
   * Rebuild the selected category's geometry in wavefront order, and tell the motion when each
   * of its countries is reached so the labels can come up with the front.
   *
   * `restart` separates the two things that ask for this. A click wants the animation to play; a
   * slider drag has only destroyed the ordering by rebuilding the geometry and wants it back
   * without replaying anything.
   */
  function orderSpread(restart: boolean): void {
    if (selectedCat === null || selectedOrigin === null) return;
    const nodes = byCategory.get(selectedCat);
    if (!nodes) return;
    const cat = selectedCat;
    const origin = nodes.findIndex((n) => n.iso3 === selectedOrigin);
    const k = Math.max(1, Math.round(params.kNeighbours));
    const pairs = buildCategoryGraph(nodes.map((n) => n.dir), params.categoryGraph, k);
    const plan = planSpread(pairs, nodes.length, origin);
    if (!restart) {
      // A slider drag has destroyed the ordering by rebuilding the geometry and wants it back
      // without replaying anything. If a click is already waiting on the mesh, keep waiting:
      // writing now would put the new order under the outgoing wave's own front.
      if (pendingPlan === null) setMeshEdges(cat, nodes, pairs, plan);
      else pendingPlan = { ...pendingPlan, nodes, pairs, plan };
      return;
    }
    const arrivals = new Map<string, number>(
      nodes.map((n, i) => [n.iso3, plan.nodeDepth[i] ?? 0]),
    );
    motion.setSpread(cat, selectedOrigin, arrivals, plan.span);
    // setSpread has just sent the outgoing wave into retreat, so this asks whether the mesh this
    // ordering needs is the one that wave is still unbuilding itself on. Only then is there
    // anything to wait for: a different category has its own mesh, and its new ordering can land
    // at once, where its front of 0 draws none of it until the lead-in is over.
    if (motion.retreatingCategories().includes(cat)) {
      pendingPlan = { cat, nodes, pairs, plan, atGeneration: motion.spreadGeneration() };
    } else {
      pendingPlan = null;
      setMeshEdges(cat, nodes, pairs, plan);
    }
    console.info(
      `[emoArcs] spread from ${selectedOrigin} through ${cat}: ${nodes.length} countries, ` +
        `${plan.span} steps, depth ${Math.max(...plan.nodeDepth)}`,
    );
  }

  function syncVisibility(): void {
    group.visible = layerVisible && params.networkMode !== "off";
    // Also written here, not only per frame in update(). A LineSegments2 is born visible, and
    // between being added to the scene and the first update() every category network and the
    // world network would draw at once, which is the flash on reload.
    for (const [key, mesh] of meshes) mesh.visible = shouldShow(key);
  }

  /**
   * Whether one mesh is drawn this frame. Asked per frame rather than on selection changes,
   * because a category that has just stopped being selected is still on screen while it takes
   * itself apart, and nothing calls back when that finishes.
   *
   * "connected" is the resting-plus-selection view: the whole world joined while nothing is
   * clicked, and only the clicked country's category once something is.
   */
  function shouldShow(key: string): boolean {
    const isGlobal = key === GLOBAL_KEY;
    const engaged = key === selectedCat || motion.retreatingCategories().includes(key);
    switch (params.networkMode) {
      case "all":
        return !isGlobal;
      case "selected":
        return !isGlobal && engaged;
      case "connected":
        return isGlobal ? selectedCat === null : engaged;
      default:
        return false;
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
      // A held-back wavefront ordering lands on the frame the motion says its wave has started,
      // which is the frame the mesh it needs is finally empty. See pendingPlan.
      if (pendingPlan !== null && motion.spreadGeneration() !== pendingPlan.atGeneration) {
        setMeshEdges(pendingPlan.cat, pendingPlan.nodes, pendingPlan.pairs, pendingPlan.plan);
        pendingPlan = null;
      }
      // The geometry is on the unit sphere, so the radius is the scale. The base follows the
      // labels' own ramp, and each category is lifted onto its own shell above it.
      const standoff = emoLabelStandoff(emoZoomRamp(globe.camera.position.length(), params), params);
      for (const [key, mesh] of meshes) {
        mesh.visible = shouldShow(key);
        // Each category's network follows its own labels exactly: down with them while another
        // category is chosen, up with them while this one is. The lift is added raw rather than
        // scaled by the arc's share of the standoff, so the gap the arcs keep under the text is
        // exactly preserved and the network cannot rise through it. The world mesh is not a
        // category, so both fractions read 0 for it and it stays on the base shell.
        const sunk = emoSunkStandoff(standoff, params.selectionSink * motion.recedeOf(key));
        mesh.scale.setScalar(
          emoArcRadius(sunk, params) +
            shellOf(key) * params.multiplexSpread +
            params.selectionLift * motion.emphasisOf(key),
        );
        // The wavefront is one integer: how many of this mesh's segments, in reveal order, have
        // been reached. Written every frame for every mesh rather than only the spreading one, so
        // a network that was mid-sweep when the selection changed cannot be left half drawn, and
        // so a category taking itself apart draws the same segments it drew on the way up.
        //
        // A category whose new ordering has not landed yet keeps drawing the outgoing wave in the
        // outgoing order, which is exactly what it should do while that wave unbuilds itself.
        const revealAt = meshOrder.get(key);
        const geometry = mesh.geometry as LineSegmentsGeometry;
        const total = geometry.attributes.instanceStart?.count ?? 0;
        geometry.instanceCount = revealAt
          ? segmentsRevealed(revealAt, motion.arrivalFrontOf(key))
          : total;
      }
    },
    setParams(next: EmoViewParams): void {
      // arcLift is absent on purpose: it is now applied as a per-frame scale, not baked in.
      const geometryChanged =
        // The share decides how much of a depth step the arcs get, and the reveal times are
        // baked into the geometry, so a change to it has to re-order. Compared before the
        // assignment below, like its neighbours.
        next.selectionLeaderShare !== params.selectionLeaderShare ||
        next.kNeighbours !== params.kNeighbours ||
        next.arcEndTrimDeg !== params.arcEndTrimDeg ||
        next.worldGraph !== params.worldGraph ||
        next.categoryGraph !== params.categoryGraph ||
        next.randomSeed !== params.randomSeed;
      params = next;
      updateEmoFadeUniform(fadeUniform, next);
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
    setSelectedCategory(cat: string | null, originIso3?: string | null): void {
      const origin = originIso3 ?? null;
      if (cat === selectedCat && origin === selectedOrigin) return;
      selectedCat = cat;
      selectedOrigin = origin;
      // Whatever was waiting belonged to the gesture this one replaces, and its generation will
      // never arrive now. The mesh keeps the geometry it has, which is the one its own retreat
      // is drawing from.
      pendingPlan = null;
      syncVisibility();
      // Ordered even when the network is not drawn, because `networkMode` can be switched on
      // mid-selection and a mesh whose reveal table did not match its geometry would draw the
      // wrong segments.
      orderSpread(true);
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
