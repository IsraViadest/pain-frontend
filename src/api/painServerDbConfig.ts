/**
 * pain-server row field names (keep in sync with backend `db-config.env`).
 * @see https://github.com/7Magic7Mike7/pain-setup/blob/development/db-config.env
 */
export class PainServerDbConfig {
  static readonly TABLE_COLUMN_ID = "id";
  /** DummyPain texture column index (pain-server column `x`). */
  static readonly TABLE_COLUMN_LAT = "x";
  /** DummyPain texture row index (pain-server column `y`, north at 0). */
  static readonly TABLE_COLUMN_LNG = "y";
  static readonly TABLE_COLUMN_VALUE = "value";
  static readonly TABLE_COLUMN_DATATYPE = "datatype";
  static readonly TABLE_COLUMN_PAINORIGIN = "painorigin";
}

/** Fallback keys for older pain-server builds / local DB exports. */
export const PAIN_SERVER_ROW_ALIASES = {
  painorigin: ["painorigin", "pain_origin"],
  lat: ["lat", "latitude"],
  lng: ["lng", "longitude"],
} as const;
