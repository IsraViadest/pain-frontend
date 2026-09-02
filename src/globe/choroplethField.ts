/**
 * Country choropleth as an equirectangular RGBA DataTexture (Canvas 2D fill).
 * Same plate-carrée projection as {@link landMaskRaster.ts} / scar maps; resolution 2048×1024.
 *
 * Used when a layer is country-based (`geospatial: false` && `text: false`).
 */
import * as THREE from "three";
import type { PainPoint } from "../types/api";

/** Equirectangular choropleth texture resolution (higher than scar/heat 1000×482). */
const CHOROPLETH_MAP_WIDTH = 2048;
const CHOROPLETH_MAP_HEIGHT = 1024;

/** ISO_A3 (or ADM0_A3 fallback) → fill intensity in [0, 1] (or wider; alpha clamps). */
interface ChoroplethCountryValue {
  country: string;
  intensity: number;
}

type PolygonCoords = number[][][];
type MultiPolygonCoords = number[][][][];

type PolygonGeom = { type: "Polygon"; coordinates: PolygonCoords };
type MultiPolygonGeom = { type: "MultiPolygon"; coordinates: MultiPolygonCoords };

interface NeCountryProperties {
  ISO_A3?: string;
  ADM0_A3?: string;
}

interface NeCountryFeature {
  properties?: NeCountryProperties;
  geometry?: PolygonGeom | MultiPolygonGeom | { type: string };
}

interface NeCountryFeatureCollection {
  features?: NeCountryFeature[];
}

interface ChoroplethCountryGeometry {
  key: string;
  geometry: PolygonGeom | MultiPolygonGeom;
}

const COUNTRIES_GEOJSON_URL = `${import.meta.env.BASE_URL}borders/ne_110m_admin_0_countries.geojson`;

/** Byte range for canvas / DataTexture alpha channel. */
const ALPHA_BYTE_MIN = 0;
const ALPHA_BYTE_MAX = 255;

let countryGeometries: ChoroplethCountryGeometry[] = [];
let loadPromise: Promise<void> | null = null;

/**
 * Prefer ISO_A3; Natural Earth uses "-99" (or empty) for some countries — fall back to ADM0_A3
 * (same rule as {@link ../api/countryCentroids.ts}).
 */
function countryKeyFromProps(props: NeCountryProperties): string | null {
  const iso = props.ISO_A3?.trim().toUpperCase();
  const adm0 = props.ADM0_A3?.trim().toUpperCase();
  if (iso && iso !== "-99") return iso;
  if (adm0 && adm0 !== "-99") return adm0;
  return null;
}

function isPaintGeom(
  geom: NeCountryFeature["geometry"],
): geom is PolygonGeom | MultiPolygonGeom {
  return geom?.type === "Polygon" || geom?.type === "MultiPolygon";
}

function buildCountryGeometries(
  fc: NeCountryFeatureCollection,
): ChoroplethCountryGeometry[] {
  const out: ChoroplethCountryGeometry[] = [];
  for (const feature of fc.features ?? []) {
    const props = feature.properties;
    const geom = feature.geometry;
    if (!props || !isPaintGeom(geom)) continue;
    const key = countryKeyFromProps(props);
    if (!key) continue;
    out.push({ key, geometry: geom });
  }
  return out;
}

/**
 * Fetch and index Natural Earth country polygons (idempotent).
 * Call before {@link createChoroplethTexture}.
 */
export async function ensureChoroplethCountriesLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch(COUNTRIES_GEOJSON_URL);
      if (!res.ok) {
        console.warn(
          "[choroplethField] GeoJSON fetch failed:",
          res.status,
          COUNTRIES_GEOJSON_URL,
        );
        countryGeometries = [];
        return;
      }
      const fc = (await res.json()) as NeCountryFeatureCollection;
      countryGeometries = buildCountryGeometries(fc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[choroplethField] Failed to load country polygons:", msg);
      countryGeometries = [];
    }
  })();

  return loadPromise;
}

