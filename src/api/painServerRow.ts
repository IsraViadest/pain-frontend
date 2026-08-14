/**
 * Validates and normalizes one object from pain-server `GET /init/:layer`.
 *
 * Data always comes from the API (never from frontend CSV). JSON keys on each row
 * match the configured pain-server schema — see {@link PainServerDbConfig}.
 * Accepts lat/lng rows and country-only rows (lat/lng stored as null).
 */
import { PainServerDbConfig } from "./painServerDbConfig";
import type { PainServerRow } from "../types/painServer";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(
  row: PainServerRow,
  keys: readonly (keyof PainServerRow)[],
): string | null {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v);
    }
  }
  return null;
}

/** Normalized row after applying {@link PainServerDbConfig} column names. */
export interface NormalizedPainServerRow {
  id: number;
  aggrid: number | null;
  value: number;
  category: string;
  lat: number | null;
  lng: number | null;
  country: string | null;
  word: string | null;
}

/**
 * Parse one `/init/:layer` array element into a typed row, or null if required fields are missing.
 *
 * Lat/lng rows need both coordinates. Country rows need `country` and may omit lat/lng.
 * Empty `category` defaults to `"unknown"` (with a console warning).
 *
 * @param initLayerRow — single JSON object from the layer init response (not yet validated).
 */
export function normalizePainServerRow(
  initLayerRow: unknown,
): NormalizedPainServerRow | null {
  if (!initLayerRow || typeof initLayerRow !== "object") return null;
  const r = initLayerRow as PainServerRow;

  const id = asNumber(r[PainServerDbConfig.TABLE_COLUMN_ID]);
  if (id === null) return null;

  const aggrid = asNumber(r[PainServerDbConfig.TABLE_COLUMN_AGGRID]);

  const value = asNumber(r[PainServerDbConfig.TABLE_COLUMN_VALUE]);
  if (value === null) return null;

  let category = pickString(r, [PainServerDbConfig.TABLE_COLUMN_CATEGORY]);
  if (category === null) {
    console.warn(
      "[painServerRow] Empty category — defaulting to \"unknown\"",
      id,
    );
    category = "unknown";
  }

  const lat = asNumber(r[PainServerDbConfig.TABLE_COLUMN_LAT]);
  const lng = asNumber(r[PainServerDbConfig.TABLE_COLUMN_LNG]);
  // One coordinate without the other is invalid.
  if ((lat === null) !== (lng === null)) return null;

  const country = pickString(r, [PainServerDbConfig.TABLE_COLUMN_COUNTRY]);
  const word = pickString(r, [PainServerDbConfig.TABLE_COLUMN_WORD]);

  const hasCoords = lat !== null && lng !== null;
  if (!hasCoords && country === null) return null;

  return {
    id,
    aggrid,
    value,
    category,
    lat,
    lng,
    country,
    word,
  };
}
