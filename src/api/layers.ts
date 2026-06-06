import type { MapLayer } from "../types/api";

/** Mock-only layer ids (dev CSV / Express server). Production uses ids from GET /init/ (Env, Emo, …). */
type MockLayerId = "environmental" | "physical" | "emotional" | "socioeconomic";

// --- Mock static layers (dev mock mode only) ---

const MOCK_LAYER_REGISTRY = [
  {
    id: "environmental" as MockLayerId,
    label: "Environmental",
    desc: "Natural and anthropogenic environmental pain (mock dev layer).",
    color: "#22785f",
    geospatial: true,
    text: false,
  },
  {
    id: "physical" as MockLayerId,
    label: "Physical / Physiological",
    desc: "Physical pain layer (mock dev layer).",
    color: "#a0466e",
    geospatial: true,
    text: false,
  },
  {
    id: "emotional" as MockLayerId,
    label: "Emotional",
    desc: "Emotional pain layer (mock dev layer).",
    color: "#5a6ec8",
    geospatial: false,
    text: true,
  },
  {
    id: "socioeconomic" as MockLayerId,
    label: "Socio-economic",
    desc: "Socio-economic pain layer (mock dev layer).",
    color: "#be8228",
    geospatial: false,
    text: false,
  },
] as const satisfies readonly {
  id: MockLayerId;
  label: string;
  desc: string;
  color: string;
  geospatial: boolean;
  text: boolean;
}[];

/** Static layer list for dev mock mode only (`npm run dev`). */
export const UI_MAP_LAYERS: MapLayer[] = MOCK_LAYER_REGISTRY.map(
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

// --- Runtime layer cache (populated by client.fetchLayers) ---

/** Last layer list from {@link ../client.ts fetchLayers} — used for unknown painorigin fallback. */
let cachedMapLayers: MapLayer[] = [];

/** Store the layer list after a successful {@link ../client.ts fetchLayers} call. */
export function setCachedMapLayers(layers: MapLayer[]): void {
  cachedMapLayers = layers;
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
