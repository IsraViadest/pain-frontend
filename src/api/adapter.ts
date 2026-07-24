import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import { resolvePainServerCoordinates } from "./coordinates";
import { getMapLayerById } from "./layers";
import {
  normalizePainServerRow,
  type NormalizedPainServerRow,
} from "./painServerRow";

/**
 * Maps the JSON body of pain-server `GET /init/:layer` to globe-ready {@link PainPoint}s.
 *
 * @param initLayerRows — parsed array from pain-server GET /init/:layer (HTTP client validates shape).
 * @param layerId — layer id from GET /init, passed to `GET /init/:layer`; stored on each point as {@link PainPoint.uiLayer}.
 */
export function mapInitResponseToPainPoints(
  initLayerRows: PainServerRow[],
  layerId: string,
): PainPoint[] {
  const points: PainPoint[] = [];
  let skipped = 0;
  for (let i = 0; i < initLayerRows.length; i++) {
    const initLayerRow = initLayerRows[i];
    const row = normalizePainServerRow(initLayerRow);
    if (row == null) {
      console.warn("[adapter] Skipping row with unexpected shape at index", i, initLayerRow);
      skipped++;
      continue;
    }
    const point = mapRow(row, layerId, i);
    if (point) points.push(point);
    else skipped++;
  }
  if (skipped > 0) {
    console.warn(
      `[adapter] Skipped ${skipped} row(s) (invalid shape, country-only, or coordinates outside WGS84)`,
    );
  }
  return points;
}

/**
 * Turn one validated API row into a {@link PainPoint} (lat/lng, uiLayer, intensity).
 * Returns null when coordinates cannot be resolved (country-only rows or invalid WGS84).
 *
 * `metadata.layerLabel` uses {@link getMapLayerById} — requires {@link ../client.ts fetchLayers}
 * before {@link ../client.ts fetchPoints} so the layer cache is populated.
 */
function mapRow(
  row: NormalizedPainServerRow,
  layerId: string,
  index: number,
): PainPoint | null {
  if (row.lat === null || row.lng === null) {
    console.warn(
      "[adapter] Skipping country row (no lat/lng for globe plot)",
      row.id,
      { country: row.country, word: row.word },
    );
    return null;
  }

  const coords = resolvePainServerCoordinates(row);
  if (coords == null) {
    console.warn(
      "[adapter] Skipping row with invalid WGS84 coordinates",
      row.id,
      { lat: row.lat, lng: row.lng },
    );
    return null;
  }

  const { id, value, category, country, word } = row;

  if (value < 0 || 1 < value) {
    console.warn(
      "[adapter] pain-server `value` outside 0…1 — storing as-is (backend should normalize).",
      id,
      value,
    );
  }

  return {
    id: String(id ?? `pain-server-${index}`),
    lat: coords.lat,
    lng: coords.lng,
    intensity: value,
    category,
    country: country ?? undefined,
    word: word ?? undefined,
    uiLayer: layerId,
    // Prefer API `word` for word clouds; fall back to category label.
    text: word ?? category,
    metadata: {
      country: country ?? "Unknown",
      layerLabel: getMapLayerById(layerId)?.label ?? layerId,
      metricLabel: category,
      rawValue: value,
      sourceUrl: "",
    },
    createdAt: new Date().toISOString(),
  };
}
