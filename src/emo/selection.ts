/**
 * The wash that fills the country you clicked.
 *
 * Everything else about selection lives where it naturally belongs: the label layer receives the
 * click and dims its own labels, the arc layer decides which category network to show. This owns
 * only the one thing neither of them can draw, which is a filled country on the globe.
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
import type { EmoViewParams } from "./viewParams";

/** Just above the choropleth shell at 1.001, so the two cannot z-fight. */
const HIGHLIGHT_RADIUS = 1.0025;
const HIGHLIGHT_COLOUR = "#ffffff";

export interface EmoSelectionLayer {
  /** Fill this country, or clear the fill when passed null. */
  setSelected(iso3: string | null): void;
  setParams(next: EmoViewParams): void;
  destroy(): void;
}

export async function createEmoSelectionLayer(options: {
  globe: GlobeView;
  params: EmoViewParams;
}): Promise<EmoSelectionLayer> {
  const { globe } = options;
  let params = options.params;

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

  let selected: string | null = null;

  function paint(): void {
    material.map?.dispose();
    material.map = null;
    if (selected === null) {
      mesh.visible = false;
      material.needsUpdate = true;
      return;
    }
    const texture = createCountryHighlightTexture(selected, HIGHLIGHT_COLOUR, params.selectionFill);
    material.map = texture;
    // A microstate can have a label point and no polygon, so a null texture is expected.
    mesh.visible = texture !== null;
    material.needsUpdate = true;
  }

  return {
    setSelected(iso3: string | null): void {
      if (iso3 === selected) return;
      selected = iso3;
      paint();
    },
    setParams(next: EmoViewParams): void {
      const fillChanged = next.selectionFill !== params.selectionFill;
      params = next;
      if (fillChanged && selected !== null) paint();
    },
    destroy(): void {
      material.map?.dispose();
      material.dispose();
      mesh.geometry.dispose();
      globe.earthContent.remove(mesh);
    },
  };
}
