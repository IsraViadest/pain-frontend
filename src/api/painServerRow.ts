/**
 * Validates and normalizes one object from pain-server `GET /init/:layer`.
 *
 * Data always comes from the API (never from frontend CSV). JSON keys on each row
 * match the configured pain-server schema — see {@link PainServerDbConfig}.
 * “DummyPain / db_data.csv” is only the legacy name of that schema, not a file we
 * load in production.
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
  lat: number;
  lng: number;
  value: number;
  datatype: string;
  painorigin: string;
}

/**
 * Parse one `/init/:layer` array element into a typed row, or null if required fields are missing.
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

  const lat = asNumber(r[PainServerDbConfig.TABLE_COLUMN_LAT]);
  const lng = asNumber(r[PainServerDbConfig.TABLE_COLUMN_LNG]);
  if (lat === null || lng === null) return null;

  const value = asNumber(r[PainServerDbConfig.TABLE_COLUMN_VALUE]);
  if (value === null) return null;

  const datatype =
    pickString(r, [PainServerDbConfig.TABLE_COLUMN_DATATYPE]) ?? "unknown";
  const painorigin =
    pickString(r, [PainServerDbConfig.TABLE_COLUMN_PAINORIGIN]) ?? "unknown";

  return {
    id,
    lat,
    lng,
    value,
    datatype,
    painorigin,
  };
}
