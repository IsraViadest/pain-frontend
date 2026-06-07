export interface MapLayer {
  id: string;
  label: string;
  desc: string;
  color: string;
  /** TODO: fetched from GET /init/ but not yet used by the HUD (no filtering of non-geospatial layers). */
  geospatial: boolean;
  text: boolean;
}

export interface PainPoint {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  /** pain-server row `datatype` (metric / category label from API). */
  datatype?: string;
  /** HUD layer id derived from pain-server `painorigin` (see {@link ../api/layers.ts painOriginToUiLayerId}). */
  uiLayer: string;
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
