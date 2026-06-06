/**
 * Normalizes pain-server GET /init/ (layer metadata list) into {@link MapLayer}s.
 */
import type { MapLayer } from "../types/api";
import type { PainServerLayerRow } from "../types/painServer";

function pickString(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function pickBoolean(row: Record<string, unknown>, key: string): boolean | null {
  const v = row[key];
  if (typeof v === "boolean") return v;
  return null;
}

/**
 * Parse one object from GET /init/, or null if required fields are missing or invalid.
 *
 * @param initLayerRow — single JSON object from the layer list response.
 */
function normalizeInitLayerRow(initLayerRow: unknown): PainServerLayerRow | null {
  if (initLayerRow == null || typeof initLayerRow !== "object") return null;
  const row = initLayerRow as Record<string, unknown>;

  const id = pickString(row, "id");
  const label = pickString(row, "label");
  const desc = pickString(row, "desc");
  const color = pickString(row, "color");
  const geospatial = pickBoolean(row, "geospatial");
  const text = pickBoolean(row, "text");

  if (id == null || label == null || desc == null || color == null) return null;
  if (geospatial == null || text == null) return null;

  return { id, label, desc, color, geospatial, text };
}

/**
 * Map validated GET /init/ rows to HUD {@link MapLayer}s (field order matches API).
 *
 * @param initLayerRows — parsed response body from {@link fetchInitLayerList}.
 */
export function mapInitLayerListToMapLayers(initLayerRows: PainServerLayerRow[]): MapLayer[] {
  const layers: MapLayer[] = [];
  for (let i = 0; i < initLayerRows.length; i++) {
    const initLayerRow = initLayerRows[i];
    layers.push({
      id: initLayerRow.id,
      label: initLayerRow.label,
      desc: initLayerRow.desc,
      color: initLayerRow.color,
      geospatial: initLayerRow.geospatial,
      text: initLayerRow.text,
    });
  }
  return layers;
}

/**
 * Validate each row from GET /init/; skip invalid entries with a warning.
 *
 * @param initLayerListRows — raw JSON array from pain-server GET /init/.
 */
export function parseInitLayerListResponse(initLayerListRows: unknown[]): PainServerLayerRow[] {
  const rows: PainServerLayerRow[] = [];
  for (let i = 0; i < initLayerListRows.length; i++) {
    const row = normalizeInitLayerRow(initLayerListRows[i]);
    if (row) {
      rows.push(row);
    } else {
      console.warn("[initLayerList] Skipping invalid layer row at index", i, initLayerListRows[i]);
    }
  }
  return rows;
}