/** Equirectangular: x from lng ∈ [-180,180], y from lat ∈ [-90,90] with north at top. */
function lngLatToCanvas(
  lng: number,
  lat: number,
  w: number,
  h: number,
): [number, number] {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

function traceRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  w: number,
  h: number,
): void {
  if (ring.length < 2) return;
  const [x0, y0] = lngLatToCanvas(ring[0]![0]!, ring[0]![1]!, w, h);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = lngLatToCanvas(ring[i]![0]!, ring[i]![1]!, w, h);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillPolygonWithHoles(
  ctx: CanvasRenderingContext2D,
  rings: number[][][],
  w: number,
  h: number,
): void {
  const outer = rings[0];
  if (!outer?.length) return;
  ctx.beginPath();
  traceRing(ctx, outer, w, h);
  ctx.fill();
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (!hole?.length) continue;
    ctx.beginPath();
    traceRing(ctx, hole, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

function fillGeometry(
  ctx: CanvasRenderingContext2D,
  geom: PolygonGeom | MultiPolygonGeom,
  w: number,
  h: number,
): void {
  if (geom.type === "Polygon") {
    fillPolygonWithHoles(ctx, geom.coordinates, w, h);
    return;
  }
  for (const polygon of geom.coordinates) {
    fillPolygonWithHoles(ctx, polygon, w, h);
  }
}

/** Linear alpha: intensity × 255, clamped to byte range. */
function intensityToAlphaByte(intensity: number): number {
  if (!Number.isFinite(intensity)) return ALPHA_BYTE_MIN;
  return Math.round(
    THREE.MathUtils.clamp(intensity * ALPHA_BYTE_MAX, ALPHA_BYTE_MIN, ALPHA_BYTE_MAX),
  );
}

/**
 * Aggregate pain points to one intensity per country (max wins when multiple rows share a code).
 * Skips points without `country`.
 */
export function aggregateChoroplethValues(
  points: PainPoint[],
): ChoroplethCountryValue[] {
  const maxByCountry = new Map<string, number>();
  for (const p of points) {
    const raw = p.country?.trim().toUpperCase();
    if (!raw) continue;
    const prev = maxByCountry.get(raw);
    if (prev === undefined || p.intensity > prev) {
      maxByCountry.set(raw, p.intensity);
    }
  }
  const values: ChoroplethCountryValue[] = [];
  for (const [country, intensity] of maxByCountry) {
    values.push({ country, intensity });
  }
  return values;
}

function parseHexRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/**
 * Paint country polygons into an RGBA DataTexture (2048×1024).
 * Countries with data: layer RGB + alpha ∝ intensity. No data: transparent.
 *
 * @param values — ISO_A3 → intensity (from {@link aggregateChoroplethValues})
 * @param colorHex — active layer hex from GET /init (e.g. `#ffff00`)
 */
export function createChoroplethTexture(
  values: ChoroplethCountryValue[],
  colorHex: string | null | undefined,
): THREE.DataTexture {
  const w = CHOROPLETH_MAP_WIDTH;
  const h = CHOROPLETH_MAP_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unsupported");
  }

  // Transparent backdrop — countries without data stay rgba(0,0,0,0).
  ctx.clearRect(0, 0, w, h);

  const parsed = colorHex ? parseHexRgb(colorHex) : null;
  const fillRgb = parsed ?? { r: 255, g: 255, b: 0 };
  if (!parsed && colorHex) {
    console.warn(
      "[choroplethField] Invalid layer color — using yellow fallback.",
      colorHex,
    );
  }

  const intensityByKey = new Map<string, number>();
  for (const v of values) {
    const key = v.country.trim().toUpperCase();
    if (!key) continue;
    const prev = intensityByKey.get(key);
    if (prev === undefined || v.intensity > prev) {
      intensityByKey.set(key, v.intensity);
    }
  }

  for (const { key, geometry } of countryGeometries) {
    const intensity = intensityByKey.get(key);
    if (intensity === undefined) continue;
    const alpha = intensityToAlphaByte(intensity);
    if (alpha <= ALPHA_BYTE_MIN) continue;
    ctx.fillStyle = `rgba(${fillRgb.r},${fillRgb.g},${fillRgb.b},${alpha / ALPHA_BYTE_MAX})`;
    fillGeometry(ctx, geometry, w, h);
  }

  const { data } = ctx.getImageData(0, 0, w, h);
  const bytes = new Uint8Array(data.buffer.slice(0));

  const tex = new THREE.DataTexture(
    bytes as unknown as ArrayBufferView<ArrayBuffer>,
    w,
    h,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  // SphereGeometry map sampling — same note as globeEquirectUV.ts
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}
