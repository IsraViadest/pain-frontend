/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import type { CountryPainProfile } from "./data";

export type CountrySelectionChange = {
  action: "open" | "change" | "close";
  previousIso3: string | null;
  profile: CountryPainProfile | null;
};

type TrackCountry = (profile: CountryPainProfile, enabled: boolean) => void;

/** Owns the selected country independently from the emotional network selection. */
export class CountrySelectionController {
  private selected: CountryPainProfile | null = null;
  private selectedWasTracked = false;

  constructor(
    private readonly profiles: ReadonlyMap<string, CountryPainProfile>,
    private readonly onChange: (change: CountrySelectionChange) => void,
    private readonly trackCountry: TrackCountry,
  ) {}

  get selectedIso3(): string | null {
    return this.selected?.iso3 ?? null;
  }

  select(iso3: string, human: boolean): boolean {
    const profile = this.profiles.get(iso3.trim().toUpperCase());
    if (!profile) return false;
    if (profile === this.selected) {
      if (!human && this.selectedWasTracked) {
        this.trackCountry(profile, false);
        this.selectedWasTracked = false;
      }
      return true;
    }

    const previous = this.selected;
    if (previous && (human || this.selectedWasTracked)) {
      this.trackCountry(previous, false);
    }
    if (human) this.trackCountry(profile, true);
    this.selected = profile;
    this.selectedWasTracked = human;
    this.onChange({
      action: previous ? "change" : "open",
      previousIso3: previous?.iso3 ?? null,
      profile,
    });
    return true;
  }

  toggle(iso3: string, human: boolean): boolean {
    const normalized = iso3.trim().toUpperCase();
    if (normalized === this.selected?.iso3) {
      this.clear(human);
      return true;
    }
    return this.select(normalized, human);
  }

  clear(human: boolean): void {
    if (!this.selected) return;
    const previous = this.selected;
    if (human || this.selectedWasTracked) this.trackCountry(previous, false);
    this.selected = null;
    this.selectedWasTracked = false;
    this.onChange({ action: "close", previousIso3: previous.iso3, profile: null });
  }
}
