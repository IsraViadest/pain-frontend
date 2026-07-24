import type { MapLayer } from "./api";

/**
 * Raw JSON row from pain-server GET /init/:layer.
 * Field names match {@link ../api/painServerDbConfig.ts PainServerDbConfig} / db-config.env.
 * Numeric columns may arrive as strings; {@link ../api/painServerRow.ts normalizePainServerRow} coerces them.
 */
export interface PainServerRow {
  id?: number | string;
  lat?: number | string;
  lng?: number | string;
  value?: number | string;
  datatype?: string;
  painorigin?: string;
}

/**
 * Envelope from pain-server GET /init (session user id + layer metadata list).
 * `layerInfo` is validated into HUD {@link MapLayer}s (see {@link ../api/initLayerList.ts parseInitLayerListResponse}).
 */
export interface PainServerInitResponse {
  userId: string;
  layerInfo: MapLayer[];
}
