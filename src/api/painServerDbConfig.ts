/**
 * pain-server row field names (keep in sync with backend `db-config.env`).
 * @see https://github.com/7Magic7Mike7/pain-setup/blob/development/db-config.env
 */
export class PainServerDbConfig {
  static readonly TABLE_COLUMN_ID = "id";
  static readonly TABLE_COLUMN_LAT = "lat";
  static readonly TABLE_COLUMN_LNG = "lng";
  static readonly TABLE_COLUMN_VALUE = "value";
  static readonly TABLE_COLUMN_DATATYPE = "datatype";
  static readonly TABLE_COLUMN_PAINORIGIN = "painorigin";
}
