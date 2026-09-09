/** Selected emotional network. Historical variations remain on feat/country-pain-profile-rounds. */
import { DEFAULT_EMO_PARAMS, type EmoViewParams } from "./viewParams";

export interface EmoPreset {
  /** `v{round}-{letter}_{slug}`. Stable forever: it is the URL and the gallery filename. */
  id: string;
  title: string;
  /** What this preset varies and why it exists. Shown under the switcher. */
  note: string;
  /** Overrides on DEFAULT_EMO_PARAMS; anything unset keeps the default. */
  params: Partial<EmoViewParams>;
  /**
   * The control renders the incumbent sprite word cloud and hides this layer entirely. Kept as
   * a flag rather than a copy of the sprite code, which lives in GlobeView and is not broken.
   */
  useIncumbentSprites?: boolean;
}

export const EMO_PRESETS: EmoPreset[] = [{
  "id": "v14-a_base",
  "title": "Round v14: a second click on the same legend word puts it away",
  "note": "v13-a_base with legendRepeatClick set to clear. The operator's round v10 brief asked for the opposite in so many words, that a repeat click on a fully built category should build another random network, and one truncated sentence in the same brief read the other way. Both readings were put to them with the trade stated and they chose clear. Nothing else about the legend moves: a click on a different word still selects, and a click while that category's own network is still arriving still does nothing, so a half-built network is neither rerolled nor put away. The setting is a parameter defaulting to reroll, so every preset from v9 onward keeps the behaviour it shipped with and v13-a_base remains the rerolling version.",
  "params": {
    "labelMode": "bilingual",
    "identicalLines": "one",
    "leaderLines": "on",
    "clickMode": "selectNetwork",
    "networkMode": "selected",
    "categoryGraph": "delaunay",
    "fontPxFar": 14,
    "fontPxNear": 20,
    "cameraFar": 2.2,
    "cameraNear": 1.35,
    "arcWidth": 0.003,
    "arcOpacity": 1,
    "arcLift": 1.1,
    "leaderFoot": 0.8,
    "leaderWidthScale": 0.45,
    "leaderOpacityScale": 0.5,
    "labelDepthFade": 0.45,
    "labelDepthFadeCurve": 3,
    "selectionStyle": "glow",
    "selectionFill": 0.35,
    "selectionOutline": 2,
    "selectionMarkerDeg": 0.9,
    "selectionEmphasis": "both",
    "labelHalo": 0.16,
    "selectionLift": 0,
    "selectionSink": 0,
    "selectionDim": 0.55,
    "selectionMotionMs": 320,
    "selectionSpreadMs": 900,
    "selectionEmphasisScale": 1.12,
    "selectionEmphasisSecondScale": 1,
    "legend": "on",
    "legendRepeatClick": "clear",
    "leaderSpread": "on",
    "leaderSelectedWidthScale": 3,
    "leaderSelectedOpacityScale": 2,
    "leaderSpreadFrom": "split",
    "selectionLeaderMs": 260,
    "selectionLeaderShare": 0.3,
    "selectionRetractSpeed": 2
  }
}];
export const DEFAULT_EMO_PRESET_ID = "v14-a_base";
export function findEmoPreset(id: string): EmoPreset | undefined {
  return EMO_PRESETS.find((preset) => preset.id === id);
}
export function resolveEmoPresetParams(preset: EmoPreset): EmoViewParams {
  return { ...DEFAULT_EMO_PARAMS, ...preset.params };
}
