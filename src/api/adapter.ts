import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import { resolvePainServerCoordinates } from "./coordinates";
import { getMapLayerById } from "./layers";
import { normalizePainServerRow } from "./painServerRow";

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
      `[adapter] Skipped ${skipped} row(s) (invalid shape or coordinates outside WGS84)`,
    );
  }
  return points;
}

/**
 * Turn one validated API row into a {@link PainPoint} (lat/lng, uiLayer, intensity).
 * Returns null when coordinates cannot be resolved (row is skipped).
 *
 * `metadata.layerLabel` uses {@link getMapLayerById} — requires {@link ../client.ts fetchLayers}
 * before {@link ../client.ts fetchPoints} so the layer cache is populated.
 */
function mapRow(
  row: NonNullable<ReturnType<typeof normalizePainServerRow>>,
  layerId: string,
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

  const { id, value, datatype } = row;

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
    datatype,
    uiLayer: layerId,
    // Frontend-only placeholder — API has no text field yet (Pattern 20).
    // TODO: Replace with real text field from API when available.
    // Only `datatype` is used; row `painorigin` is omitted (redundant with request `layerId` / uiLayer).
    // Currently used for word clouds until real data exists.
    text: datatype,
    metadata: {
      // Frontend-only placeholder — API has no country field (Pattern 20).
      // TODO: populate from API or reverse geocoding when available.
      country: "PPP map record",
      layerLabel: getMapLayerById(layerId)?.label ?? layerId,
      metricLabel: datatype,
      rawValue: value,
      sourceUrl: "",
    },
    createdAt: new Date().toISOString(),
  };
}
