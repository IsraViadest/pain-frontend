/** pain-server HTTP client — production data path (no /server, no CSV). */
import type { PainServerLayerRow, PainServerRow } from "../types/painServer";
import { apiUrl } from "./config";
import { parseInitLayerListResponse } from "./initLayerList";
import { uiLayerIdToApiLayer } from "./layers";

/** Read `fetch` body as JSON; throw with status + body text if the HTTP response failed. */
async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Layer metadata from pain-server GET /init/ (id, label, desc, color, geospatial, text).
 * @see http://178.63.65.178:3000/init/
 */
export async function fetchInitLayerList(): Promise<PainServerLayerRow[]> {
  const res = await fetch(apiUrl("/init/"));
  const body = await parseJson<unknown[]>(res);
  if (!Array.isArray(body)) {
    throw new Error("Expected JSON array from GET /init/");
  }
  const rows = parseInitLayerListResponse(body);
  if (rows.length === 0) {
    throw new Error("GET /init/ returned no valid layer rows");
  }
  return rows;
}

/**
 * Bulk layer points from pain-server (deployed backend).
 * @param layerId — id from GET /init/ (e.g. Env, Emo)
 */
export async function fetchInitLayer(layerId: string): Promise<PainServerRow[]> {
  const apiLayer = uiLayerIdToApiLayer(layerId);
  const res = await fetch(apiUrl(`/init/${encodeURIComponent(apiLayer)}`));
  const body = await parseJson<PainServerRow[]>(res);
  if (!Array.isArray(body)) {
    throw new Error("Expected JSON array from GET /init/:layer");
  }
  return body;
}
