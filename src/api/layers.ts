import type { MapLayer } from "../types/api";

// Production HUD layer ids from GET /init. Mock mode uses different ids — see docs/BACKEND_CONTRACT.md.

/**
 * Production layer id → semantic word-list bucket for word-cloud fallbacks.
 *
 * Placeholder until GET /init provides `lexicon_bucket` per layer.
 * TODO: Remove when pain-server exposes lexicon_bucket on layer metadata.
 *
 * Mock mode layer ids (e.g. `environmental`) are not in this map — fallbacks use "generic".
 */
const LAYER_ID_TO_LEXICON_BUCKET: Record<string, string> = {
  Env: "environmental",
  Phys: "physical",
  Emo: "emotional",
  Socioeco: "socioeconomic",
};

/**
 * Production layer id → blob SVG filename under `public/blobs/`.
 *
 * Ids come from pain-server GET /init (`id` field), not from `label`.
 * Mock-mode layer ids are intentionally omitted (Pattern 23) — callers fall back to `blob1.svg`.
 */
const LAYER_ID_TO_BLOB_SVG: Record<string, string> = {
  emopain: "emotional.svg",
  envpain: "blob4.svg",
  physpain: "physical.svg",
  socioecopain: "socio_pol.svg",
};

/**
 * Resolve a production layer id to its blob button SVG asset.
 *
 * @param layerId — `id` from GET /init (not the human-readable `label`).
 * @returns Filename under `public/blobs/` (e.g. `emotional.svg`, or `blob1.svg` when unknown).
 */
export function resolveLayerBlobSvg(layerId: string): string {
  const file = LAYER_ID_TO_BLOB_SVG[layerId.trim()];
  if (file) return file;
  console.warn(
    `[layers] No blob SVG for layer id "${layerId}" — using blob1.svg. Prod ids only in LAYER_ID_TO_BLOB_SVG.`,
  );
  return "blob1.svg";
}

/**
 * Resolve a layer id to a semantic lexicon bucket for word-cloud fallback words.
 *
 * @param layerId — layer id from GET /init (actual value defined by the API)
 */
export function resolveLayerLexiconBucket(layerId: string): string {
  const bucket = LAYER_ID_TO_LEXICON_BUCKET[layerId.trim()];
  if (bucket) return bucket;
  console.warn(
    `[layers] No lexicon bucket for layer id "${layerId}" — using "generic". Mock mode? Prod ids only in LAYER_ID_TO_LEXICON_BUCKET.`,
  );
  return "generic";
}

// --- Runtime layer cache (populated by client.fetchLayers) ---

/** Last layer list from {@link ../client.ts fetchLayers} — HUD lookup via {@link getMapLayerById}. */
let cachedMapLayers: MapLayer[] = [];

/** Store the layer list after a successful {@link ../client.ts fetchLayers} call. */
export function setCachedMapLayers(layers: MapLayer[]): void {
  cachedMapLayers = layers;
}

/**
 * Returns true if the layer cache is empty.
 * Used by client.ts to warn when fetchPoints is called before fetchLayers.
 * @internal
 */
export function isLayerCacheEmpty(): boolean {
  return cachedMapLayers.length === 0;
}

/** Lookup a layer from the cache populated by {@link setCachedMapLayers} / {@link ../client.ts fetchLayers}. */
export function getMapLayerById(id: string): MapLayer | undefined {
  return cachedMapLayers.find((layer) => layer.id === id);
}
