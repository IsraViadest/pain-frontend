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
 * Manual fallbacks for territories too small or politically unrecognized
 * to appear in Natural Earth 1:110m.
 */
const MANUAL_CENTROIDS: Record<string, GeoCoordinates> = {
  SGP: { lat: 1.3521, lng: 103.8198 }, // Singapore
  HKG: { lat: 22.3193, lng: 114.1694 }, // Hong Kong
  MAC: { lat: 22.1987, lng: 113.5439 }, // Macao
  BHR: { lat: 26.0667, lng: 50.5577 }, // Bahrain
  MLT: { lat: 35.9375, lng: 14.3754 }, // Malta
  MUS: { lat: -20.2759, lng: 57.5703 }, // Mauritius
  XKX: { lat: 42.6026, lng: 20.9030 }, // Kosovo
  MCO: { lat: 43.7384, lng: 7.4246 }, // Monaco
  BMU: { lat: 32.3078, lng: -64.7505 }, // Bermuda
  LIE: { lat: 47.1660, lng: 9.5554 }, // Liechtenstein
  BRB: { lat: 13.1939, lng: -59.5432 }, // Barbados
  CYM: { lat: 19.3133, lng: -81.2546 }, // Cayman Islands
  MDV: { lat: 3.2028, lng: 73.2207 }, // Maldives
  IMN: { lat: 54.2361, lng: -4.5481 }, // Isle of Man
  PYF: { lat: -17.6797, lng: -149.4068 }, // French Polynesia
  AND: { lat: 42.5063, lng: 1.5218 }, // Andorra
  ABW: { lat: 12.5211, lng: -69.9683 }, // Aruba
  FRO: { lat: 61.8926, lng: -6.9118 }, // Faroe Islands
  CUW: { lat: 12.1696, lng: -68.9900 }, // Curaçao
  CPV: { lat: 16.5388, lng: -23.0418 }, // Cape Verde
  LCA: { lat: 13.9094, lng: -60.9789 }, // Saint Lucia
  SYC: { lat: -4.6796, lng: 55.4920 }, // Seychelles
  ATG: { lat: 17.0608, lng: -61.7964 }, // Antigua and Barbuda
  SMR: { lat: 43.9424, lng: 12.4578 }, // San Marino
  SXM: { lat: 18.0425, lng: -63.0548 }, // Sint Maarten
  COM: { lat: -11.6455, lng: 43.3333 }, // Comoros
  TCA: { lat: 21.6940, lng: -71.7979 }, // Turks and Caicos
  GRD: { lat: 12.1165, lng: -61.6790 }, // Grenada
  WSM: { lat: -13.7590, lng: -172.1046 }, // Samoa
  VCT: { lat: 13.2528, lng: -61.1971 }, // Saint Vincent
  KNA: { lat: 17.3578, lng: -62.7830 }, // Saint Kitts and Nevis
  STP: { lat: 0.1864, lng: 6.6131 }, // São Tomé and Príncipe
  DMA: { lat: 15.4150, lng: -61.3710 }, // Dominica
  TON: { lat: -21.1790, lng: -175.1982 }, // Tonga
  FSM: { lat: 6.8874, lng: 158.2150 }, // Micronesia
  KIR: { lat: 1.8709, lng: -157.3630 }, // Kiribati
  PLW: { lat: 7.5150, lng: 134.5825 }, // Palau
  NRU: { lat: -0.5228, lng: 166.9315 }, // Nauru
  TUV: { lat: -7.1095, lng: 179.1942 }, // Tuvalu
  VAT: { lat: 41.9029, lng: 12.4534 }, // Vatican
  MHL: { lat: 7.1315, lng: 171.1845 }, // Marshall Islands
};

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
 * Checks {@link MANUAL_CENTROIDS} first, then the loaded GeoJSON map.
 * Returns null if the code is unknown (or the GeoJSON map is empty/unloaded and there is no manual entry).
 *
 * @param iso_a3 — pain-server row `country` value; compared case-insensitively after trim.
 */
export function getCountryCentroid(
  iso_a3: string,
): GeoCoordinates | null {
  const key = iso_a3.trim().toUpperCase();
  if (!key) return null;
  const manual = MANUAL_CENTROIDS[key];
  if (manual) return manual;
  return centroidByIsoA3.get(key) ?? null;
}
