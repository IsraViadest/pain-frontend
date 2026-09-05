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
  hasCountryGeometry,
} from "../globe/choroplethField";
import { ensureCountryCentroidsLoaded, getCountryCentroid } from "../api/countryCentroids";
import type { EmoData } from "./emoData";
import type { EmoViewParams } from "./viewParams";
import type { EmoSelectionMotion } from "./selectionMotion";

/** White covers the country's own colour; the warm tint adds to it. See `selectionStyle`. */
const WASH_COLOUR = "#ffffff";
const GLOW_COLOUR = "#ffe08a";

/** Arrival fraction at which a country counts as marked. The mark has no in-between state. */
const ARRIVED_AT = 0.5;

/**
 * IT FOLLOWS THE LEADER LINE, NOT THE NETWORK. The operator's order is that the arc reaches a
 * country, its leader line then comes down from its word to claim it, and only once that line is
 * there does the country light up. `markArrivalOf` is the wavefront pushed back by exactly one
 * leader's growth, and with no lead-in configured it is the wavefront itself, which is what every
 * preset before round v10 marked on.
 */

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
  // The label points, for the countries the polygons do not cover. Same source the labels, the
  // arcs and the leader lines use, so a disc lands exactly where the line that reached it ends.
  await ensureCountryCentroidsLoaded();

  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  // Borrowed, not owned. destroy() must not dispose it; see the module docstring.
  const mesh = new THREE.Mesh(globe.getCountrySurfaceGeometry(), material);
  mesh.renderOrder = 2;
  mesh.visible = false;
  globe.earthContent.add(mesh);

  let selectedCat: string | null = null;
  /**
   * A count of the marked countries per category the last painted texture covered, or null to
   * force a repaint.
   *
   * NULL RATHER THAN THE EMPTY STRING, because the empty string is a real key: it is what nothing
   * marked produces, which is exactly the state a cleared selection has to reach. A sentinel that
   * a real state can also produce is not a dirty flag, and here it would have left the last mark
   * painted on the globe after the selection was cleared.
   *
   * A count is enough of a key because arrival is monotone within one wave: a country a wave has
   * reached never becomes unreached while that wave runs, in either direction. It has to be a
   * count PER CATEGORY rather than one total, because a category being taken apart and a category
   * being built can be on screen together, and one losing a country while the other gains one
   * leaves a single total unchanged over two different sets.
   */
  let paintedKey: string | null = null;
  let paintedGeography = globe.getDisplayCountryGeometries();

  /** Every category with a mark on screen: the chosen one, and any still taking itself apart. */
  function markedCategories(): string[] {
    const cats = selectedCat === null ? [] : [selectedCat];
    for (const cat of motion.retreatingCategories()) {
      if (!cats.includes(cat)) cats.push(cat);
    }
    return cats;
  }

  /** The countries currently marked, and the key that says whether that set has changed. */
  function arrivedMembers(): { members: string[]; key: string } {
    const members: string[] = [];
    let key = "";
    for (const cat of markedCategories()) {
      let count = 0;
      for (const iso3 of membersByCategory.get(cat) ?? []) {
        if (motion.markArrivalOf(iso3) < ARRIVED_AT) continue;
        members.push(iso3);
        count += 1;
      }
      key += `${cat}:${count}|`;
    }
    return { members, key };
  }

  function paint(): void {
    material.map?.dispose();
    material.map = null;
    const { members, key } = arrivedMembers();
    paintedKey = key;
    paintedGeography = globe.getDisplayCountryGeometries();
    const glow = params.selectionStyle === "glow";
    // Split rather than filtered afterwards: a country either has a polygon to fill or a point to
    // put a disc at, and asking `hasCountryGeometry` is what keeps the two lists from overlapping
    // or from leaving a country in neither.
    const discs: { lat: number; lng: number }[] = [];
    for (const iso3 of members) {
      if (hasCountryGeometry(iso3)) continue;
      const centroid = getCountryCentroid(iso3);
      if (centroid) discs.push({ lat: centroid.lat, lng: centroid.lng });
    }
    const texture =
      members.length === 0
        ? null
        : createCountryHighlightTexture(
            members,
            glow ? GLOW_COLOUR : WASH_COLOUR,
            params.selectionFill,
            params.selectionOutline,
            discs,
            params.selectionMarkerDeg,
            paintedGeography,
          );
    material.map = texture;
    // Adding warm light brightens the country's own choropleth colour instead of covering it.
    material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    // A category made only of countries with no polygon yields null while `selectionMarkerDeg` is
    // 0, as does asking for neither a fill nor an outline.
    mesh.visible = texture !== null;
    material.needsUpdate = true;
  }

  return {
    setSelectedCategory(cat: string | null): void {
      if (cat === selectedCat) return;
      selectedCat = cat;
      // No repaint here. update() runs on the next frame and paints whatever is actually marked,
      // which now includes a category that has stopped being chosen and is still on screen while
      // it takes its mark off country by country. Clearing here would remove it in one step.
      paintedKey = null;
    },
    update(): void {
      // The key alone decides. Recomputing the members costs a pass over one category's country
      // list and happens only on the frames the mark actually changes, which is at most once per
      // depth step of a spread and never at all when nothing is moving.
      if (arrivedMembers().key === paintedKey &&
          paintedGeography === globe.getDisplayCountryGeometries()) return;
      paint();
    },
    setParams(next: EmoViewParams): void {
      const markChanged =
        next.selectionFill !== params.selectionFill ||
        next.selectionOutline !== params.selectionOutline ||
        next.selectionMarkerDeg !== params.selectionMarkerDeg ||
        next.selectionStyle !== params.selectionStyle;
      // A changed spread duration changes which countries count as reached, and nothing else here
      // would notice: the member list and the mark's own look are both unchanged. Compared before
      // the assignment, or it would be comparing the new parameters with themselves.
      const spreadChanged =
        next.selectionSpreadMs !== params.selectionSpreadMs ||
        next.selectionLeaderMs !== params.selectionLeaderMs;
      params = next;
      if (spreadChanged) paintedKey = null;
      if (markChanged && selectedCat !== null) paint();
    },
    destroy(): void {
      material.map?.dispose();
      material.dispose();
      globe.earthContent.remove(mesh);
    },
  };
}
