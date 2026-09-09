import { METRICS_KIND_CATEGORY, trackToggle } from "../api/metricsApi";
import { loadEmoData, type EmoData } from "../emo/emoData";
import {
  ensureCountryGeometriesLoaded,
  findCountryInGeometries,
  getCountryGeometries,
} from "../globe/countryGeometry";
import type { PainPoint } from "../types/api";
import { buildCountryPainProfiles, emotionalSignal, type CountryPainProfile } from "./data";
import { createCountryProfileView, type CountryProfileView } from "./profile";
import {
  resolveCountryProfilePreset,
  type CountryProfilePreset,
} from "./presets";
import { CountrySelectionController } from "./selection";
import {
  createEnvironmentalLegend,
  createPhysicalLegend,
  createSocioeconomicLegend,
} from "./legend";
import { CountryRenderQuality } from "./quality";

const ENVIRONMENTAL_LAYER = "envpain";
const PHYSICAL_LAYER = "physpain";
const SOCIOECONOMIC_LAYER = "socioecopain";

function requireLayer(
  pointsByLayer: ReadonlyMap<string, readonly PainPoint[]>,
  layerId: string,
): readonly PainPoint[] {
  const points = pointsByLayer.get(layerId);
  if (!points) throw new Error(`Country profile requires cached layer: ${layerId}`);
  return points;
}

/** Lazy runtime behind `?cp=1`; owns profile data and global country selection. */
export class CountryProfileRuntime {
  readonly profiles: ReadonlyMap<string, CountryPainProfile>;
  private readonly selection: CountrySelectionController;
  private environmentalLegend: SVGSVGElement | undefined;
  private physicalLegend: SVGSVGElement | undefined;
  private socioeconomicLegend: SVGSVGElement | undefined;
  readonly socioeconomicMinimum: number;
  readonly quality: CountryRenderQuality | null;
  private profileSuppressed = false;
  private originVisible = true;

  private constructor(
    profiles: ReadonlyMap<string, CountryPainProfile>,
    private readonly view: CountryProfileView,
    readonly preset: CountryProfilePreset,
    highQuality: boolean,
  ) {
    this.profiles = profiles;
    const requestedQuality = new URLSearchParams(window.location.search).get("cpQuality");
    this.quality = preset.quality || requestedQuality !== null || highQuality
      ? new CountryRenderQuality(requestedQuality ?? (highQuality ? "rich" : "auto"), highQuality) : null;
    const reference = preset.socioeconomicDataset ? 0.25 :
      preset.socioeconomicStyle ? profiles.get("JPN")?.socioeconomic.value : 0;
    if (reference === null || reference === undefined || !Number.isFinite(reference) ||
        reference < 0 || reference >= 1) {
      throw new Error("The selected socioeconomic treatment requires Japan's normalized reference");
    }
    this.socioeconomicMinimum = reference;
    this.selection = new CountrySelectionController(
      profiles,
      (change) => {
        this.view.setProfile(change.profile);
      },
      (profile, enabled) => {
        trackToggle(
          METRICS_KIND_CATEGORY,
          `${profile.iso3}:${profile.countryName}`,
          enabled,
        );
      },
    );
  }

  static async create(
    pointsByLayer: ReadonlyMap<string, readonly PainPoint[]>,
    appRoot: HTMLElement,
    layerId: string,
    emotionalData?: EmoData,
    highQuality = false,
  ): Promise<CountryProfileRuntime> {
    await ensureCountryGeometriesLoaded();
    const preset = resolveCountryProfilePreset();
    const profiles = buildCountryPainProfiles(
      emotionalData ?? await loadEmoData(preset.emotionDataset),
      {
        environmental: requireLayer(pointsByLayer, ENVIRONMENTAL_LAYER),
        physical: requireLayer(pointsByLayer, PHYSICAL_LAYER),
        socioeconomic: requireLayer(pointsByLayer, SOCIOECONOMIC_LAYER),
      },
      getCountryGeometries(),
    );
    return new CountryProfileRuntime(
      profiles,
      createCountryProfileView(appRoot, layerId, preset),
      preset,
      highQuality,
    );
  }

  get selectedIso3(): string | null {
    return this.selection.selectedIso3;
  }

  countryAt(lat: number, lng: number): string | null {
    const iso3 = findCountryInGeometries(getCountryGeometries(), lat, lng);
    return iso3 && this.profiles.has(iso3) ? iso3 : null;
  }

  select(iso3: string, human: boolean): boolean {
    return this.selection.select(iso3, human);
  }

  toggle(iso3: string, human: boolean): boolean {
    return this.selection.toggle(iso3, human);
  }

  clear(human: boolean): void {
    this.selection.clear(human);
  }

  refreshEmotions(data: EmoData): void {
    for (const [iso3, profile] of this.profiles) profile.emotional = emotionalSignal(data, iso3);
    const selected = this.selectedIso3;
    if (selected) this.view.setProfile(this.profiles.get(selected)!);
  }

  setLayer(layerId: string): void {
    this.view.setLayer(layerId);
  }

  legendForLayer(layerId: string): SVGSVGElement | undefined {
    if (layerId === PHYSICAL_LAYER && this.preset.generatedLegendOrientation === "vertical") {
      return this.physicalLegend ??= createPhysicalLegend(
        "coral", this.preset.scarDepthSize,
      );
    }
    if (layerId === SOCIOECONOMIC_LAYER && this.preset.socioeconomicStyle) {
      return this.socioeconomicLegend ??= createSocioeconomicLegend(
        this.socioeconomicMinimum, this.preset.socioeconomicStyle,
        this.preset.socioeconomicPatternContrast ?? 0.25,
        this.preset.generatedLegendOrientation === "vertical",
        this.preset.socioeconomicMissingStyle,
        this.preset.socioeconomicDataset !== undefined,
      );
    }
    if (layerId !== ENVIRONMENTAL_LAYER || !this.preset.atmosphereMode ||
        this.preset.atmosphereMode === "control") return undefined;
    return this.environmentalLegend ??= createEnvironmentalLegend(
      this.preset.generatedLegendOrientation === "vertical",
    );
  }

  setProfileSuppressed(suppressed: boolean): void {
    this.profileSuppressed = suppressed;
    this.view.setSuppressed(suppressed || !this.originVisible);
  }

  /** Visibility follows the globe while selection and presentation timing remain intact. */
  setOriginVisible(visible: boolean): void {
    if (visible === this.originVisible) return;
    this.originVisible = visible;
    this.view.setSuppressed(this.profileSuppressed || !visible);
  }

  previewCountry(iso3: string | null): void {
    if (iso3 === null) this.view.setPreview(null);
    else {
      const profile = this.profiles.get(iso3);
      if (!profile) throw new Error(`Unknown preview country: ${iso3}`);
      this.view.setPreview(profile);
    }
  }

  setAutoplay(autoplay: boolean): void {
    this.view.setAutoplay(autoplay);
  }
}
