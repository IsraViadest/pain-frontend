import type { MapLayer } from "../types/api";
import { MOCK_LAYERS } from "../../mock/layers";

// --- Mock static layers (dev mock mode only) ---

/** Static layer list for dev mock mode only (`npm run dev`). Extend {@link MOCK_LAYERS} here for frontend-only fields. */
export const UI_MAP_LAYERS: MapLayer[] = MOCK_LAYERS.map(
  ({ id, label, desc, color, geospatial, text }) => ({
    id,
    label,
    desc,
    color,
    geospatial,
    text,
  }),
);

// --- Row painorigin → layer id (production point rows) ---

/**
 * painorigin column values on point rows — maps to production layer ids from GET /init/.
 * Row painorigin (e.g. EnvNat) differs from layer list id (e.g. Env).
 * @see http://178.63.65.178:3000/init/Env (painorigin on rows)
 */
const PAIN_ORIGIN_TO_LAYER_ID: Record<string, string> = {
  EnvNat: "Env",
  Emo: "Emo",
  Phys: "Phys",
  Socioeco: "Socioeco",
};

// --- Lexicon bucket (mock + prod layer ids → semantic word-list key) ---

/** Maps layer list id (Env, Emo, …) or mock id (environmental, …) → semantic fallback word bucket. */
const LAYER_ID_TO_LEXICON_BUCKET: Record<string, string> = {
  Env: "environmental",
  environmental: "environmental",
  Phys: "physical",
  physical: "physical",
  Emo: "emotional",
  emotional: "emotional",
  Socioeco: "socioeconomic",
  socioeconomic: "socioeconomic",
};

/**
 * Resolve a layer id to a semantic lexicon bucket for word-cloud fallback words.
 *
 * @param layerId — e.g. `Emo` or mock `emotional`
 */
export function resolveLayerLexiconBucket(layerId: string): string {
  const bucket = LAYER_ID_TO_LEXICON_BUCKET[layerId.trim()];
  if (bucket) return bucket;
  console.warn(
    `[layers] Unknown layer id for lexicon bucket "${layerId}" — using "generic".`,
  );
  return "generic";
}

// --- Runtime layer cache (populated by client.fetchLayers) ---

/** Last layer list from {@link ../client.ts fetchLayers} — used for unknown painorigin fallback. */
let cachedMapLayers: MapLayer[] = [];

/** Store the layer list after a successful {@link ../client.ts fetchLayers} call. */
export function setCachedMapLayers(layers: MapLayer[]): void {
  cachedMapLayers = layers;
}

/** Lookup a layer from the cache populated by {@link setCachedMapLayers} / {@link ../client.ts fetchLayers}. */
export function getMapLayerById(id: string): MapLayer | undefined {
  return cachedMapLayers.find((layer) => layer.id === id);
}

/** First cached layer id, or `"Env"` when the cache is empty (e.g. fetchPoints before fetchLayers). */
function getDefaultLayerId(): string {
  const first = cachedMapLayers[0];
  if (first?.id) return first.id;
  return "Env";
}

/**
 * Map pain-server row `painorigin` to layer id (markers / styling).
 *
 * @param painorigin — e.g. `EnvNat` → `Env`
 */
export function painOriginToUiLayerId(painorigin: string): string {
  const key = painorigin.trim();
  const layerId = PAIN_ORIGIN_TO_LAYER_ID[key];
  if (layerId) return layerId;

  const fallbackId = getDefaultLayerId();
  const expected = Object.keys(PAIN_ORIGIN_TO_LAYER_ID).join(", ");
  console.warn(
    `[layers] Unknown painorigin "${painorigin}" — expected one of: ${expected}. Using "${fallbackId}".`,
  );
  return fallbackId;
}
