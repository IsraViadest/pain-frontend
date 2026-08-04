/**
 * pain-server row field names (keep in sync with backend `db-config.env`).
 * Union of lat/lng layers (`id`, `aggrid`, `value`, `category`, `lat`, `lng`) and
 * country layers (`country`, optional `word` on emotional).
 * @see https://github.com/7Magic7Mike7/pain-setup/blob/development/db-config.env
 */
export class PainServerDbConfig {
  static readonly TABLE_COLUMN_ID = "id";
  static readonly TABLE_COLUMN_AGGRID = "aggrid";
  static readonly TABLE_COLUMN_VALUE = "value";
  static readonly TABLE_COLUMN_CATEGORY = "category";
  static readonly TABLE_COLUMN_LAT = "lat";
  static readonly TABLE_COLUMN_LNG = "lng";
  static readonly TABLE_COLUMN_COUNTRY = "country";
  static readonly TABLE_COLUMN_WORD = "word";
}
