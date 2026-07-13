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
import type { MapLayer, PainPoint, PainSubmission } from "../types/api";
import { mapInitResponseToPainPoints } from "./adapter";
import { useMockApi } from "./config";
import { mapInitLayerListToMapLayers } from "./initLayerList";
import { isLayerCacheEmpty, setCachedMapLayers } from "./layers";
import { fetchLayerDataPoints, fetchLayerInfo } from "./painServer";
import { getPainServerUserId } from "./session";

type MockApiModule = {
  fetchPointsMock: (layerId?: string) => Promise<PainPoint[]>;
  submitPainMock: (body: PainSubmission) => Promise<PainPoint>;
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
    const rows = await fetchLayerInfo();
    const layers = mapInitLayerListToMapLayers(rows);
    setCachedMapLayers(layers);
    return layers;
  }
}

/**
 * Load pain points for the selected layer id.
 * Production: GET /init/:layerId via {@link fetchLayerDataPoints}.
 */
export async function fetchPoints(layerId?: string): Promise<PainPoint[]> {
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
  const initLayerRows = await fetchLayerDataPoints(layerId);
  return mapInitResponseToPainPoints(initLayerRows, layerId);
}

/** Dev mock only until pain-server exposes a submission endpoint. */
export async function submitPain(body: PainSubmission): Promise<PainPoint> {
  if (!useMockApi) {
    throw new Error(
      "Pain submission is not wired to pain-server yet. Use mock dev mode or wait for the backend submission API.",
    );
  }
  const { submitPainMock } = await getMockApiModule();
  return submitPainMock(body);
}
