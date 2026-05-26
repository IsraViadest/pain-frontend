/**
 * Validates and normalizes one object from pain-server `GET /init/:layer`.
 *
 * Data always comes from the API (never from frontend CSV). JSON keys on each row
 * match pain-server’s DummyPain table schema (`id`, `x`, `y`, `value`, …) — see
 * {@link PainServerDbConfig}. “DummyPain / db_data.csv” is only the legacy name of
 * that schema, not a file we load in production.
 */
import { PAIN_SERVER_ROW_ALIASES, PainServerDbConfig } from "./painServerDbConfig";
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
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v);
    }
  }
  return null;
}

function pickNumber(
  row: PainServerRow,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const n = asNumber(row[key]);
    if (n !== null) return n;
  }
  return null;
}

/** Normalized row after applying {@link PainServerDbConfig} column names. */
export interface NormalizedPainServerRow {
  id: number;
  value: number;
  datatype: string;
  painorigin: string;
  /** From configured lat column + optional `lat` / `latitude` keys. */
  latColumn: number | null;
  /** From configured lng column + optional `lng` / `longitude` keys. */
  lngColumn: number | null;
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

  const value = asNumber(r[PainServerDbConfig.TABLE_COLUMN_VALUE]);
  if (value === null) return null;

  const datatype =
    pickString(r, [PainServerDbConfig.TABLE_COLUMN_DATATYPE]) ?? "unknown";
  const painorigin =
    pickString(r, [
      ...PAIN_SERVER_ROW_ALIASES.painorigin,
      PainServerDbConfig.TABLE_COLUMN_PAINORIGIN,
    ]) ?? "unknown";

  const latColumn = pickNumber(r, [
    PainServerDbConfig.TABLE_COLUMN_LAT,
    ...PAIN_SERVER_ROW_ALIASES.lat,
  ]);
  const lngColumn = pickNumber(r, [
    PainServerDbConfig.TABLE_COLUMN_LNG,
    ...PAIN_SERVER_ROW_ALIASES.lng,
  ]);
  if (latColumn === null || lngColumn === null) return null;

  return {
    id,
    value,
    datatype,
    painorigin,
    latColumn,
    lngColumn,
  };
}

/**
 * Type guard: true when {@link normalizePainServerRow} would return a row.
 *
 * @param initLayerRow — single JSON object from GET /init/:layer.
 */
export function isPainServerRow(
  initLayerRow: unknown,
): initLayerRow is PainServerRow {
  return normalizePainServerRow(initLayerRow) !== null;
}
