/**
 * Single API facade for the UI.
 *
 * Production (`npm run build`, VITE_USE_MOCK_API unset/false):
 *   fetchLayers → painServer.fetchLayerInfo → GET /init
 *   fetchPoints → painServer.fetchLayerDataPoints → GET /init/:layer → adapter
 *
 * Dev mock (`npm run dev`):
 *   fetchLayers → mock/loadMapLayers (dynamic import)
 *   fetchPoints → mockClient (local Express + CSV; not shipped in dist)
 */
import type { MapLayer, PainPoint } from "../types/api";
import { mapInitResponseToPainPoints } from "./adapter";
import { useMockApi } from "./config";
import { isLayerCacheEmpty, setCachedMapLayers } from "./layers";
import { fetchLayerDataPoints, fetchLayerInfo } from "./painServer";
import { getPainServerUserId } from "./session";

type MockApiModule = {
  fetchPointsMock: (layerId?: string) => Promise<PainPoint[]>;
};

let mockApiModulePromise: Promise<MockApiModule> | null = null;

/** Load dev-only mock client on demand (keeps production path free of mock imports). */
async function getMockApiModule(): Promise<MockApiModule> {
  if (!import.meta.env.DEV) {
    throw new Error(
      "Mock API is dev-only. Use pain-server mode for production builds.",
    );
  }
  if (mockApiModulePromise == null) {
    const modulePath = "/dev/mockClient.ts";
    mockApiModulePromise = import(/* @vite-ignore */ modulePath) as Promise<MockApiModule>;
  }
  return mockApiModulePromise;
}

/** Load dev-only mock layer list on demand (see `mock/loadMapLayers.ts`). */
async function getMockMapLayers(): Promise<MapLayer[]> {
  if (!import.meta.env.DEV) {
    throw new Error(
      "Mock layer list is dev-only. Use pain-server mode for production builds.",
    );
  }
  const { loadMockMapLayers } = await import(/* @vite-ignore */ "../../mock/loadMapLayers");
  return loadMockMapLayers();
}

/**
 * Layer list for the HUD — GET /init in production; dynamic mock import in dev mock mode.
 *
 * **Call order:** The UI must call `fetchLayers` before `fetchPoints` so
 * {@link setCachedMapLayers} runs first (HUD labels, colors, and adapter `metadata.layerLabel`).
 */
export async function fetchLayers(): Promise<MapLayer[]> {
  if (useMockApi) {
    const layers = await getMockMapLayers();
    setCachedMapLayers(layers);
    return layers;
  } else {
    const layers = await fetchLayerInfo();
    setCachedMapLayers(layers);
    return layers;
  }
}

/**
 * Load pain points for the selected layer id.
 * Production: GET /init/:layerId via {@link fetchLayerDataPoints}.
 *
 * @param signal — optional abort signal so a layer switch can cancel an in-flight fetch.
 */
export async function fetchPoints(
  layerId?: string,
  signal?: AbortSignal,
): Promise<PainPoint[]> {
  if (useMockApi) {
    const { fetchPointsMock } = await getMockApiModule();
    return fetchPointsMock(layerId);
  }
  if (!layerId || layerId.length === 0) {
    console.warn(
      "[client] fetchPoints called without a layerId — returning empty points. UI should always pass a known layer.",
    );
    return [];
  }
  if (isLayerCacheEmpty()) {
    throw new Error(
      "[client] fetchPoints called before fetchLayers — layer cache is empty. Call fetchLayers first.",
    );
  }
  if (getPainServerUserId().length === 0) {
    console.warn(
      "[client] fetchPoints without a cached pain-server userId — call fetchLayers first.",
    );
  }
  const initLayerRows = await fetchLayerDataPoints(layerId, signal);
  return mapInitResponseToPainPoints(initLayerRows, layerId);
}
