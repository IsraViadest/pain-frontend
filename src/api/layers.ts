import type { MapLayer, PainLayerId } from "../types/api";

/**
 * painorigin column values — canonical set from Mike's deployed pain-server.
 * @see http://178.63.65.178:3000/init/env (and /init/phys, /emo, /socioeco)
 */
const LAYER_REGISTRY = [
  {
    uiLayerId: "environmental",
    apiLayer: "env",
    painOrigin: "EnvNat",
    label: "Environmental",
    description: "Natural and anthropogenic environmental pain (API layer: env).",
  },
  {
    uiLayerId: "physical",
    apiLayer: "phys",
    painOrigin: "Phys",
    label: "Physical / Physiological",
    description: "Physical pain layer (API layer: phys).",
  },
  {
    uiLayerId: "emotional",
    apiLayer: "emo",
    painOrigin: "Emo",
    label: "Emotional",
    description: "Emotional pain layer (API layer: emo).",
  },
  {
    uiLayerId: "socioeconomic",
    apiLayer: "socioeco",
    painOrigin: "Socioeco",
    label: "Socio-economic",
    description: "Socio-economic pain layer (API layer: socioeco).",
  },
] as const satisfies readonly {
  uiLayerId: PainLayerId;
  apiLayer: string;
  painOrigin: string;
  label: string;
  description: string;
}[];

/**
 * UI layer list (labels, descriptions) — owned by the frontend per backend contract.
 * pain-server only provides data via GET /init/:layer; it does not serve this metadata.
 */
export const UI_MAP_LAYERS: MapLayer[] = LAYER_REGISTRY.map(
  ({ uiLayerId, label, description }) => ({
    id: uiLayerId,
    label,
    description,
  }),
);

/** Map UI select value → pain-server :layer param (input-validator.ts). */
const UI_TO_API_LAYER: Record<PainLayerId, string> = Object.fromEntries(
  LAYER_REGISTRY.map(({ uiLayerId, apiLayer }) => [uiLayerId, apiLayer]),
) as Record<PainLayerId, string>;

/** painorigin → HUD layer id (exact match on {@link LAYER_REGISTRY} painOrigin values). */
const PAIN_ORIGIN_TO_UI_LAYER: Record<string, PainLayerId> = Object.fromEntries(
  LAYER_REGISTRY.map(({ painOrigin, uiLayerId }) => [painOrigin, uiLayerId]),
) as Record<string, PainLayerId>;

/**
 * Map HUD layer id to pain-server `:layer` path segment (see input-validator.ts).
 *
 * @param uiLayerId — e.g. `environmental` → `env`
 */
export function uiLayerIdToApiLayer(uiLayerId: string): string {
  if (!(uiLayerId in UI_TO_API_LAYER)) {
    console.warn(
      `[layers] Unknown UI layer id "${uiLayerId}" — using it verbatim for GET /init/:layer. If intentional, add it to UI_TO_API_LAYER (input-validator).`,
    );
    return uiLayerId;
  }
  return UI_TO_API_LAYER[uiLayerId as PainLayerId];
}

/**
 * Map pain-server row `painorigin` to HUD layer id (markers / styling).
 * Counterpart to {@link uiLayerIdToApiLayer}.
 *
 * @param painorigin — e.g. `EnvNat` → `environmental`
 */
export function painOriginToUiLayerId(painorigin: string): PainLayerId {
  const key = painorigin.trim();
  const uiLayerId = PAIN_ORIGIN_TO_UI_LAYER[key];
  if (uiLayerId) return uiLayerId;

  const expected = LAYER_REGISTRY.map((entry) => entry.painOrigin).join(", ");
  console.warn(
    `[layers] Unknown painorigin "${painorigin}" — expected one of: ${expected}. Using "environmental".`,
  );
  return "environmental";
}
