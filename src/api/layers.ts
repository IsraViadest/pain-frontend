import type { MapLayer } from "../types/api";

/** Mock-only layer ids (dev CSV / Express server). Production uses ids from GET /init/ (Env, Emo, …). */
type MockLayerId = "environmental" | "physical" | "emotional" | "socioeconomic";

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

const MOCK_LAYER_REGISTRY = [
  {
    uiLayerId: "environmental" as MockLayerId,
    apiLayer: "env",
    label: "Environmental",
    desc: "Natural and anthropogenic environmental pain (mock dev layer).",
    color: "#22785f",
    geospatial: true,
    text: false,
  },
  {
    uiLayerId: "physical" as MockLayerId,
    apiLayer: "phys",
    label: "Physical / Physiological",
    desc: "Physical pain layer (mock dev layer).",
    color: "#a0466e",
    geospatial: true,
    text: false,
  },
  {
    uiLayerId: "emotional" as MockLayerId,
    apiLayer: "emo",
    label: "Emotional",
    desc: "Emotional pain layer (mock dev layer).",
    color: "#5a6ec8",
    geospatial: false,
    text: true,
  },
  {
    uiLayerId: "socioeconomic" as MockLayerId,
    label: "Socio-economic",
    apiLayer: "socioeco",
    desc: "Socio-economic pain layer (mock dev layer).",
    color: "#be8228",
    geospatial: false,
    text: false,
  },
] as const satisfies readonly {
  uiLayerId: MockLayerId;
  apiLayer: string;
  label: string;
  desc: string;
  color: string;
  geospatial: boolean;
  text: boolean;
}[];

/** Static layer list for dev mock mode only (`npm run dev`). */
export const UI_MAP_LAYERS: MapLayer[] = MOCK_LAYER_REGISTRY.map(
  ({ uiLayerId, label, desc, color, geospatial, text }) => ({
    id: uiLayerId,
    label,
    desc,
    color,
    geospatial,
    text,
  }),
);

/** Map mock UI layer id → legacy pain-server path segment (mock dev only). */
const MOCK_UI_TO_API_LAYER: Record<MockLayerId, string> = Object.fromEntries(
  MOCK_LAYER_REGISTRY.map(({ uiLayerId, apiLayer }) => [uiLayerId, apiLayer]),
) as Record<MockLayerId, string>;

/**
 * Map layer select value to GET /init/:layer path segment.
 * Production ids (Env, Emo, …) pass through unchanged; mock ids map to legacy segments.
 *
 * @param layerId — e.g. `Env` or mock `environmental`
 */
export function uiLayerIdToApiLayer(layerId: string): string {
  if (layerId in MOCK_UI_TO_API_LAYER) {
    return MOCK_UI_TO_API_LAYER[layerId as MockLayerId];
  }
  return layerId;
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

  const expected = Object.keys(PAIN_ORIGIN_TO_LAYER_ID).join(", ");
  console.warn(
    `[layers] Unknown painorigin "${painorigin}" — expected one of: ${expected}. Using "Env".`,
  );
  return "Env";
}
