import type { PainLayerId } from "../types/api";
import type { NormalizedPainServerRow } from "./painServerRow";
import { globeEquirectUvToLatLng } from "../globe/globeEquirectUV";

interface GeoCoordinates {
  lat: number;
  lng: number;
}

/** Resolved globe position plus optional DummyPain grid indices for scar stamping. */
interface ResolvedPainCoordinates extends GeoCoordinates {
  textureX?: number;
  textureY?: number;
}

/** Internal scar height-map resolution (matches DummyPain / db_data.csv). */
const SCAR_DISPLACEMENT_MAP_WIDTH = 1000;
const SCAR_DISPLACEMENT_MAP_HEIGHT = 482;

/**
 * DummyPain API grid (pain-server `DummyPain` table / db_data.csv).
 * x∈[0,999] is longitude column index, y∈[0,481] is latitude row (north at y=0).
 */
export const DUMMY_PAIN_TEXTURE_WIDTH = SCAR_DISPLACEMENT_MAP_WIDTH;
export const DUMMY_PAIN_TEXTURE_HEIGHT = SCAR_DISPLACEMENT_MAP_HEIGHT;

/**
 * Vertical shift (texture rows) aligning DummyPain indices with Natural Earth on 1000×482.
 * Without this, marker clusters trace the right continents but sit ~5° too far north on the globe.
 * Remove once /init/:layer returns calibrated WGS84 degrees.
 */
export const PPP_TEXTURE_PIXEL_Y_OFFSET = 15;

function isIntegerGridValue(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-6;
}

/** True WGS84 degrees (fractional lng/lat allowed once API sends real geo). */
function isWgs84Degrees(latVal: number, lngVal: number): boolean {
  return (
    latVal >= -90 &&
    latVal <= 90 &&
    lngVal >= -180 &&
    lngVal <= 180
  );
}

/**
 * DummyPain still returns texture column/row indices in lat/lng (or x/y) fields.
 * Values like (57, 75) must not be read as 57°N 75°E.
 */
function isLikelyDummyPainTextureIndices(
  latVal: number,
  lngVal: number,
): boolean {
  const maxX = DUMMY_PAIN_TEXTURE_WIDTH - 1;
  const maxY = DUMMY_PAIN_TEXTURE_HEIGHT - 1;

  if (latVal < 0 || latVal > maxX || lngVal < 0 || lngVal > maxY) {
    return false;
  }

  if (latVal > 90 || lngVal > 180 || latVal < -90 || lngVal < -180) {
    return true;
  }

  if (isIntegerGridValue(latVal) && isIntegerGridValue(lngVal)) {
    return true;
  }

  return false;
}

/** pain-server painorigin → UI layer id for markers / styling. */
export function mapPainOriginToUiLayer(origin: string): PainLayerId | string {
  const k = origin.toLowerCase();
  if (k.includes("emo")) return "emotional";
  if (k.includes("phys")) return "physical";
  if (k.includes("socio")) return "socioeconomic";
  return "environmental";
}

/**
 * API → globe. DbConfig `lat`/`lng` columns still hold DummyPain texture indices
 * (legacy x/y) until the backend ships real WGS84 degrees for every row.
 */
export function resolvePainServerCoordinates(
  row: NormalizedPainServerRow,
): ResolvedPainCoordinates | null {
  const latVal = row.latColumn;
  const lngVal = row.lngColumn;
  if (latVal === null || lngVal === null) return null;

  if (isLikelyDummyPainTextureIndices(latVal, lngVal)) {
    const geo = legacyTexturePixelToGeo(latVal, lngVal);
    if (!geo) return null;
    return { ...geo, textureX: latVal, textureY: lngVal };
  }

  if (isWgs84Degrees(latVal, lngVal)) {
    return { lat: latVal, lng: lngVal };
  }

  if (
    latVal >= -Math.PI / 2 &&
    latVal <= Math.PI / 2 &&
    lngVal >= -Math.PI &&
    lngVal <= Math.PI
  ) {
    return {
      lat: (latVal * 180) / Math.PI,
      lng: (lngVal * 180) / Math.PI,
    };
  }

  const geo = legacyTexturePixelToGeo(latVal, lngVal);
  if (!geo) return null;
  return { ...geo, textureX: latVal, textureY: lngVal };
}

/**
 * Legacy DummyPain: first arg is texture column x (0…999), second is row y (0…481).
 * Plate-carrée, same frame as the scar map and Natural Earth land mask.
 */
function legacyTexturePixelToGeo(
  x: number,
  y: number,
  textureWidth = DUMMY_PAIN_TEXTURE_WIDTH,
  textureHeight = DUMMY_PAIN_TEXTURE_HEIGHT,
): GeoCoordinates | null {
  const maxX = textureWidth - 1;
  const maxY = textureHeight - 1;
  if (x < 0 || x > maxX || y < 0 || y > maxY) return null;

  const yTex = Math.min(maxY, y + PPP_TEXTURE_PIXEL_Y_OFFSET);
  const u = (x + 0.5) / textureWidth;
  const v = (yTex + 0.5) / textureHeight;
  return globeEquirectUvToLatLng(u, v);
}
