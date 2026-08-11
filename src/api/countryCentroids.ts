/**
 * Country label positions from Natural Earth admin-0 countries GeoJSON.
 * Used to place pain-server country-only rows (no lat/lng) on the globe.
 *
 * Keys are ISO_A3; positions are LABEL_Y (lat) / LABEL_X (lng) — label points, not polygon centroids.
 */
import type { GeoCoordinates } from "./coordinates";

interface NeCountryProperties {
  ISO_A3?: string;
  ADM0_A3?: string;
  LABEL_X?: number;
  LABEL_Y?: number;
}

interface NeCountryFeature {
  properties?: NeCountryProperties;
}

interface NeCountryFeatureCollection {
  type?: string;
  features?: NeCountryFeature[];
}

const COUNTRIES_GEOJSON_URL = `${import.meta.env.BASE_URL}borders/ne_110m_admin_0_countries.geojson`;

let centroidByIsoA3: Map<string, GeoCoordinates> = new Map();
let loadPromise: Promise<void> | null = null;

function buildCentroidMap(fc: NeCountryFeatureCollection): Map<string, GeoCoordinates> {
  const map = new Map<string, GeoCoordinates>();
  const features = fc.features ?? [];
  for (const feature of features) {
    const props = feature.properties;
    if (!props) continue;
    const iso = props.ISO_A3?.trim().toUpperCase();
    const adm0 = props.ADM0_A3?.trim().toUpperCase();
    // Prefer ISO_A3; Natural Earth uses "-99" (or empty) for some countries — fall back to ADM0_A3.
    const key =
      iso && iso !== "-99" ? iso : adm0 && adm0 !== "-99" ? adm0 : null;
    const lng = props.LABEL_X;
    const lat = props.LABEL_Y;
    if (!key) continue;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    map.set(key, { lat, lng });
  }
  return map;
}

/**
 * Fetch and index Natural Earth country label points (idempotent).
 * Call once before mapping country-layer `/init/:layer` rows (see {@link ../client.ts fetchPoints}).
 * On failure logs a warning and leaves the map empty so lookups return null.
 */
export async function ensureCountryCentroidsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch(COUNTRIES_GEOJSON_URL);
      if (!res.ok) {
        console.warn(
          "[countryCentroids] GeoJSON fetch failed:",
          res.status,
          COUNTRIES_GEOJSON_URL,
        );
        centroidByIsoA3 = new Map();
        return;
      }
      const fc = (await res.json()) as NeCountryFeatureCollection;
      centroidByIsoA3 = buildCentroidMap(fc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[countryCentroids] Failed to load country centroids:", msg);
      centroidByIsoA3 = new Map();
    }
  })();

  return loadPromise;
}

/**
 * Look up a country label position by ISO 3166-1 alpha-3 code (e.g. `"DEU"`).
 * Returns null if the map is empty, unloaded, or the code is unknown.
 *
 * @param iso_a3 — pain-server row `country` value; compared case-insensitively after trim.
 */
export function getCountryCentroid(
  iso_a3: string,
): GeoCoordinates | null {
  const key = iso_a3.trim().toUpperCase();
  if (!key) return null;
  return centroidByIsoA3.get(key) ?? null;
}
