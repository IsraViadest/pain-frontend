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
import { emoCategoryShells, emoLabelStandoff, emoZoomRamp } from "./layout";
import { applyEmoFacingFade, makeEmoFadeUniform, updateEmoFadeUniform } from "./facingFade";

/** Clear of the choropleth at 1.001 and the selection wash at 1.0025, so nothing z-fights. */
const FOOT_RADIUS = 1.004;

/**
 * How far below the label's own radius the line stops, in globe radii. At the gallery camera the
 * globe is about 543 screen pixels across its radius, so this lands the tip roughly at the text's
 * lower edge rather than through the middle of it.
 */
const HEAD_GAP = 0.012;

/** Rebuild only when the head has moved by more than this, which a still camera never does. */
const REBUILD_EPSILON = 1e-4;

interface LeaderNode {
  dir: THREE.Vector3;
  shell: number;
}

export interface EmoLeaderLineLayer {
  /** Call once per frame. Rebuilds only when the zoom ramp has actually moved the label heads. */
  update(): void;
  setParams(next: EmoViewParams): void;
  /** Whether the emotional views own the globe right now, independent of the `leaderLines` flag. */
  setVisible(visible: boolean): void;
  destroy(): void;
}

export async function createEmoLeaderLineLayer(options: {
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
}): Promise<EmoLeaderLineLayer> {
  const { globe, data } = options;
  let params = options.params;

  await ensureCountryCentroidsLoaded();

  const categoryShell = emoCategoryShells(data);
  const nodes: LeaderNode[] = [];
  for (const [iso3, country] of Object.entries(data.countries)) {
    const centroid = getCountryCentroid(iso3);
    if (!centroid) continue;
    nodes.push({
      dir: latLngToVector3(centroid.lat, centroid.lng, 1).normalize(),
      shell: categoryShell.get(country.cat) ?? 0,
    });
  }

  const resolution = new THREE.Vector2(1, 1);
  const fadeUniform = makeEmoFadeUniform(params);
  const material = new LineMaterial({
    color: 0xffffff,
    linewidth: params.arcWidth,
    worldUnits: true,
    resolution,
    transparent: true,
    opacity: params.arcOpacity,
    depthTest: true,
    depthWrite: false,
  });
  applyEmoFacingFade(material, fadeUniform);

  // setPositions keeps a Float32Array by reference rather than copying it, so this array stays
  // the geometry's own storage and a rebuild is a write plus a needsUpdate rather than an alloc.
  const positions = new Float32Array(nodes.length * 6);
  const geometry = new LineSegmentsGeometry();
  const mesh = new LineSegments2(geometry, material);
  mesh.name = "emo-leader-lines";
  mesh.renderOrder = 3;
  globe.earthContent.add(mesh);

  let built = false;
  let lastStandoff = Number.NaN;
  let lastSpread = Number.NaN;

  function rebuild(standoff: number): void {
    for (let i = 0; i < nodes.length; i++) {
      const { dir, shell } = nodes[i]!;
      const head = Math.max(FOOT_RADIUS, standoff + shell * params.multiplexSpread - HEAD_GAP);
      const o = i * 6;
      positions[o] = dir.x * FOOT_RADIUS;
      positions[o + 1] = dir.y * FOOT_RADIUS;
      positions[o + 2] = dir.z * FOOT_RADIUS;
      positions[o + 3] = dir.x * head;
      positions[o + 4] = dir.y * head;
      positions[o + 5] = dir.z * head;
    }
    if (built) {
      // instanceStart and instanceEnd are two views on one interleaved buffer, so flagging the
      // buffer once uploads both ends of every segment.
      (geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate =
        true;
    } else {
      geometry.setPositions(positions);
      built = true;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    lastStandoff = standoff;
    lastSpread = params.multiplexSpread;
  }

  function syncVisibility(layerVisible: boolean): void {
    mesh.visible = layerVisible && params.leaderLines === "on";
  }

  let visible = true;
  syncVisibility(visible);

  return {
    update(): void {
      const canvas = globe.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (w !== resolution.x || h !== resolution.y) {
        resolution.set(w, h);
        material.resolution.copy(resolution);
      }
      if (!mesh.visible && built) return;
      const standoff = emoLabelStandoff(emoZoomRamp(globe.camera.position.length(), params), params);
      if (
        !built ||
        Math.abs(standoff - lastStandoff) > REBUILD_EPSILON ||
        params.multiplexSpread !== lastSpread
      ) {
        rebuild(standoff);
      }
    },
    setParams(next: EmoViewParams): void {
      params = next;
      updateEmoFadeUniform(fadeUniform, next);
      material.linewidth = next.arcWidth;
      material.opacity = next.arcOpacity;
      syncVisibility(visible);
    },
    setVisible(next: boolean): void {
      visible = next;
      syncVisibility(visible);
    },
    destroy(): void {
      geometry.dispose();
      material.dispose();
      globe.earthContent.remove(mesh);
    },
  };
}
