import type { PainPoint } from "../types/api";
import { mapPainOriginToUiLayer, resolvePainServerCoordinates } from "./coordinates";
import {
  isPainServerRow,
  normalizePainServerRow,
} from "./painServerRow";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Maps pain-server GET /init/:layer → PainPoint[] (lat/lng on the globe).
 */
export function mapInitResponseToPainPoints(data: unknown): PainPoint[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected an array from GET /init/:layer");
  }

  const points: PainPoint[] = [];
  let skipped = 0;
  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    if (!isPainServerRow(raw)) {
      console.warn("[adapter] Skipping row with unexpected shape at index", i, raw);
      skipped++;
      continue;
    }
    const row = normalizePainServerRow(raw)!;
    const point = mapRow(row, i);
    if (point) points.push(point);
    else skipped++;
  }
  if (skipped > 0) {
    console.warn(`[adapter] Skipped ${skipped} row(s) with unmapped coordinates`);
  }
  return points;
}

function mapRow(
  row: NonNullable<ReturnType<typeof normalizePainServerRow>>,
  index: number,
): PainPoint | null {
  const coords = resolvePainServerCoordinates(row);
  if (!coords) {
    console.warn("[adapter] Unmapped coordinates for row", row.id, row);
    return null;
  }

  const { datatype, painorigin, value, id } = row;
  const type = mapPainOriginToUiLayer(painorigin);

  return {
    id: String(id ?? `pain-server-${index}`),
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
      textureX: coords.textureX,
      textureY: coords.textureY,
    },
    createdAt: new Date().toISOString(),
  };
}
