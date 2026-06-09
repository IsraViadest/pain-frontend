/** pain-server HTTP client — production data path (no /server, no CSV). */
import type { PainServerLayerRow, PainServerRow } from "../types/painServer";
import { apiUrl } from "./config";
import { parseInitLayerListResponse } from "./initLayerList";

/** Read `fetch` body as JSON; throw with status + body text if the HTTP response failed. */
async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Layer metadata from pain-server GET /init (id, label, desc, color, geospatial, text).
 * @see http://178.63.65.178:3000/init
 */
export async function fetchLayerInfo(): Promise<PainServerLayerRow[]> {
  const res = await fetch(apiUrl("/init"));
  const body = await parseJson<PainServerLayerRow[]>(res);
  if (!Array.isArray(body)) {
    throw new Error("Expected JSON array from GET /init");
  }
  const rows = parseInitLayerListResponse(body);
  if (rows.length === 0) {
    throw new Error("GET /init returned no valid layer rows");
  }
  return rows;
}

/**
 * Bulk layer points from pain-server (deployed backend).
 * @param layerId — layer id from GET /init (actual value defined by the API)
 */
export async function fetchLayerDataPoints(layerId: string): Promise<PainServerRow[]> {
  const res = await fetch(apiUrl(`/init/${encodeURIComponent(layerId)}`));
  const body = await parseJson<PainServerRow[]>(res);
  if (!Array.isArray(body)) {
    throw new Error("Expected JSON array from GET /init/:layer");
  }
  return body;
}
