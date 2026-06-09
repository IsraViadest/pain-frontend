/**
 * Dev mock layer list loader — dynamic import of {@link MOCK_LAYERS} for HUD `fetchLayers`.
 * Not used in production (`npm run build` / pain-server mode).
 */
import type { MapLayer } from "../src/types/api";
import type { MockLayerFixture } from "./layers";

function mapMockLayersToMapLayers(mockLayers: readonly MockLayerFixture[]): MapLayer[] {
  return mockLayers.map(({ id, label, desc, color, geospatial, text }) => ({
    id,
    label,
    desc,
    color,
    geospatial,
    text,
  }));
}

let mockMapLayersPromise: Promise<MapLayer[]> | null = null;

/**
 * Load HUD layer list for dev mock mode (`MOCK_LAYERS` fixture).
 * Cached after first successful load.
 */
export function loadMockMapLayers(): Promise<MapLayer[]> {
  if (mockMapLayersPromise == null) {
    mockMapLayersPromise = import("./layers")
      .then(({ MOCK_LAYERS }) => mapMockLayersToMapLayers(MOCK_LAYERS))
      .catch((err: unknown) => {
        console.error("[mock] Failed to load mock layer fixture:", err);
        return [];
      });
  }
  return mockMapLayersPromise;
}
