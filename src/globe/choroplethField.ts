/**
 * Country choropleth as an equirectangular RGBA DataTexture (Canvas 2D fill).
 * Same plate-carrée projection as {@link landMaskRaster.ts} / scar maps; resolution 2048×1024.
 *
 * Used when a layer is country-based (`geospatial: false` && `text: false`).
 */
import * as THREE from "three";
import type { PainPoint } from "../types/api";
import {
  ensureCountryGeometriesLoaded,
  getCountryGeometries,
  hasCountryGeometry,
  type CountryGeometry,
  type IndexedCountryGeometry,
} from "./countryGeometry";

/** Equirectangular choropleth texture resolution (higher than scar/heat 1000×482). */
const CHOROPLETH_MAP_WIDTH = 2048;
const CHOROPLETH_MAP_HEIGHT = 1024;

/** ISO_A3 (or ADM0_A3 fallback) → fill intensity in [0, 1] (or wider; alpha clamps). */
interface ChoroplethCountryValue {
  country: string;
  intensity: number;
}

export type SocioeconomicMissingStyle = "diagonal" | "cross";

/** Byte range for canvas / DataTexture alpha channel. */
const ALPHA_BYTE_MIN = 0;
const ALPHA_BYTE_MAX = 255;

/**
 * Fetch and index Natural Earth country polygons (idempotent).
 * Call before {@link createChoroplethTexture}.
 */
