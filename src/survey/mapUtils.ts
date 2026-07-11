/** geoViewBox from public/world.svg — mapsvg:geoViewBox="minLng maxLat maxLng minLat". */
const WORLD_GEO_MIN_LNG = -169.110266;
const WORLD_GEO_MAX_LNG = 190.486279;

const WORLD_GEO_LNG_SPAN = WORLD_GEO_MAX_LNG - WORLD_GEO_MIN_LNG;

/**
 * Empirical Web Mercator bounds for `public/world.svg` (MapSVG).
 * The geoViewBox lat/lng corners do not match the actual Mercator Y range
 * used when drawing paths — calibrated from Spain (lat ≈ 40.4°N) and
 * Australia (lat ≈ −25°S) reference points on the rendered SVG.
 */
const WORLD_MERC_TOP = 3.1827;
const WORLD_MERC_SPAN = 4.892;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Web Mercator Y for WGS84 latitude (degrees): ln(tan(π/4 + φ/2)). */
function mercatorY(latDeg: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
}

/** Inverse of {@link mercatorY}: Mercator Y → WGS84 latitude (degrees). */
function mercatorYToLatDeg(mercY: number): number {
  return (Math.atan(Math.exp(mercY)) - Math.PI / 4) * 2 * (180 / Math.PI);
}

/**
 * Convert pointer coordinates on the rendered world map to WGS84 lat/lng.
 *
 * `public/world.svg` (MapSVG) uses **Web Mercator** for latitude, not plate
 * carrée or Miller cylindrical. Longitude is linear against geoViewBox lng
 * bounds; latitude must go through Mercator Y with {@link WORLD_MERC_TOP} and
 * {@link WORLD_MERC_SPAN} (empirical constants — geoViewBox lat corners are
 * misleading for Y mapping).
 *
 * - `nx = clamp((clientX − rect.left) / rect.width, 0, 1)`
 * - `ny = clamp((clientY − rect.top) / rect.height, 0, 1)` — 0 = top, 1 = bottom
 * - `lng = minLng + nx × (maxLng − minLng)`
 * - `mercY = MERC_TOP − ny × MERC_SPAN`
 * - `lat = mercatorYToLat(mercY)`
 *
 * Reads `imgEl.getBoundingClientRect()` at call time (not mount time) so
 * letterboxing via `object-fit: contain` and panel layout shifts are handled.
 */
export function svgCoordsToLatLng(
  clientX: number,
  clientY: number,
  imgEl: HTMLElement,
): { lat: number; lng: number } | null {
  const rect = imgEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    console.warn("[mapUtils] Map image has zero size; cannot convert coordinates.");
    return null;
  }

  const nx = clamp01((clientX - rect.left) / rect.width);
  const ny = clamp01((clientY - rect.top) / rect.height);
  const lng = WORLD_GEO_MIN_LNG + nx * WORLD_GEO_LNG_SPAN;
  const mercY = WORLD_MERC_TOP - ny * WORLD_MERC_SPAN;
  const lat = mercatorYToLatDeg(mercY);
  return { lat, lng };
}

/**
 * Inverse of {@link svgCoordsToLatLng}: normalized map image coordinates (0–1)
 * using the same empirical Web Mercator Y mapping as the SVG.
 */
export function latLngToNormalizedMapXY(
  lat: number,
  lng: number,
): { nx: number; ny: number } {
  const nx = clamp01((lng - WORLD_GEO_MIN_LNG) / WORLD_GEO_LNG_SPAN);
  const ny = clamp01((WORLD_MERC_TOP - mercatorY(lat)) / WORLD_MERC_SPAN);
  return { nx, ny };
}
