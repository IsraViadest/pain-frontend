export type PainLayerId =
  | "environmental"
  | "physical"
  | "emotional"
  | "socioeconomic";

export interface MapLayer {
  id: PainLayerId | string;
  label: string;
  description?: string;
  /** When the pipeline serves files, the client can load this instead of procedural textures. */
  textureUrl?: string;
  /** Human-readable source for the prototype dataset (CSV / pipeline). */
  dataSource?: string;
}

export interface PainPoint {
  id: string;
  lat: number;
  lng: number;
  type: string;
  intensity: number;
  /** pain-server row `datatype` (metric / category label from API). */
  datatype?: string;
  text?: string;
  /** Hover / multiplex display fields only — not used for scar stamping. */
  metadata?: PainPointMetadata;
  /**
   * Scar height-map column (0…999) when API coords are still grid indices.
   * Used only by `painScarField.ts`; never shown in tooltips.
   */
  scarMapTexelX?: number;
  /** Scar height-map row (0…481, north at 0); internal stamping only. */
  scarMapTexelY?: number;
  createdAt: string;
}

interface PainPointMetadata {
  country: string;
  layerLabel: string;
  metricLabel: string;
  rawValue: number;
  year?: number;
  sourceUrl: string;
}

export interface PainSubmission {
  lat: number;
  lng: number;
  type: string;
  intensity?: number;
  /** pain-server `datatype` for the submission payload. */
  datatype?: string;
  text?: string;
}

export interface LayersResponse {
  layers: MapLayer[];
}

export interface PointsResponse {
  points: PainPoint[];
}

export interface SubmissionResponse {
  point: PainPoint;
}