export async function ensureChoroplethCountriesLoaded(): Promise<void> {
  return ensureCountryGeometriesLoaded();
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
  geom: CountryGeometry,
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

function createMissingPattern(
  ctx: CanvasRenderingContext2D,
  style: SocioeconomicMissingStyle,
): CanvasPattern {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 12;
  const patternContext = tile.getContext("2d");
  if (!patternContext) throw new Error("2D canvas unsupported");
  patternContext.fillStyle = "rgba(112, 112, 112, 0.42)";
  patternContext.fillRect(0, 0, 12, 12);
  patternContext.strokeStyle = "rgba(220, 220, 220, 0.62)";
  patternContext.lineWidth = 1.5;
  const drawDiagonal = (rising: boolean): void => {
    patternContext.beginPath();
    for (const offset of [-12, 0, 12]) {
      patternContext.moveTo(offset, rising ? 12 : 0);
      patternContext.lineTo(offset + 12, rising ? 0 : 12);
    }
    patternContext.stroke();
  };
  drawDiagonal(true);
  if (style === "cross") drawDiagonal(false);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) throw new Error("Canvas pattern unsupported");
  return pattern;
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
 * Countries with data: layer RGB with an affine alpha mapping from minimumAlpha to one.
 * The default zero floor preserves the original intensity alpha. No data stays transparent.
 *
 * @param values — ISO_A3 → intensity (from {@link aggregateChoroplethValues})
 * @param colorHex — active layer hex from GET /init (e.g. `#ffff00`)
 */
export function createChoroplethTexture(
  values: ChoroplethCountryValue[],
  colorHex: string | null | undefined,
  countries: readonly IndexedCountryGeometry[] = getCountryGeometries(),
  minimumAlpha = 0,
  missingStyle?: SocioeconomicMissingStyle,
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

  if (missingStyle) {
    ctx.fillStyle = createMissingPattern(ctx, missingStyle);
    for (const { key, geometry } of countries) {
      const intensity = intensityByKey.get(key);
      if (intensity === undefined || !Number.isFinite(intensity)) {
        fillGeometry(ctx, geometry, w, h);
      }
    }
  }

  for (const { key, geometry } of countries) {
    const intensity = intensityByKey.get(key);
    if (intensity === undefined || !Number.isFinite(intensity)) continue;
    // Source values remain normalized; only the displayed alpha gets a visible minimum.
    const alpha = intensityToAlphaByte(minimumAlpha +
      (1 - minimumAlpha) * THREE.MathUtils.clamp(intensity, 0, 1));
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

/**
 * The choropleth map's own resolution. It was half of it while the highlight was only a wash,
 * where an edge a texel or two soft is invisible. An outline is a texel or two wide, so at half
 * resolution the thinnest line available was already 3 screen pixels at the gallery camera and
 * arrived as a staircase.
 */
const HIGHLIGHT_MAP_WIDTH = 2048;
const HIGHLIGHT_MAP_HEIGHT = 1024;
export const HIGHLIGHT_GROUP_BYTES = HIGHLIGHT_MAP_WIDTH * HIGHLIGHT_MAP_HEIGHT * 4;

/** Trace every ring, outer and holes alike: a hole's edge is a border too. */
function strokeGeometry(
  ctx: CanvasRenderingContext2D,
  geom: CountryGeometry,
  w: number,
  h: number,
): void {
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const rings of polygons) {
    for (const ring of rings) {
      if (!ring?.length) continue;
      ctx.beginPath();
      traceRing(ctx, ring, w, h);
      ctx.stroke();
    }
  }
}

/**
 * A round mark of a given great-circle radius at one point, drawn into the equirectangular map.
 *
 * ROUND ON THE GLOBE, NOT ROUND ON THE MAP. Equirectangular squeezes longitude toward the poles,
 * so a circle in texel space arrives as a flat smear at high latitude. Dividing the horizontal
 * radius by the cosine of the latitude undoes that; the cosine is floored so a point very near a
 * pole gives a wide mark rather than an infinite one.
 *
 * Drawn three times, one map width apart, because a mark near the antimeridian straddles the seam
 * and Kiribati, Tuvalu, Samoa and Tonga all sit there. Two of the three fall outside the canvas
 * and cost nothing.
 */
function traceMarker(
  ctx: CanvasRenderingContext2D,
  point: { lat: number; lng: number },
  radiusDeg: number,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  joinPath = false,
): void {
  const [x, y] = lngLatToCanvas(point.lng, point.lat, w, h);
  const ry = (radiusDeg / 180) * h;
  const rx = ry / Math.max(0.15, Math.cos((point.lat * Math.PI) / 180));
  for (const dx of [-w, 0, w]) {
    if (joinPath) ctx.moveTo(x + dx + rx, y);
    else ctx.beginPath();
    ctx.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
    paint(ctx);
  }
}

/**
 * Whether Natural Earth 1:110m has a polygon for this country at all.
 *
 * Exported so a caller can tell the two kinds of country apart before asking for a highlight, and
 * supply a label point for the ones it cannot fill. Asking here rather than keeping a second list
 * is what stops the two from drifting when the source data changes.
 */
export { hasCountryGeometry };

/**
 * A set of countries filled and/or outlined into one otherwise transparent equirectangular
 * texture, for the selection highlight in the emotional-pain views.
 *
 * The two treatments are independent, so a caller can ask for a wash, for a thickened border, or
 * for both. `outlineWidthPx` is in texels of the map below, not screen pixels.
 *
 * It takes a list rather than one country because selecting a pain category highlights every
 * country in it, and one texture for the whole set costs the same as one for a single country.
 *
 * COUNTRIES WITH NO POLYGON GET A DISC INSTEAD, IF THE CALLER ASKS FOR ONE. Natural Earth 1:110m
 * has no geometry for 29 of the 195 countries the emotional views label, all of them small island
 * states and city states, so a leader line could land on one and nothing would light up. `markers`
 * are their label points and `markerRadiusDeg` the great-circle radius to draw there, which is
 * deliberately a size rather than a shape: even with a polygon, Malta is about one texel across on
 * the map below, so the mark has to be given a size rather than inherit one. At 0 nothing is drawn
 * and the behaviour is exactly what shipped before this existed.
 *
 * Returns null when there is nothing at all to draw, and quietly omits any country that has
 * neither a polygon nor a marker.
 */
export function createCountryHighlightTexture(
  iso3List: readonly string[],
  colorHex: string,
  fillOpacity: number,
  outlineWidthPx: number,
  markers: readonly { lat: number; lng: number; strength?: number }[],
  markerRadiusDeg: number,
  countries: readonly IndexedCountryGeometry[] = getCountryGeometries(),
  strengths?: ReadonlyMap<string, number>,
  outlineColorHex?: string,
): THREE.DataTexture | null {
  const keys = new Set(iso3List.map((c) => c.trim().toUpperCase()));
  const matches = countries.filter((c) => keys.has(c.key));
  const discs = markerRadiusDeg > 0 ? markers : [];
  if (matches.length === 0 && discs.length === 0) return null;
  if (fillOpacity <= 0 && outlineWidthPx <= 0) return null;

  const w = HIGHLIGHT_MAP_WIDTH;
  const h = HIGHLIGHT_MAP_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // Passing false explicitly avoids the cold readback stall seen with an omitted preference.
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("2D canvas unsupported");

  ctx.clearRect(0, 0, w, h);
  const rgb = parseHexRgb(colorHex) ?? { r: 255, g: 255, b: 255 };
  if (!strengths && fillOpacity > 0) {
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, fillOpacity))})`;
    for (const match of matches) fillGeometry(ctx, match.geometry, w, h);
    for (const marker of discs) traceMarker(ctx, marker, markerRadiusDeg, w, h, (p) => p.fill());
  }
  // After the fill, never before: filling punches its holes with destination-out, which would
  // erase any stroke already laid down there.
  if (!strengths && outlineWidthPx > 0) {
    ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.lineWidth = outlineWidthPx;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const match of matches) strokeGeometry(ctx, match.geometry, w, h);
    for (const marker of discs) traceMarker(ctx, marker, markerRadiusDeg, w, h, (p) => p.stroke());
  }

  let bytes: Uint8Array | undefined;
  if (strengths) {
    // Rasterize each strength once, then take maximum alpha. Shared borders and overlapping
    // waves cannot gain brightness through repeated source-over compositing.
    const weights = new Set([
      ...matches.map((c) => strengths.get(c.key) ?? 1), ...discs.map((d) => d.strength ?? 1),
    ]);
    const outline = parseHexRgb(outlineColorHex ?? colorHex) ?? rgb;
    for (const weight of weights) {
      if (weight <= 0) continue;
      const group = matches.filter((c) => (strengths.get(c.key) ?? 1) === weight);
      const groupDiscs = discs.filter((d) => (d.strength ?? 1) === weight);
      ctx.clearRect(0, 0, w, h);
      if (fillOpacity > 0) {
        ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        for (const { geometry } of group) {
          const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
          for (const rings of polygons) {
            ctx.beginPath();
            for (const ring of rings) traceRing(ctx, ring, w, h);
            ctx.fill("evenodd");
          }
        }
        for (const disc of groupDiscs) traceMarker(ctx, disc, markerRadiusDeg, w, h, (p) => p.fill());
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, fillOpacity))})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      if (outlineWidthPx > 0) {
        ctx.strokeStyle = `rgb(${outline.r},${outline.g},${outline.b})`;
        ctx.lineWidth = outlineWidthPx;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        for (const { geometry } of group) {
          const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
          for (const rings of polygons) for (const ring of rings) traceRing(ctx, ring, w, h);
        }
        for (const disc of groupDiscs) traceMarker(ctx, disc, markerRadiusDeg, w, h, () => {}, true);
        ctx.stroke();
      }
      const { data } = ctx.getImageData(0, 0, w, h);
      if (!bytes) {
        // ImageData is already an independent snapshot. Reuse its storage for the first group.
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        if (weight >= 1) continue;
        for (let i = 3; i < bytes.length; i += 4) {
          if (bytes[i] === 0) continue;
          const alpha = Math.round(bytes[i]! * weight);
          bytes[i] = alpha;
          if (alpha === 0) bytes[i - 3] = bytes[i - 2] = bytes[i - 1] = 0;
        }
        continue;
      }
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const alpha = Math.round(data[i + 3]! * Math.min(1, weight));
        if (alpha <= bytes[i + 3]!) continue;
        bytes[i] = data[i]!;
        bytes[i + 1] = data[i + 1]!;
        bytes[i + 2] = data[i + 2]!;
        bytes[i + 3] = alpha;
      }
    }
  } else {
    const { data } = ctx.getImageData(0, 0, w, h);
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  const tex = new THREE.DataTexture(
    (bytes ?? new Uint8Array(w * h * 4)) as unknown as ArrayBufferView<ArrayBuffer>,
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
  // SphereGeometry map sampling, same note as createChoroplethTexture above.
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}
