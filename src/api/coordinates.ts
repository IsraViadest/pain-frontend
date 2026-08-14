/**
 * pain-server row coordinates → globe WGS84.
 * Only accepts valid degree ranges; grid indices are not converted (backend responsibility).
 */
import type { NormalizedPainServerRow } from "./painServerRow";

/** WGS84 latitude / longitude in degrees. */
export type GeoCoordinates = {
  lat: number;
  lng: number;
};

/** True WGS84 degrees (fractional lat/lng allowed). */
function isWgs84Degrees(latVal: number, lngVal: number): boolean {
  return (
    -90 <= latVal &&
    latVal <= 90 &&
    -180 <= lngVal &&
    lngVal <= 180
  );
}

/**
 * API → globe. Accepts WGS84 degrees only; invalid or missing coords return null.
 * Country-only rows (`lat`/`lng` null) return null — adapter skips globe plotting.
 * Grid indices or other non-degree values are not converted — backend must send real lat/lng.
 */
export function resolvePainServerCoordinates(
  row: NormalizedPainServerRow,
): GeoCoordinates | null {
  const latVal = row.lat;
  const lngVal = row.lng;
  if (latVal === null || lngVal === null) return null;

  if (isWgs84Degrees(latVal, lngVal)) {
    return { lat: latVal, lng: lngVal };
  }

  return null;
}
