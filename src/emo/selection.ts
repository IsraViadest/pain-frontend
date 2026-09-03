/**
 * The wash that fills every country sharing the pain category you clicked.
 *
 * It fills the whole category rather than the one country because that is what the selection
 * means: clicking a label asks "who else feels this", and the answer is a set. The network, the
 * undimmed labels and this wash therefore all describe the same countries.
 *
 * Everything else about selection lives where it naturally belongs: the label layer receives the
 * click and dims its own labels, the arc layer decides which category network to show. This owns
 * only the one thing neither of them can draw, which is filled countries on the globe.
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

/** Just above the choropleth shell at 1.001, so the two cannot z-fight. */
const HIGHLIGHT_RADIUS = 1.0025;
const HIGHLIGHT_COLOUR = "#ffffff";

export interface EmoSelectionLayer {
  /** Fill every country in this pain category, or clear the fill when passed null. */
  setSelectedCategory(cat: string | null): void;
  setParams(next: EmoViewParams): void;
  destroy(): void;
}

export async function createEmoSelectionLayer(options: {
  globe: GlobeView;
  data: EmoData;
  params: EmoViewParams;
}): Promise<EmoSelectionLayer> {
  const { globe, data } = options;
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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(HIGHLIGHT_RADIUS, 96, 48), material);
  mesh.renderOrder = 2;
  mesh.visible = false;
  globe.earthContent.add(mesh);

  let selectedCat: string | null = null;

  function paint(): void {
    material.map?.dispose();
    material.map = null;
    const members = selectedCat === null ? [] : membersByCategory.get(selectedCat) ?? [];
    if (members.length === 0) {
      mesh.visible = false;
      material.needsUpdate = true;
      return;
    }
    const texture = createCountryHighlightTexture(members, HIGHLIGHT_COLOUR, params.selectionFill);
    material.map = texture;
    // Microstates have a label point and no polygon, so a category made only of them yields null.
    mesh.visible = texture !== null;
    material.needsUpdate = true;
  }

  return {
    setSelectedCategory(cat: string | null): void {
      if (cat === selectedCat) return;
      selectedCat = cat;
      paint();
    },
    setParams(next: EmoViewParams): void {
      const fillChanged = next.selectionFill !== params.selectionFill;
      params = next;
      if (fillChanged && selectedCat !== null) paint();
    },
    destroy(): void {
      material.map?.dispose();
      material.dispose();
      mesh.geometry.dispose();
      globe.earthContent.remove(mesh);
    },
  };
}
