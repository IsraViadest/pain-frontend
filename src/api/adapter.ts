import type { PainPoint } from "../types/api";
import type { PainServerRow } from "../types/painServer";
import {
  resolvePainServerCoordinates,
  type GeoCoordinates,
} from "./coordinates";
import { getCountryCentroid } from "./countryCentroids";
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
    const point = mapRow(row, layerId);
    if (point) points.push(point);
    else skipped++;
  }
  if (skipped > 0) {
    console.warn(
      `[adapter] Skipped ${skipped} row(s) (invalid shape, unknown country code, or coordinates outside WGS84)`,
    );
  }
  return points;
}

/**
 * Turn one validated API row into a {@link PainPoint} (lat/lng, uiLayer, intensity).
 * Lat/lng rows use WGS84 from the API; country-only rows use Natural Earth label points
 * via {@link getCountryCentroid} (ISO_A3) only when the active layer needs word placement.
 * Centroids are only needed for emotional-layer word positioning, so non-text layers keep
 * `lat` / `lng` null when a row has `country` but no coordinates. Returns null when
 * coordinates cannot be resolved for a text-enabled layer.
 *
 * `metadata.layerLabel` uses {@link getMapLayerById} — requires {@link ../client.ts fetchLayers}
 * before {@link ../client.ts fetchPoints} so the layer cache is populated.
 */
function mapRow(
  row: NormalizedPainServerRow,
  layerId: string,
): PainPoint | null {
  const layer = getMapLayerById(layerId);
  const layerSupportsText = layer?.text === true;
  let coords: GeoCoordinates | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  if (row.lat !== null && row.lng !== null) {
    coords = resolvePainServerCoordinates(row);
    if (coords == null) {
      console.warn(
        "[adapter] Skipping row with invalid WGS84 coordinates",
        row.id,
        { lat: row.lat, lng: row.lng },
      );
      return null;
    }
    lat = coords.lat;
    lng = coords.lng;
  } else if (row.country) {
    if (layerSupportsText) {
      coords = getCountryCentroid(row.country);
      if (coords == null) {
        console.warn(
          "[adapter] No centroid for country code:",
          row.country,
          row.id,
        );
        return null;
      }
      lat = coords.lat;
      lng = coords.lng;
    }
  } else {
    console.warn(
      "[adapter] Skipping row with no coordinates and no country",
      row.id,
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
    id,
    lat,
    lng,
    intensity: value,
    category,
    country: country ?? undefined,
    word: word ?? undefined,
    uiLayer: layerId,
    // Prefer API `word` for word clouds; fall back to category label.
    text: word ?? category,
    metadata: {
      country: country ?? "Unknown",
      layerLabel: layer?.label ?? layerId,
      metricLabel: category,
      rawValue: value,
      sourceUrl: "",
    },
    createdAt: new Date().toISOString(),
  };
}
