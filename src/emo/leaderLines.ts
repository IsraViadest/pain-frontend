/**
 * A hairline from each country up to the label that names it.
 *
 * The labels float at a standoff above the globe, and above a crowded region it is often not
 * obvious which country a word belongs to. This draws the attachment rather than leaving it to be
 * inferred. It is the operator's stated reason for wanting leader lines, and it is a different
 * job from the one the research lanes describe: those propose displacing labels to fit more of
 * them on screen, which was measured to buy 61 to 75 of 195 and is not what this does. Nothing
 * moves here. Every label stays over its own country and simply gains a line to it.
 *
 * Unlike the arcs, a spike cannot be a uniform scale of one geometry: its foot stays on the
 * surface while its head rides the zoom ramp and its category's shell, so the two ends move by
 * different amounts. The positions are therefore rebuilt, but only when the head actually moves
 * far enough to see, which during a still camera is never.
 *
 * Parented to `globe.earthContent` so it inherits the spin, and faded round the back on the same
 * two parameters as the labels and the arcs. See facingFade.ts.
 *
 * THE FOOT GOES THROUGH THE SURFACE, NOT ONTO IT. In all-layers mode the pain scars dent the globe
 * inward, by an amount inferred from the parallax of the misplaced selection wash rather than read
 * from GlobeView's private scar field, and near 0.08 of a radius where a country is deeply marked,
 * so a foot placed just above the undented sphere hangs in space over its own country. Rather than track the
 * dent, which would mean duplicating GlobeView's scar field, the line simply starts below every
 * possible dent and lets the depth buffer cut it: the globe mesh writes depth in the opaque pass,
 * as an invisible mask at 0.994 of the warped shell in all-layers mode and as the solid textured
 * sphere otherwise, and these lines test against it. The line therefore always reaches the centre
 * of the country and is never seen inside it. `leaderFoot` is the parameter, and 1.004 keeps the
 * old behaviour for every preset that predates it.
 *
 * WHICH IS WHY THERE ARE TWO FEET. That whole arrangement rests on something writing depth, and
 * on the emotional-pain layer by itself nothing does: the base mesh is hidden rather than turned
 * into a mask, so the buried length draws in full and reads as a spear across the disc. This was
 * written down as an edge case ("if the choropleth fails to load") when it is in fact the default
 * in one of the two modes the feature ships in. `leaderFootEmoOnly` is the foot for that mode and
 * needs no mask, sitting just outside the undented sphere instead of below every dent.
 *
 * The mode arrives through `setDepthMasked`, called from the same `syncEmoLayer` that already
 * decides whether these lines are drawn at all, so there is one source of truth for which globe
 * is on screen. The parameter is named for the layer the operator sees and the method for the
 * mechanism that makes the two differ; they are the same fact from opposite ends.
 *
 * TWO MESHES, BECAUSE A LINE WIDTH IS A MATERIAL AND NOT A VERTEX. LineMaterial carries one
 * `linewidth` for everything it draws, so the chosen pain category's leaders can only be heavier
 * than the rest by being a second mesh with a second material. Membership is
 * `motion.emphasisOf(category) > 0`, which is the one selection signal this module has ever read;
 * a locally tracked category would be the two-signal problem the revision counter below was
 * written to remove. The split is invisible until a preset asks for it: with both
 * `leaderSelected*Scale` at 1 the two materials are identical, and two meshes drawing disjoint
 * white segments at one opacity composite to exactly what one mesh drawing all of them does.
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
import { emoCategoryShells, emoLabelStandoff, emoSunkStandoff, emoZoomRamp } from "./layout";
import type { EmoSelectionMotion } from "./selectionMotion";
import { applyEmoFacingFade, makeEmoFadeUniform, updateEmoFadeUniform } from "./facingFade";


/**
 * How far below the label's own radius the line stops, in globe radii. At the gallery camera the
 * globe is about 543 screen pixels across its radius, so this lands the tip roughly at the text's
 * lower edge rather than through the middle of it.
 */
const HEAD_GAP = 0.012;

/** Rebuild only when the head has moved by more than this, which a still camera never does. */
const REBUILD_EPSILON = 1e-4;

interface LeaderNode {
  /** Country code, so a spreading leader can ask the wavefront whether it has been reached. */
  iso3: string;
  dir: THREE.Vector3;
  shell: number;
  /** This country's pain category, so the head can follow a selection lift that only it gets. */
  cat: string;
}

export interface EmoLeaderLineLayer {
  /** Call once per frame. Rebuilds only when the zoom ramp has actually moved the label heads. */
  update(): void;
  setParams(next: EmoViewParams): void;
  /** Whether the emotional views own the globe right now, independent of the `leaderLines` flag. */
  setVisible(visible: boolean): void;
  /**
   * Whether something in front of these lines writes depth, which decides which foot is used.
   * True in all-layers mode, where the base globe is an invisible depth mask; false on the
   * emotional layer alone, where the base globe is simply hidden.
   */
  setDepthMasked(masked: boolean): void;
  destroy(): void;
}

