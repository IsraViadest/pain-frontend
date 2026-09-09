/** Selected release configuration. All design rounds remain on feat/country-pain-profile-rounds. */
type CountryProfileLayout =
  | "literal-row"
  | "quiet-row"
  | "constellation"
  | "typographic-anchor"
  | "compact";

export interface CountryProfilePreset {
  id: string;
  label: string;
  description: string;
  layout: CountryProfileLayout;
  /** The operator's expressive-globe refinement; omitted preserves the v1-v7 treatment. */
  refinement?: boolean;
  compactSize?: "small" | "medium" | "large";
  glyphInset?: number;
  plateOpacity?: number;
  emotionalCaption?: "quiet" | "none";
  nativeOpacity?: number;
  roundedScarShoulder?: boolean;
  scarDepthStyle?: "none" | "hillshade" | "contour-land" | "contour-all" | "hybrid" |
    "relief" | "shadow";
  scarContourStyle?: "land-blue" | "all-blue" | "land-red" | "all-red" |
    "water-blue" | "water-coral" | "water-dots" |
    "water-blue-depth" | "water-coral-depth" | "water-dots-depth";
  scarContourLevels?: 16 | 24;
  scarReliefPalette?: "coral" | "crimson" | "rose" | "vibrant";
  scarDepthSize?: boolean | "recessed-small";
  physicalOceanBlue?: boolean;
  surfaceDetail?: 1 | 2;
  countryContourDegrees?: number;
  selectionPeerStrength?: number;
  /** Total indicator fade-out plus fade-in time. Omitted means the v1 instant switch. */
  transitionMs?: number;
  physicalPointScale?: number;
  physicalDetail?: "fixed" | "regrow" | "split1" | "split2" | "uniform";
  stippleAllLayers?: boolean;
  stipplePointCount?: 82_000 | 164_000;
  atmosphereMode?: "control" | "flat" | "mantle" | "cloudlets" | "volume" |
    "volume-strong" | "volume-separated" | "volume-strong-separated" |
    "volume-very-strong-separated" | "volume-near-opaque-separated" |
    "volume-log-separated" |
    "volume-log-near-opaque-separated";
  atmosphereSamples?: 16 | 32 | 48;
  atmosphereFraction?: number;
  atmosphereSmooth?: boolean;
  socioeconomicDataset?: "gdp-per-capita-2024";
  emotionDataset?: "combined-v2" | "combined-v2-no-anger";
  fitShortScreenControls?: boolean;
  environmentalContextOpacity?: number;
  socioeconomicStyle?: "color" | "hatch" | "woven";
  socioeconomicContextOpacity?: number;
  socioeconomicPatternContrast?: number;
  socioeconomicMissingStyle?: "diagonal" | "cross";
  quality?: boolean;
  chromeOcclusion?: boolean;
  physicalPointNearBoost?: number;
  environmentalGlyph?: "simple" | "grain" | "cells";
  environmentalFieldPattern?:
    | "smooth"
    | "grain"
    | "hex"
    | "fine-grain"
    | "fine-hex";
  profileSpacing?: "slots" | "painted-n";
  centerEnglishTerm?: boolean;
  profileGlow?: "none" | "wide";
  profileReveal?: "none" | "soft";
  profileOrder?: "country-first" | "indicators-first";
  profileHardOutline?: boolean;
  profileMissingPattern?: boolean;
  profilePlate?: "fixed" | "content-fade";
  sharePainLabel?: string;
  sharePainLooseLines?: boolean;
  generatedLegendOrientation?: "responsive" | "vertical";
  emotionalLegendHalo?: boolean;
  cycle?: {
    preserveZoom?: boolean;
    revealWithNetwork?: boolean;
    previewDuringFlight?: boolean;
    prepareMs?: number;
    flightMs?: number;
    dwellMs?: number;
    motionScale?: number;
  };
}

const CURRENT_COUNTRY_PROFILE: CountryProfilePreset = {
  "layout": "compact",
  "refinement": true,
  "compactSize": "medium",
  "glyphInset": 0.88,
  "plateOpacity": 0.36,
  "transitionMs": 240,
  "physicalPointScale": 1.18,
  "environmentalFieldPattern": "smooth",
  "surfaceDetail": 2,
  "roundedScarShoulder": true,
  "selectionPeerStrength": 0.5,
  "physicalDetail": "regrow",
  "atmosphereMode": "mantle",
  "atmosphereSamples": 16,
  "environmentalContextOpacity": 0.25,
  "socioeconomicStyle": "hatch",
  "socioeconomicContextOpacity": 0.25,
  "socioeconomicPatternContrast": 0.1,
  "quality": true,
  "chromeOcclusion": true,
  "profileSpacing": "painted-n",
  "centerEnglishTerm": true,
  "profileGlow": "none",
  "profileReveal": "soft",
  "cycle": {
    "preserveZoom": true,
    "previewDuringFlight": false,
    "revealWithNetwork": true,
    "prepareMs": 400,
    "flightMs": 1500,
    "dwellMs": 10500,
    "motionScale": 1
  },
  "profileOrder": "indicators-first",
  "profileHardOutline": false,
  "profileMissingPattern": true,
  "profilePlate": "content-fade",
  "sharePainLabel": "share and locate\nyour pain",
  "sharePainLooseLines": true,
  "generatedLegendOrientation": "vertical",
  "emotionalLegendHalo": true,
  "socioeconomicMissingStyle": "diagonal",
  "stippleAllLayers": true,
  "stipplePointCount": 82000,
  "scarDepthStyle": "relief",
  "scarReliefPalette": "coral",
  "physicalOceanBlue": true,
  "scarContourStyle": "water-dots-depth",
  "scarContourLevels": 16,
  "id": "v48-a_web",
  "label": "v48: web and projection",
  "description": "Dark red water contours, all combined emotions, and inverse GDP per capita. Projection retains the share-button space and defaults to high resolution.",
  "socioeconomicDataset": "gdp-per-capita-2024",
  "emotionDataset": "combined-v2",
  "fitShortScreenControls": true
};

/** Historical cpPreset URLs now open the selected release. */
export function resolveCountryProfilePreset(): CountryProfilePreset {
  return CURRENT_COUNTRY_PROFILE;
}
