/**
 * Raw JSON object from pain-server GET /init/:layer.
 * Field names are read via {@link ../api/painServerDbConfig.ts PainServerDbConfig}.
 */
export type PainServerRow = Record<string, unknown>;
