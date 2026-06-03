import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import { resolvePainServerCoordinates } from "./coordinates";
import { painOriginToUiLayerId } from "./layers";
import { normalizePainServerRow } from "./painServerRow";

/** Clamp a numeric intensity to 0…1 for globe shaders and marker sizing. */
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Maps the JSON body of pain-server `GET /init/:layer` to globe-ready {@link PainPoint}s.
 *
 * @param initLayerRows — parsed response body (must be an array of row objects).
 */
export function mapInitResponseToPainPoints(initLayerRows: PainServerRow[]): PainPoint[] {
  if (!Array.isArray(initLayerRows)) {
    throw new Error("Expected an array from GET /init/:layer");
  }

  const points: PainPoint[] = [];
  let skipped = 0;
  for (let i = 0; i < initLayerRows.length; i++) {
    const initLayerRow = initLayerRows[i];
    const row = normalizePainServerRow(initLayerRow);
    if (!row) {
      console.warn("[adapter] Skipping row with unexpected shape at index", i, initLayerRow);
      skipped++;
      continue;
    }
    const point = mapRow(row, i);
    if (point) points.push(point);
    else skipped++;
  }
  if (skipped > 0) {
    console.warn(
      `[adapter] Skipped ${skipped} row(s) (invalid shape or coordinates outside WGS84)`,
    );
  }
  return points;
}

/**
 * Turn one validated API row into a {@link PainPoint} (lat/lng, layer type, intensity).
 * Returns null when coordinates cannot be resolved (row is skipped).
 */
function mapRow(
  row: NonNullable<ReturnType<typeof normalizePainServerRow>>,
  index: number,
): PainPoint | null {
  const coords = resolvePainServerCoordinates(row);
  if (!coords) {
    console.warn(
      "[adapter] Skipping row with invalid WGS84 coordinates",
      row.id,
      { lat: row.lat, lng: row.lng },
    );
    return null;
  }

  const { datatype, painorigin, value, id } = row;
  const type = painOriginToUiLayerId(painorigin);

  return {
    id: String(id ?? `pain-server-${index}`),
    lat: coords.lat,
    lng: coords.lng,
    type,
    intensity: clamp01(value),
    datatype,
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
