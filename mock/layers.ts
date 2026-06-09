/**
 * Shared mock layer metadata for dev only (`npm run dev` + Express `server/`).
 *
 * Imported by `mock/loadMapLayers.ts` (HUD mock layer list), `server/index.ts`
 * (`GET /api/map/layers`). Production uses pain-server GET /init instead.
 */

/** Mock layer row shape (matches pain-server GET /init and {@link ../src/types/api.ts MapLayer}). */
export type MockLayerFixture = {
  id: string;
  label: string;
  desc: string;
  color: string;
  geospatial: boolean;
  text: boolean;
};

/** Canonical mock layer list — ids match dev CSV / Express point filtering. */
export const MOCK_LAYERS: readonly MockLayerFixture[] = [
  {
    id: "environmental",
    label: "Environmental",
    desc: "Natural and anthropogenic environmental pain (mock dev layer).",
    color: "#22785f",
    geospatial: true,
    text: false,
  },
  {
    id: "physical",
    label: "Physical / Physiological",
    desc: "Physical pain layer (mock dev layer).",
    color: "#a0466e",
    geospatial: true,
    text: false,
  },
  {
    id: "emotional",
    label: "Emotional",
    desc: "Emotional pain layer (mock dev layer).",
    color: "#5a6ec8",
    geospatial: false,
    text: true,
  },
  {
    id: "socioeconomic",
    label: "Socio-economic",
    desc: "Socio-economic pain layer (mock dev layer).",
    color: "#be8228",
    geospatial: false,
    text: false,
  },
];
