import type { PainPoint, PainSubmission } from "../src/types/api";
import { apiUrl } from "../src/api/config";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Dev-only points from local mock server (`server/` + Vite `/api` proxy). */
export async function fetchPointsMock(layerId?: string): Promise<PainPoint[]> {
  const q =
    layerId && layerId.length > 0
      ? `?layer=${encodeURIComponent(layerId)}`
      : "";
  const res = await fetch(apiUrl(`/api/map/points${q}`));
  const body = await parseJson<{ points: PainPoint[] }>(res);
  return body.points;
}

/** Dev-only POST to local mock server. */
export async function submitPainMock(body: PainSubmission): Promise<PainPoint> {
  const res = await fetch(apiUrl("/api/pain-submission"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseJson<{ point: PainPoint }>(res);
  return payload.point;
}
