import { PAIN_SERVER_ROW_ALIASES, PainServerDbConfig } from "./painServerDbConfig";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(
  raw: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v);
    }
  }
  return null;
}

function pickNumber(
  raw: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const n = asNumber(raw[key]);
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

export function normalizePainServerRow(
  raw: unknown,
): NormalizedPainServerRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = asNumber(r[PainServerDbConfig.TABLE_COLUMN_ID]);
  const value = asNumber(r[PainServerDbConfig.TABLE_COLUMN_VALUE]);
  if (id === null || value === null) return null;

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

export function isPainServerRow(raw: unknown): raw is Record<string, unknown> {
  return normalizePainServerRow(raw) !== null;
}
