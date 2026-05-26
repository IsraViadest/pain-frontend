/**
 * Raw JSON object from pain-server GET /init/:layer.
 * Parsed in {@link ../api/painServerRow.ts}; field names via {@link ../api/painServerDbConfig.ts PainServerDbConfig}.
 */
export type PainServerRow = Record<string, unknown>;
