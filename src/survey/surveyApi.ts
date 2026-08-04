/**
 * Survey API client — POST payloads to Mike's endpoint and emit metrics events.
 */
import { apiUrl, useMockApi } from "../api/config";
import { getPainServerUserId } from "../api/session";
import type { SurveySubmissionPayload } from "./surveyData";

type SurveySubmissionResult = {
  lat: number;
  lng: number;
  text: string;
};

function isSurveySubmissionResult(value: unknown): value is SurveySubmissionResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.lat === "number" &&
    Number.isFinite(obj.lat) &&
    typeof obj.lng === "number" &&
    Number.isFinite(obj.lng) &&
    typeof obj.text === "string"
  );
}

/**
 * POST `/survey` to pain-server; returns `{ lat, lng, text }` on success.
 *
 * Mock-safe: when `useMockApi` is true, returns fake coordinates and text.
 * Never throws: logs `console.warn` on any failure and returns `null`.
 *
 * Assumption: pain-server responds with JSON `{ lat: number, lng: number, text: string }`.
 */
export async function submitSurvey(
  payload: SurveySubmissionPayload,
): Promise<SurveySubmissionResult | null> {
  if (useMockApi) {
    return {
      lat: 48.2,
      lng: 16.37,
      text: "Mock submission (dev mode)",
    };
  }

  try {
    const res = await fetch(apiUrl("/survey"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        userId: getPainServerUserId(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[surveyApi] POST /survey failed: ${res.status} ${res.statusText}: ${text}`);
      return null;
    }
    const body = (await res.json()) as unknown;
    if (!isSurveySubmissionResult(body)) {
      console.warn(
        "[surveyApi] POST /survey returned unexpected JSON (expected { lat:number, lng:number, text:string })",
        body,
      );
      return null;
    }
    return body;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[surveyApi] POST /survey threw: ${msg}`);
    return null;
  }
}

