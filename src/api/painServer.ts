/** pain-server HTTP client — production data path (no /server, no CSV). */
import { apiUrl } from "./config";
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
 * Bulk layer points from pain-server (deployed backend).
 * @param uiLayerId — value from the layer select (e.g. environmental)
 */
export async function fetchInitLayer(uiLayerId: string): Promise<unknown> {
  const apiLayer = uiLayerIdToApiLayer(uiLayerId);
  const res = await fetch(apiUrl(`/init/${encodeURIComponent(apiLayer)}`));
  return parseJson<unknown>(res);
}
