/** pain-server HTTP client — production data path (no /server, no CSV). */
import type { MapLayer } from "../types/api";
import type {
  PainServerInitResponse,
  PainServerRow,
} from "../types/painServer";
import { apiUrl } from "./config";
import { parseInitLayerListResponse } from "./initLayerList";
import { clearPainServerUserId, setPainServerUserId } from "./session";

const INIT_ENVELOPE_ERROR = "expected { userId, layerInfo } from GET /init";

/** Read `fetch` body as JSON; throw with status + body text if the HTTP response failed. */
async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Layer metadata from pain-server GET /init (`userId` + `layerInfo` envelope).
 * Caches `userId` via {@link setPainServerUserId}; returns validated {@link MapLayer}s.
 * @see http://178.63.65.178:3000/init
 */
export async function fetchLayerInfo(): Promise<MapLayer[]> {
  clearPainServerUserId();
  const res = await fetch(apiUrl("/init"));
  const body = await parseJson<unknown>(res);
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(INIT_ENVELOPE_ERROR);
  }
  const envelope = body as Record<string, unknown>;
  const rawUserId = envelope.userId;
  const rawLayerInfo = envelope.layerInfo;
  if (typeof rawUserId !== "string") {
    throw new Error(INIT_ENVELOPE_ERROR);
  }
  if (!Array.isArray(rawLayerInfo)) {
    throw new Error(INIT_ENVELOPE_ERROR);
  }
  const userId = rawUserId.trim();
  if (userId.length === 0) {
    console.warn("[painServer] GET /init returned empty userId after trim");
  }
  const layerInfo = parseInitLayerListResponse(rawLayerInfo);
  if (layerInfo.length === 0) {
    throw new Error("GET /init returned no valid layer rows");
  }
  const initResponse: PainServerInitResponse = { userId, layerInfo };
  setPainServerUserId(initResponse.userId);
  return initResponse.layerInfo;
}

/**
 * Bulk layer points from pain-server (deployed backend).
 * @param layerId — layer id from GET /init (actual value defined by the API)
 * @param signal — optional abort (layer switch cancels the previous GET /init/:layer)
 */
export async function fetchLayerDataPoints(
  layerId: string,
  signal?: AbortSignal,
): Promise<PainServerRow[]> {
  const res = await fetch(apiUrl(`/init/${encodeURIComponent(layerId)}`), {
    signal,
  });
  const body = await parseJson<PainServerRow[]>(res);
  if (!Array.isArray(body)) {
    throw new Error("Expected JSON array from GET /init/:layer");
  }
  return body;
}
