import type { PainLayerId } from "../types/api";
import type { PainServerRow } from "../types/painServer";

/**
 * DummyPain / PPP map texture grid (from db_data.csv: x ∈ [0,999], y ∈ [0,481]).
 * Confirm with backend if production textures use a different size.
 */
export const PPP_TEXTURE_WIDTH = 1000;
export const PPP_TEXTURE_HEIGHT = 482;

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** pain-server painorigin → UI layer id for markers / styling. */
export function mapPainOriginToUiLayer(origin: string): PainLayerId | string {
  const k = origin.toLowerCase();
  if (k.includes("emo")) return "emotional";
  if (k.includes("phys")) return "physical";
  if (k.includes("socio")) return "socioeconomic";
  return "environmental";
}

type RowCoords = PainServerRow & {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

/**
 * Resolve pain-server row coordinates to WGS84 degrees for the globe.
 * Order: explicit lat/lng → x/y as degrees → x/y as radians → texture pixels (PPP grid).
 */
export function resolvePainServerCoordinates(
  row: RowCoords,
  textureWidth = PPP_TEXTURE_WIDTH,
  textureHeight = PPP_TEXTURE_HEIGHT,
): GeoCoordinates | null {
  const latDeg = asNumber(row.lat) ?? asNumber(row.latitude);
  const lngDeg = asNumber(row.lng) ?? asNumber(row.longitude);
  if (
    latDeg !== null &&
    lngDeg !== null &&
    latDeg >= -90 &&
    latDeg <= 90 &&
    lngDeg >= -180 &&
    lngDeg <= 180
  ) {
    return { lat: latDeg, lng: lngDeg };
  }

  const x = asNumber(row.x);
  const y = asNumber(row.y);
  if (x === null || y === null) return null;

  if (y >= -90 && y <= 90 && x >= -180 && x <= 180) {
    return { lat: y, lng: x };
  }

  if (
    y >= -Math.PI / 2 &&
    y <= Math.PI / 2 &&
    x >= -Math.PI &&
    x <= Math.PI
  ) {
    return { lat: (y * 180) / Math.PI, lng: (x * 180) / Math.PI };
  }

  const maxX = textureWidth - 1;
  const maxY = textureHeight - 1;
  if (x >= 0 && x <= maxX && y >= 0 && y <= maxY) {
    const lng = ((x + 0.5) / textureWidth) * 360 - 180;
    const lat = 90 - ((y + 0.5) / textureHeight) * 180;
    return { lat, lng };
  }

  return null;
}
