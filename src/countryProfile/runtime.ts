import { METRICS_KIND_CATEGORY, trackToggle } from "../api/metricsApi";
import { loadEmoData } from "../emo/emoData";
import {
  ensureCountryGeometriesLoaded,
  findCountryInGeometries,
  getCountryGeometries,
} from "../globe/countryGeometry";
import type { PainPoint } from "../types/api";
import { buildCountryPainProfiles, type CountryPainProfile } from "./data";
import { createCountryProfileView, type CountryProfileView } from "./profile";
import {
  resolveCountryProfilePreset,
  type CountryProfilePreset,
} from "./presets";
import { CountrySelectionController } from "./selection";
import { createEnvironmentalLegend, createSocioeconomicLegend } from "./legend";

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
  private socioeconomicLegend: SVGSVGElement | undefined;
  readonly socioeconomicMinimum: number;

  private constructor(
    profiles: ReadonlyMap<string, CountryPainProfile>,
    private readonly view: CountryProfileView,
    readonly preset: CountryProfilePreset,
  ) {
    this.profiles = profiles;
    const reference = preset.socioeconomicStyle ? profiles.get("JPN")?.socioeconomic.value : 0;
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
  ): Promise<CountryProfileRuntime> {
    await ensureCountryGeometriesLoaded();
    const profiles = buildCountryPainProfiles(
      await loadEmoData(),
      {
        environmental: requireLayer(pointsByLayer, ENVIRONMENTAL_LAYER),
        physical: requireLayer(pointsByLayer, PHYSICAL_LAYER),
        socioeconomic: requireLayer(pointsByLayer, SOCIOECONOMIC_LAYER),
      },
      getCountryGeometries(),
    );
    const preset = resolveCountryProfilePreset();
    return new CountryProfileRuntime(
      profiles,
      createCountryProfileView(appRoot, layerId, preset),
      preset,
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

  setLayer(layerId: string): void {
    this.view.setLayer(layerId);
  }

  legendForLayer(layerId: string): SVGSVGElement | undefined {
    if (layerId === SOCIOECONOMIC_LAYER && this.preset.socioeconomicStyle) {
      return this.socioeconomicLegend ??= createSocioeconomicLegend(
        this.socioeconomicMinimum, this.preset.socioeconomicStyle,
        this.preset.socioeconomicPatternContrast ?? 0.25,
      );
    }
    if (layerId !== ENVIRONMENTAL_LAYER || !this.preset.atmosphereMode ||
        this.preset.atmosphereMode === "control") return undefined;
    return this.environmentalLegend ??= createEnvironmentalLegend();
  }

  setProfileSuppressed(suppressed: boolean): void {
    this.view.setSuppressed(suppressed);
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
