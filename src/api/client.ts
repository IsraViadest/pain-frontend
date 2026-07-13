/**
 * Single API facade for the UI.
 *
 * Production (`npm run build`, VITE_USE_MOCK_API unset/false):
 *   fetchPoints → painServer.fetchInitLayer → GET /init/:layer → adapter
 *
 * Dev mock (`npm run dev`):
 *   fetchPoints → mockClient (local Express + CSV; not shipped in dist)
 */
import type { MapLayer, PainPoint, PainSubmission } from "../types/api";
import { mapInitResponseToPainPoints } from "./adapter";
import { useMockApi } from "./config";
import { UI_MAP_LAYERS } from "./layers";
import { fetchInitLayer } from "./painServer";

type MockApiModule = {
  fetchLayersMock: () => Promise<MapLayer[]>;
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

/** Layer list for the HUD (static labels in prod until GET /layers exists). */
export async function fetchLayers(): Promise<MapLayer[]> {
  if (useMockApi) {
    const { fetchLayersMock } = await getMockApiModule();
    return fetchLayersMock();
  }
  return UI_MAP_LAYERS;
}

/**
 * Load pain points for the selected UI layer id.
 * Production: GET /init/:apiLayer via {@link fetchInitLayer}.
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
  const raw = await fetchInitLayer(layerId);
  return mapInitResponseToPainPoints(raw);
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
