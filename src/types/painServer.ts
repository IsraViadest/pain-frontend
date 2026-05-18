/**
 * Row shape returned by pain-server GET /init/:layer (prototype branch).
 * x/y are equirectangular texture pixel indices (0…999 × 0…481), not degrees.
 * Convert with resolvePainServerCoordinates() before placing on the globe.
 * @see https://github.com/7Magic7Mike7/pain-server/blob/prototype/scripts/db-loader.ts
 */
export interface PainServerRow {
  id: number;
  /** Texture column (longitude axis on 1000px-wide equirect map). */
  x: number;
  /** Texture row (latitude axis on 482px-tall equirect map, origin top). */
  y: number;
  value: number;
  datatype: string;
  painorigin: string;
}
