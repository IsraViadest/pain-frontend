import type {
  LayersResponse,
  PainSubmission,
  PointsResponse,
  SubmissionResponse,
} from "../types/api";
import { apiUrl } from "./config";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Dev-only: local Express mock (server/) via Vite /api proxy. Not used in production builds. */
export async function fetchLayersMock(): Promise<LayersResponse> {
  const res = await fetch(apiUrl("/api/map/layers"));
  return parseJson<LayersResponse>(res);
}

export async function fetchPointsMock(layerId?: string): Promise<PointsResponse> {
  const q =
    layerId && layerId.length > 0
      ? `?layer=${encodeURIComponent(layerId)}`
      : "";
  const res = await fetch(apiUrl(`/api/map/points${q}`));
  return parseJson<PointsResponse>(res);
}

export async function submitPainMock(
  body: PainSubmission,
): Promise<SubmissionResponse> {
  const res = await fetch(apiUrl("/api/pain-submission"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<SubmissionResponse>(res);
}
