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
  id?: number | string;
  aggrid?: number | string | null;
  value?: number | string;
  category?: string;
  lat?: number | string;
  lng?: number | string;
  country?: string;
  word?: string;
}

/**
 * One layer entry from pain-server GET /init (layer metadata list).
 * Field names match the API exactly — see deployed pain-server GET /init.
 */
export interface PainServerLayerRow {
  id: string;
  label: string;
  desc: string;
  color: string;
  geospatial: boolean;
  text: boolean;
}

/**
 * Envelope from pain-server GET /init (session user id + layer metadata list).
 * Field names match the API exactly.
 */
export interface PainServerInitResponse {
  userId: string;
  layerInfo: PainServerLayerRow[];
}
