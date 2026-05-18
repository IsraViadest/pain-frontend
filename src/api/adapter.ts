import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import {
  mapPainOriginToUiLayer,
  resolvePainServerCoordinates,
} from "./coordinates";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isPainServerRow(row: unknown): row is PainServerRow {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    asNumber(r.id) !== null &&
    (asNumber(r.x) !== null || asNumber(r.lng) !== null) &&
    (asNumber(r.y) !== null || asNumber(r.lat) !== null) &&
    asNumber(r.value) !== null
  );
}

/**
 * Maps pain-server GET /init/:layer JSON (array of DB rows) → app PainPoint[].
 * Texture x/y (1000×482 grid) are converted to lat/lng for the globe; see coordinates.ts.
 */
export function mapInitResponseToPainPoints(data: unknown): PainPoint[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected an array from GET /init/:layer");
  }

  const points: PainPoint[] = [];
  let skipped = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!isPainServerRow(row)) {
      console.warn("[adapter] Skipping row with unexpected shape at index", i, row);
      skipped++;
      continue;
    }
    const point = mapRow(row, i);
    if (point) points.push(point);
    else skipped++;
  }
  if (skipped > 0) {
    console.warn(`[adapter] Skipped ${skipped} row(s) with unmapped coordinates`);
  }
  return points;
}

function mapRow(row: PainServerRow, index: number): PainPoint | null {
  const coords = resolvePainServerCoordinates(row);
  if (!coords) {
    console.warn("[adapter] Unmapped coordinates for row", row.id, row);
    return null;
  }

  const painorigin = String(row.painorigin ?? "unknown");
  const datatype = String(row.datatype ?? "unknown");
  const value = asNumber(row.value) ?? 0;
  const id = String(row.id ?? `pain-server-${index}`);
  const type = mapPainOriginToUiLayer(painorigin);

  return {
    id,
    lat: coords.lat,
    lng: coords.lng,
    type,
    intensity: clamp01(value),
    element: datatype,
    text: `${datatype} · ${painorigin}`,
    metadata: {
      country: "PPP map record",
      layerLabel: type,
      metricLabel: datatype,
      rawValue: value,
      sourceUrl: "",
    },
    createdAt: new Date().toISOString(),
  };
}
