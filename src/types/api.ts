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
  intensity: number;
  /** pain-server row `datatype` (metric / category label from API). */
  datatype?: string;
  /** HUD layer id derived from pain-server `painorigin` (see {@link ../api/layers.ts painOriginToUiLayerId}). */
  uiLayer: PainLayerId | string;
  text?: string;
  /** Hover / multiplex display fields only. */
  metadata?: PainPointMetadata;
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
