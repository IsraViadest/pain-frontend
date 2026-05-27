import type { MapLayer, PainLayerId } from "../types/api";

/**
 * UI layer list (labels, descriptions) — owned by the frontend per backend contract.
 * pain-server only provides data via GET /init/:layer; it does not serve this metadata.
 */
export const UI_MAP_LAYERS: MapLayer[] = [
  {
    id: "environmental",
    label: "Environmental",
    description: "Natural and anthropogenic environmental pain (API layer: env).",
  },
  {
    id: "physical",
    label: "Physical / Physiological",
    description: "Physical pain layer (API layer: phys).",
  },
  {
    id: "emotional",
    label: "Emotional",
    description: "Emotional pain layer (API layer: emo).",
  },
  {
    id: "socioeconomic",
    label: "Socio-economic",
    description: "Socio-economic pain layer (API layer: socioeco).",
  },
];

/** Map UI select value → pain-server :layer param (input-validator.ts). */
const UI_TO_API_LAYER: Record<PainLayerId, string> = {
  environmental: "env",
  physical: "phys",
  emotional: "emo",
  socioeconomic: "socioeco",
};

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
