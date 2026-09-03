/**
 * The wash and the outline that mark every country sharing the pain category you clicked.
 *
 * It marks the whole category rather than the one country because that is what the selection
 * means: clicking a label asks "who else feels this", and the answer is a set. The network, the
 * undimmed labels and this mark therefore all describe the same countries.
 *
 * Everything else about selection lives where it naturally belongs: the label layer receives the
 * click and emphasises its own labels, the arc layer decides which category network to show. This
 * owns only the one thing neither of them can draw, which is marked countries on the globe.
 *
 * IT BORROWS THE CHOROPLETH SHELL'S GEOMETRY RATHER THAN MAKING ITS OWN. In all-layers mode the
 * pain scars dent the globe inward, and GlobeView CPU-warps the choropleth shell's vertices to
 * follow them so the country colours stay on the surface. A fresh sphere at a fixed radius does
 * not, and the error is a parallax that grows with the angle from the view axis: measured with a
 * near-opaque wash at the gallery camera, Iran's mark sat clear of Iran, over Iraq and the Gulf.
 * Sharing the shell's geometry inherits the warp exactly and for free, and cannot drift from it,
 * which duplicating GlobeView's scar field could. Both meshes test depth and neither writes it,
 * so being coincident costs nothing and render order alone decides which is on top.
 *
 * The mesh is a child of `globe.earthContent`, so it spins with the globe for free, the same
 * arrangement the arc layer uses.
 */
import * as THREE from "three";
import type { GlobeView } from "../globe/GlobeView";
import {
  ensureChoroplethCountriesLoaded,
  createCountryHighlightTexture,
} from "../globe/choroplethField";
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";
import type { EmoSelectionMotion } from "./selectionMotion";

/** White covers the country's own colour; the warm tint adds to it. See `selectionStyle`. */
const WASH_COLOUR = "#ffffff";
const GLOW_COLOUR = "#ffe08a";

/**
 * The choropleth shell's signature in the scene graph, asserted rather than guessed.
 *
 * Three signals together, because each alone is ambiguous: the solid globe mesh is also a direct
 * child of `earthContent` with the same sphere tessellation, and is told apart by its render
 * order. If GlobeView ever changes any of them this throws, which is the point: silently missing
 * the shell would put the mark back on an unwarped sphere, and the symptom is a highlight that
 * looks merely a little off rather than an error.
 */
const SHELL_RENDER_ORDER = 1;
const SHELL_WIDTH_SEGMENTS = 192;
const SHELL_HEIGHT_SEGMENTS = 128;

/** Arrival fraction at which a country counts as marked. The mark has no in-between state. */
const ARRIVED_AT = 0.5;

export interface EmoSelectionLayer {
  /** Mark every country in this pain category, or clear the mark when passed null. */
  setSelectedCategory(cat: string | null): void;
  /**
   * Call once per frame. Repaints only when the set of countries the wavefront has reached
   * actually changes, which is at most once per depth step of the spread and never at all when
   * there is no spread running.
   */
  update(): void;
  setParams(next: EmoViewParams): void;
  destroy(): void;
}

function findChoroplethShellGeometry(globe: GlobeView): THREE.BufferGeometry {
  for (const child of globe.earthContent.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    if (child.renderOrder !== SHELL_RENDER_ORDER) continue;
    const parameters = (child.geometry as THREE.SphereGeometry).parameters as
      | { widthSegments?: number; heightSegments?: number }
      | undefined;
    if (parameters?.widthSegments !== SHELL_WIDTH_SEGMENTS) continue;
    if (parameters.heightSegments !== SHELL_HEIGHT_SEGMENTS) continue;
    return child.geometry;
  }
  throw new Error(
    "[emoSelection] No mesh in earthContent matches the choropleth shell (renderOrder " +
      `${SHELL_RENDER_ORDER}, ${SHELL_WIDTH_SEGMENTS} by ${SHELL_HEIGHT_SEGMENTS} sphere). ` +
      "The selection mark would silently go back to an unwarped sphere and sit clear of the " +
      "countries it marks. Re-read GlobeView's choroplethShell.",
  );
}

export async function createEmoSelectionLayer(options: {
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
  /** Read only for the wavefront, so a country is marked as the network reaches it. */
  motion: EmoSelectionMotion;
}): Promise<EmoSelectionLayer> {
  const { globe, data, motion } = options;
  let params = options.params;

  /** Which countries belong to each pain category, so a click resolves to a set in one lookup. */
  const membersByCategory = new Map<string, string[]>();
  for (const [iso3, country] of Object.entries(data.countries)) {
    const list = membersByCategory.get(country.cat) ?? [];
    list.push(iso3);
    membersByCategory.set(country.cat, list);
  }

  await ensureChoroplethCountriesLoaded();

  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  // Borrowed, not owned. destroy() must not dispose it; see the module docstring.
  const mesh = new THREE.Mesh(findChoroplethShellGeometry(globe), material);
  mesh.renderOrder = 2;
  mesh.visible = false;
  globe.earthContent.add(mesh);

  let selectedCat: string | null = null;
  /**
   * How many of the category's countries the last painted texture covered, or -1 to force a
   * repaint. The count is enough of a key because arrival is monotone within one sweep: a
   * country the wave has reached never becomes unreached before the next selection.
   */
  let paintedCount = -1;

  /** The countries of the selected category the wavefront has already reached. */
  function arrivedMembers(): string[] {
    if (selectedCat === null) return [];
    const members = membersByCategory.get(selectedCat) ?? [];
    return members.filter((iso3) => motion.arrivalOf(iso3) >= ARRIVED_AT);
  }

  function paint(): void {
    material.map?.dispose();
    material.map = null;
    const members = arrivedMembers();
    paintedCount = members.length;
    const glow = params.selectionStyle === "glow";
    const texture =
      members.length === 0
        ? null
        : createCountryHighlightTexture(
            members,
            glow ? GLOW_COLOUR : WASH_COLOUR,
            params.selectionFill,
            params.selectionOutline,
          );
    material.map = texture;
    // Adding warm light brightens the country's own choropleth colour instead of covering it.
    material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    // Microstates have a label point and no polygon, so a category made only of them yields null,
    // as does asking for neither a fill nor an outline.
    mesh.visible = texture !== null;
    material.needsUpdate = true;
  }

  return {
    setSelectedCategory(cat: string | null): void {
      if (cat === selectedCat) return;
      selectedCat = cat;
      paintedCount = -1;
      paint();
    },
    update(): void {
      if (selectedCat === null) return;
      if (arrivedMembers().length === paintedCount) return;
      paint();
    },
    setParams(next: EmoViewParams): void {
      const markChanged =
        next.selectionFill !== params.selectionFill ||
        next.selectionOutline !== params.selectionOutline ||
        next.selectionStyle !== params.selectionStyle;
      // A changed spread duration changes which countries count as reached, and nothing else here
      // would notice: the member list and the mark's own look are both unchanged. Compared before
      // the assignment, or it would be comparing the new parameters with themselves.
      const spreadChanged = next.selectionSpreadMs !== params.selectionSpreadMs;
      params = next;
      if (spreadChanged) paintedCount = -1;
      if (markChanged && selectedCat !== null) paint();
    },
    destroy(): void {
      material.map?.dispose();
      material.dispose();
      globe.earthContent.remove(mesh);
    },
  };
}
