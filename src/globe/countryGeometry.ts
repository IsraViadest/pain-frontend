/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/** Shared Natural Earth country polygons and exact point lookup. */

type PolygonCoords = number[][][];
type MultiPolygonCoords = number[][][][];

export type CountryGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoords };

export interface IndexedCountryGeometry {
  key: string;
  name: string;
  geometry: CountryGeometry;
  polygons: IndexedCountryPolygon[];
}

interface IndexedCountryPolygon {
  rings: PolygonCoords;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  crossesAntimeridian: boolean;
}

interface CountryProperties {
  ISO_A3?: string;
  ADM0_A3?: string;
  NAME_EN?: string;
  ADMIN?: string;
}

interface CountryFeature {
  properties?: CountryProperties;
  geometry?: CountryGeometry | { type: string };
}

interface CountryFeatureCollection {
  features?: CountryFeature[];
}

const COUNTRY_PATH = "borders/ne_110m_admin_0_countries.geojson";
const SEGMENT_EPSILON = 1e-9;

let geometries: IndexedCountryGeometry[] = [];
let loadPromise: Promise<void> | null = null;

function countryKeyFromProps(props: CountryProperties): string | null {
  const iso = props.ISO_A3?.trim().toUpperCase();
  const adm0 = props.ADM0_A3?.trim().toUpperCase();
  if (iso && iso !== "-99") return iso;
  if (adm0 && adm0 !== "-99") return adm0;
  return null;
}

function isCountryGeometry(
  geometry: CountryFeature["geometry"],
): geometry is CountryGeometry {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

function indexPolygon(rings: PolygonCoords): IndexedCountryPolygon | null {
  const outer = rings[0];
  if (!outer?.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const position of outer) {
    const lng = position[0];
    const lat = position[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLat = Math.min(minLat, lat!);
    maxLat = Math.max(maxLat, lat!);
    minLng = Math.min(minLng, lng!);
    maxLng = Math.max(maxLng, lng!);
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;

  return {
    rings,
    minLat,
    maxLat,
    minLng,
    maxLng,
    crossesAntimeridian: maxLng - minLng > 180,
  };
}

/** Parse and index country polygons from the bundled Natural Earth feature collection. */
export function buildCountryGeometries(
  collection: CountryFeatureCollection,
): IndexedCountryGeometry[] {
  const indexed: IndexedCountryGeometry[] = [];
  for (const feature of collection.features ?? []) {
    const props = feature.properties;
    const geometry = feature.geometry;
    if (!props || !isCountryGeometry(geometry)) continue;
    const key = countryKeyFromProps(props);
    if (!key) continue;
    const sourcePolygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    const polygons = sourcePolygons
      .map(indexPolygon)
      .filter((polygon): polygon is IndexedCountryPolygon => polygon !== null);
    if (polygons.length > 0) indexed.push({
      key, name: props.NAME_EN?.trim() || props.ADMIN?.trim() || key, geometry, polygons,
    });
  }
  return indexed;
}

/** Fetch and cache the Natural Earth country polygons. */
export async function ensureCountryGeometriesLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const base = import.meta.env.BASE_URL;
      const response = await fetch(`${base}${COUNTRY_PATH}`);
      if (!response.ok) {
        console.warn("[countryGeometry] GeoJSON fetch failed:", response.status);
        geometries = [];
        return;
      }
      geometries = buildCountryGeometries(
        (await response.json()) as CountryFeatureCollection,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[countryGeometry] Failed to load country polygons:", message);
      geometries = [];
    }
  })();

  return loadPromise;
}

/** Loaded country polygons. Call {@link ensureCountryGeometriesLoaded} first. */
export function getCountryGeometries(): readonly IndexedCountryGeometry[] {
  return geometries;
}

/** Whether the loaded Natural Earth data includes this ISO3 country. */
export function hasCountryGeometry(iso3: string): boolean {
  const key = iso3.trim().toUpperCase();
  return geometries.some((country) => country.key === key);
}

function normalizeLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function unwrapNear(lng: number, reference: number): number {
  let result = lng;
  while (result - reference > 180) result -= 360;
  while (result - reference < -180) result += 360;
  return result;
}

function pointOnSegment(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > SEGMENT_EPSILON) return false;
  return (
    x >= Math.min(ax, bx) - SEGMENT_EPSILON &&
    x <= Math.max(ax, bx) + SEGMENT_EPSILON &&
    y >= Math.min(ay, by) - SEGMENT_EPSILON &&
    y <= Math.max(ay, by) + SEGMENT_EPSILON
  );
}

function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  const first = ring[0];
  if (!first) return false;
  const points: Array<[number, number]> = [];
  let previousLng = normalizeLongitude(first[0]!);
  let minLng = previousLng;
  let maxLng = previousLng;
  points.push([previousLng, first[1]!]);
  for (let i = 1; i < ring.length; i++) {
    const position = ring[i];
    if (!position) continue;
    previousLng = unwrapNear(position[0]!, previousLng);
    minLng = Math.min(minLng, previousLng);
    maxLng = Math.max(maxLng, previousLng);
    points.push([previousLng, position[1]!]);
  }
  const middleLng = (minLng + maxLng) / 2;
  const middleQuery = unwrapNear(lng, middleLng);
  for (const queryLng of [middleQuery - 360, middleQuery, middleQuery + 360]) {
    if (queryLng < minLng - SEGMENT_EPSILON || maxLng + SEGMENT_EPSILON < queryLng) {
      continue;
    }
    let inside = false;
    for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
      const [ax, ay] = points[i]!;
      const [bx, by] = points[previous]!;
      if (pointOnSegment(queryLng, lat, ax, ay, bx, by)) return true;
      if ((ay > lat) !== (by > lat)) {
        const crossing = ((bx - ax) * (lat - ay)) / (by - ay) + ax;
        if (queryLng < crossing) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

function pointInPolygon(lat: number, lng: number, rings: PolygonCoords): boolean {
  const outer = rings[0];
  if (!outer || !pointInRing(lat, lng, outer)) return false;
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (hole && pointInRing(lat, lng, hole)) return false;
  }
  return true;
}

/** Find the ISO3 country containing a WGS84 point in an indexed geometry set. */
export function findCountryInGeometries(
  countries: readonly IndexedCountryGeometry[],
  lat: number,
  lng: number,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90) {
    return null;
  }
  const normalizedLng = normalizeLongitude(lng);
  for (const country of countries) {
    for (const polygon of country.polygons) {
      if (lat < polygon.minLat || polygon.maxLat < lat) continue;
      if (
        !polygon.crossesAntimeridian &&
        (normalizedLng < polygon.minLng || polygon.maxLng < normalizedLng)
      ) {
        continue;
      }
      if (pointInPolygon(lat, normalizedLng, polygon.rings)) return country.key;
    }
  }
  return null;
}
