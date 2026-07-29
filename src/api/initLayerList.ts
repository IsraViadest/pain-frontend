/**
 * Normalizes pain-server GET /init (layer metadata list) into {@link MapLayer}s.
 */
import type { MapLayer } from "../types/api";

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
 * Validate and normalize one layer metadata object from GET /init.
 *
 * @param initLayerRow — single JSON object from the layer list response.
 * @returns A {@link MapLayer} when required fields are present; `null` if the shape or any required field is invalid.
 */
function normalizeInitLayerRow(initLayerRow: unknown): MapLayer | null {
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
 * Validate each row from GET /init; skip invalid entries with a warning.
 *
 * @param initLayerListRows — raw `layerInfo` array from pain-server GET /init.
 * @returns Validated {@link MapLayer} list for the HUD / layer cache.
 */
export function parseInitLayerListResponse(initLayerListRows: unknown[]): MapLayer[] {
  const layers: MapLayer[] = [];
  for (let i = 0; i < initLayerListRows.length; i++) {
    const layer = normalizeInitLayerRow(initLayerListRows[i]);
    if (layer) {
      layers.push(layer);
    } else {
      console.warn("[initLayerList] Skipping invalid layer row at index", i, initLayerListRows[i]);
    }
  }
  return layers;
}
