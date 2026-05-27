/**
 * pain-server row coordinates → globe WGS84.
 * Only accepts valid degree ranges; grid indices are not converted (backend responsibility).
 */
import type { PainLayerId } from "../types/api";
import type { NormalizedPainServerRow } from "./painServerRow";

interface GeoCoordinates {
  lat: number;
  lng: number;
}

/** True WGS84 degrees (fractional lat/lng allowed). */
function isWgs84Degrees(latVal: number, lngVal: number): boolean {
  return (
    latVal >= -90 &&
    latVal <= 90 &&
    lngVal >= -180 &&
    lngVal <= 180
  );
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
 * API → globe. Accepts WGS84 degrees only; invalid rows return null (adapter warns and skips).
 * Grid indices or other non-degree values are not converted — backend must send real lat/lng.
 */
export function resolvePainServerCoordinates(
  row: NormalizedPainServerRow,
): GeoCoordinates | null {
  const latVal = row.lat;
  const lngVal = row.lng;

  if (isWgs84Degrees(latVal, lngVal)) {
    return { lat: latVal, lng: lngVal };
  }

  return null;
}