export async function createEmoLeaderLineLayer(options: {
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
  /** The eased per-category state a selection puts the globe into. See selectionMotion.ts. */
  motion: EmoSelectionMotion;
}): Promise<EmoLeaderLineLayer> {
  const { globe, data, motion } = options;
  let params = options.params;

  await ensureCountryCentroidsLoaded();

  const categoryShell = emoCategoryShells(data);
  const nodes: LeaderNode[] = [];
  for (const [iso3, country] of Object.entries(data.countries)) {
    const centroid = getCountryCentroid(iso3);
    if (!centroid) continue;
    nodes.push({
      iso3,
      dir: latLngToVector3(centroid.lat, centroid.lng, 1).normalize(),
      shell: categoryShell.get(country.cat) ?? 0,
      cat: country.cat,
    });
  }

  const resolution = new THREE.Vector2(1, 1);
  const fadeUniform = makeEmoFadeUniform(params);

  /**
   * One of the two weights a leader line can be drawn at.
   *
   * Both are sized for every country, because which of them a country belongs to changes with
   * the selection and neither buffer is ever reallocated. `count` is how many of those slots the
   * last rebuild filled, and it is what the geometry's `instanceCount` is set to, so the unused
   * tail keeps whatever it held and is simply not drawn.
   */
  interface LeaderMesh {
    mesh: LineSegments2;
    material: LineMaterial;
    positions: Float32Array;
    built: boolean;
    count: number;
  }

  function makeLeaderMesh(name: string): LeaderMesh {
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: params.arcWidth * params.leaderWidthScale,
      worldUnits: true,
      resolution,
      transparent: true,
      opacity: Math.min(1, params.arcOpacity * params.leaderOpacityScale),
      depthTest: true,
      depthWrite: false,
    });
    applyEmoFacingFade(material, fadeUniform);
    const mesh = new LineSegments2(new LineSegmentsGeometry(), material);
    mesh.name = name;
    mesh.renderOrder = 3;
    globe.earthContent.add(mesh);
    // setPositions keeps a Float32Array by reference rather than copying it, so this array stays
    // the geometry's own storage and a rebuild is a write plus a needsUpdate rather than an alloc.
    return { mesh, material, positions: new Float32Array(nodes.length * 6), built: false, count: 0 };
  }

  const rest = makeLeaderMesh("emo-leader-lines");
  const chosen = makeLeaderMesh("emo-leader-lines-selected");
  const both = [rest, chosen];

  /** Width and opacity of the two materials, from the four scales. Called on every change. */
  function applyWeights(p: EmoViewParams): void {
    rest.material.linewidth = p.arcWidth * p.leaderWidthScale;
    rest.material.opacity = Math.min(1, p.arcOpacity * p.leaderOpacityScale);
    chosen.material.linewidth = p.arcWidth * p.leaderWidthScale * p.leaderSelectedWidthScale;
    chosen.material.opacity = Math.min(
      1,
      p.arcOpacity * p.leaderOpacityScale * p.leaderSelectedOpacityScale,
    );
  }
  applyWeights(params);

  let lastStandoff = Number.NaN;
  let lastSpread = Number.NaN;
  /**
   * The foot the current geometry was built at, which is the EFFECTIVE foot and not the parameter.
   *
   * Watching `params.leaderFoot` here would be trap 25 in its sixth guise: a layer switch changes
   * which of the two feet applies without changing either parameter, so a condition asking
   * whether the parameter moved would keep the old geometry until something else happened to
   * force a rebuild, and the spears would survive the fix that was meant to remove them.
   */
  let lastFoot = Number.NaN;
  let lastLift = Number.NaN;
  let lastSink = Number.NaN;
  /**
   * The motion revision the current geometry was built at, which is this layer's whole selection
   * signal. It replaced a locally tracked selected category, because two signals for one fact is
   * how they come to disagree.
   *
   * A revision rather than an "is it moving" flag, because the two differ on exactly the frame
   * that matters: a track reaches its target and stops moving in the same tick, so a condition
   * asking whether it is moving would skip the rebuild that lands the final position and leave
   * every head one frame short. That is failure 25 again, in its fifth guise in this feature.
   */
  let lastMotionRevision = -1;
  /**
   * The spread mode the current geometry was built at.
   *
   * Toggling it changes which countries are written and how far up their line reaches, and
   * nothing else compared here would notice, because neither the standoff nor the motion has
   * moved. That is trap 25's shape, so it gets its own comparison.
   */
  let lastLeaderSpread = params.leaderSpread;

  function rebuild(standoff: number, foot: number): void {
    const spreading = params.leaderSpread === "on";
    rest.count = 0;
    chosen.count = 0;
    for (const node of nodes) {
      const { iso3, dir, shell, cat } = node;
      const emphasis = motion.emphasisOf(cat);
      const isChosen = emphasis > 0;
      // A head follows its own label, which is what makes "leave the leader lines where they are"
      // true only of the chosen category: everything else sinks, and a head that stayed put would
      // leave its tip standing through the text it used to point at.
      const sunk = emoSunkStandoff(standoff, params.selectionSink * motion.recedeOf(cat));
      const full = Math.max(
        foot,
        sunk + shell * params.multiplexSpread + params.selectionLift * emphasis - HEAD_GAP,
      );
      let head = full;
      if (isChosen && spreading) {
        const arrival = motion.arrivalOf(iso3);
        // Not written at all rather than written with both ends equal: a zero-length segment
        // still paints its round cap, which would leave a dot on the surface of every country
        // the wave has yet to reach.
        if (arrival <= 0) continue;
        head = foot + (full - foot) * arrival;
      }
      const target = isChosen ? chosen : rest;
      const o = target.count * 6;
      target.count += 1;
      target.positions[o] = dir.x * foot;
      target.positions[o + 1] = dir.y * foot;
      target.positions[o + 2] = dir.z * foot;
      target.positions[o + 3] = dir.x * head;
      target.positions[o + 4] = dir.y * head;
      target.positions[o + 5] = dir.z * head;
    }
    for (const part of both) {
      const geometry = part.mesh.geometry as LineSegmentsGeometry;
      if (part.built) {
        // instanceStart and instanceEnd are two views on one interleaved buffer, so flagging the
        // buffer once uploads both ends of every segment.
        (geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate =
          true;
      } else {
        geometry.setPositions(part.positions);
        part.built = true;
      }
      // Everything past this is last frame's line for some country that has changed weight, so
      // it stays in the buffer and is not drawn. The bounds are computed over the whole array,
      // which can only make them larger than they need to be and so cannot cull anything drawn.
      geometry.instanceCount = part.count;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    lastStandoff = standoff;
    lastSpread = params.multiplexSpread;
    lastFoot = foot;

    lastLift = params.selectionLift;
    lastSink = params.selectionSink;
    lastLeaderSpread = params.leaderSpread;
    lastMotionRevision = motion.revision();
  }

  function syncVisibility(layerVisible: boolean): void {
    const on = layerVisible && params.leaderLines === "on";
    for (const part of both) part.mesh.visible = on;
  }

  let visible = true;
  syncVisibility(visible);

  /**
   * Which foot applies right now. Defaults to masked, because all-layers is the mode the page
   * boots into and the mode every gallery capture is taken in.
   */
  let depthMasked = true;
  const effectiveFoot = (): number =>
    depthMasked ? params.leaderFoot : params.leaderFootEmoOnly;

  return {
    update(): void {
      const canvas = globe.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (w !== resolution.x || h !== resolution.y) {
        resolution.set(w, h);
        for (const part of both) part.material.resolution.copy(resolution);
      }
      const built = rest.built && chosen.built;
      if (!rest.mesh.visible && built) return;
      const standoff = emoLabelStandoff(emoZoomRamp(globe.camera.position.length(), params), params);
      const foot = effectiveFoot();
      if (
        !built ||
        Math.abs(standoff - lastStandoff) > REBUILD_EPSILON ||
        params.multiplexSpread !== lastSpread ||
        foot !== lastFoot ||
        params.selectionLift !== lastLift ||
        params.selectionSink !== lastSink ||
        params.leaderSpread !== lastLeaderSpread ||
        motion.revision() !== lastMotionRevision
      ) {
        rebuild(standoff, foot);
      }
    },
    setParams(next: EmoViewParams): void {
      params = next;
      updateEmoFadeUniform(fadeUniform, next);
      // Width and opacity are material state, so they take effect without touching geometry.
      // Which mesh a country belongs to is not: that follows the selection, and update() rebuilds
      // it on the motion revision.
      applyWeights(next);
      syncVisibility(visible);
    },
    setDepthMasked(masked: boolean): void {
      // No rebuild here. update() compares the effective foot against the one the geometry holds,
      // so the next frame does it, and doing it here as well would be a second place for the two
      // to disagree.
      depthMasked = masked;
    },
    setVisible(next: boolean): void {
      visible = next;
      syncVisibility(visible);
    },
    destroy(): void {
      for (const part of both) {
        part.mesh.geometry.dispose();
        part.material.dispose();
        globe.earthContent.remove(part.mesh);
      }
    },
  };
}
