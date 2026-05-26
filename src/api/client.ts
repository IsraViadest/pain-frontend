/**
 * Single API facade for the UI.
 *
 * Production (`npm run build`, VITE_USE_MOCK_API unset/false):
 *   fetchPoints → painServer.fetchInitLayer → GET /init/:layer → adapter
 *
 * Dev mock (`npm run dev`):
 *   fetchPoints → mockClient (local Express + CSV; not shipped in dist)
 */
import type {
  LayersResponse,
  PainSubmission,
  PointsResponse,
  SubmissionResponse,
} from "../types/api";
import { mapInitResponseToPainPoints } from "./adapter";
import { useMockApi } from "./config";
import { UI_MAP_LAYERS } from "./layers";
import {
  fetchLayersMock,
  fetchPointsMock,
  submitPainMock,
} from "./mockClient";
import { fetchInitLayer } from "./painServer";

/** Layer list for the HUD (static labels in prod until GET /layers exists). */
export async function fetchLayers(): Promise<LayersResponse> {
  if (useMockApi) {
    return fetchLayersMock();
  }
  return { layers: UI_MAP_LAYERS };
}

/**
 * Load pain points for the selected UI layer id.
 * Production: GET /init/:apiLayer via {@link fetchInitLayer}.
 */
export async function fetchPoints(layerId?: string): Promise<PointsResponse> {
  if (useMockApi) {
    return fetchPointsMock(layerId);
  }
  if (!layerId || layerId.length === 0) {
    return { points: [] };
  }
  const raw = await fetchInitLayer(layerId);
  const points = mapInitResponseToPainPoints(raw);
  return { points };
}

/** Dev mock only until pain-server exposes a submission endpoint. */
export async function submitPain(
  body: PainSubmission,
): Promise<SubmissionResponse> {
  if (!useMockApi) {
    throw new Error(
      "Pain submission is not wired to pain-server yet. Use mock dev mode or wait for the backend submission API.",
    );
  }
  return submitPainMock(body);
}
