export interface MapLayer {
  id: string;
  label: string;
  desc: string;
  color: string;
  /** When false with `text: false`, GlobeView shows a country choropleth (not scars/markers). */
  geospatial: boolean;
  text: boolean;
}

export interface PainPoint {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  /** pain-server row `category` (metric / category label from API). */
  category?: string;
  /** pain-server row `country` when present (country-layer rows). */
  country?: string;
  /** pain-server row `word` when present (emotional layer). */
  word?: string;
  /** HUD layer id from the `fetchPoints(layerId)` request (GET /init/:layer path segment). */
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
