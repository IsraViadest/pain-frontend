import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import { resolvePainServerCoordinates } from "./coordinates";
import { painOriginToUiLayerId } from "./layers";
import { normalizePainServerRow } from "./painServerRow";

/**
 * Maps the JSON body of pain-server `GET /init/:layer` to globe-ready {@link PainPoint}s.
 *
 * @param initLayerRows — parsed array from pain-server GET /init/:layer (HTTP client validates shape).
 */
export function mapInitResponseToPainPoints(initLayerRows: PainServerRow[]): PainPoint[] {
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
 * Turn one validated API row into a {@link PainPoint} (lat/lng, uiLayer, intensity).
 * Returns null when coordinates cannot be resolved (row is skipped).
 */
function mapRow(
  row: NonNullable<ReturnType<typeof normalizePainServerRow>>,
  index: number,
): PainPoint | null {
  const coords = resolvePainServerCoordinates(row);
  if (coords == null) {
    console.warn(
      "[adapter] Skipping row with invalid WGS84 coordinates",
      row.id,
      { lat: row.lat, lng: row.lng },
    );
    return null;
  }

  const { id, value, datatype, painorigin } = row;
  const uiLayer = painOriginToUiLayerId(painorigin);

  if (value < 0 || value > 1) {
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
    datatype,
    uiLayer,
    text: `${datatype} · ${painorigin}`,
    metadata: {
      country: "PPP map record",
      layerLabel: uiLayer,
      metricLabel: datatype,
      rawValue: value,
      sourceUrl: "",
    },
    createdAt: new Date().toISOString(),
  };
}
