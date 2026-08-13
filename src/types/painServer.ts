import type { MapLayer } from "./api";

/**
 * Raw JSON row from pain-server GET /init/:layer.
 * Field names match {@link ../api/painServerDbConfig.ts PainServerDbConfig} / db-config.env.
 *
 * Two shapes:
 * - Lat/lng layers: `id`, `aggrid`, `value`, `category`, `lat`, `lng`
 * - Country layers: `id`, `aggrid`, `value`, `category`, `country` (emotional may include `word`)
 *
 * Numeric columns may arrive as strings; {@link ../api/painServerRow.ts normalizePainServerRow} coerces them.
 */
export interface PainServerRow {
  id?: number;
  aggrid?: number | null;
  value?: number;
  category?: string;
  lat?: number;
  lng?: number;
  country?: string;
  word?: string;
}

/**
 * Envelope from pain-server GET /init (session user id + layer metadata list).
 * `layerInfo` is validated into HUD {@link MapLayer}s (see {@link ../api/initLayerList.ts parseInitLayerListResponse}).
 */
export interface PainServerInitResponse {
  userId: string;
  layerInfo: MapLayer[];
}
