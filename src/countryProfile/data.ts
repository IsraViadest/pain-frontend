/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import { emoCategoryLabel, emoNativeTerm, type EmoData } from "../emo/emoData";
import { aggregateChoroplethValues } from "../globe/choroplethField";
import {
  findCountryInGeometries,
  type IndexedCountryGeometry,
} from "../globe/countryGeometry";
import { hasPainPointCoordinates } from "../globe/latLng";
import type { PainPoint } from "../types/api";

const TEMPERATURE_CATEGORY = "Temperature";
const CO2_CATEGORY = "CO2";

interface CountrySignal {
  value: number | null;
  pointCount: number;
}

export interface CountryPainProfile {
  iso3: string;
  countryName: string;
  emotional: {
    categoryKey: string;
    category: string;
    nativeTerm: string;
    englishTerm: string;
    language: string;
    script: string;
    value: number | null;
    filteredOut?: boolean;
  };
  temperature: CountrySignal;
  co2: CountrySignal;
  physical: CountrySignal;
  socioeconomic: CountrySignal;
}

interface CountryProfileLayerData {
  environmental: readonly PainPoint[];
  physical: readonly PainPoint[];
  socioeconomic: readonly PainPoint[];
}

function aggregateGeospatialSignal(
  points: readonly PainPoint[],
  countries: readonly IndexedCountryGeometry[],
  category: string | null,
): Map<string, CountrySignal> {
  const result = new Map<string, CountrySignal>();
  for (const point of points) {
    if (category !== null && point.category !== category) continue;
    if (!hasPainPointCoordinates(point)) continue;
    const iso3 = findCountryInGeometries(countries, point.lat, point.lng);
    if (!iso3) continue;
    const previous = result.get(iso3);
    result.set(iso3, {
      value:
        previous?.value === null || previous?.value === undefined
          ? point.intensity
          : Math.max(previous.value, point.intensity),
      pointCount: (previous?.pointCount ?? 0) + 1,
    });
  }
  return result;
}

function aggregateSocioeconomicSignal(
  points: readonly PainPoint[],
): Map<string, CountrySignal> {
  const counts = new Map<string, number>();
  for (const point of points) {
    const iso3 = point.country?.trim().toUpperCase();
    if (iso3) counts.set(iso3, (counts.get(iso3) ?? 0) + 1);
  }
  return new Map(
    aggregateChoroplethValues([...points]).map(({ country, intensity }) => [
      country,
      { value: intensity, pointCount: counts.get(country) ?? 0 },
    ]),
  );
}

const missingSignal = (): CountrySignal => ({ value: null, pointCount: 0 });

/** Geography owns selection coverage; emotional observations can be absent for a territory. */
export function buildCountryPainProfiles(
  emotionalData: EmoData,
  layers: CountryProfileLayerData,
  countries: readonly IndexedCountryGeometry[],
): Map<string, CountryPainProfile> {
  if (countries.length === 0) {
    throw new Error("Country geometries must be loaded before building profiles");
  }
  const temperature = aggregateGeospatialSignal(
    layers.environmental,
    countries,
    TEMPERATURE_CATEGORY,
  );
  const co2 = aggregateGeospatialSignal(
    layers.environmental,
    countries,
    CO2_CATEGORY,
  );
  const physical = aggregateGeospatialSignal(layers.physical, countries, null);
  const socioeconomic = aggregateSocioeconomicSignal(layers.socioeconomic);
  const profiles = new Map<string, CountryPainProfile>();
  const roster = new Map(countries.map((country) => [country.key, country.name]));
  for (const [iso3, country] of Object.entries({
    ...emotionalData.countries, ...emotionalData.missingCountries,
  })) roster.set(iso3, country.name);
  for (const [rawIso3, countryName] of roster) {
    const iso3 = rawIso3.trim().toUpperCase();
    profiles.set(iso3, {
      iso3, countryName,
      emotional: emotionalSignal(emotionalData, rawIso3),
      temperature: temperature.get(iso3) ?? missingSignal(),
      co2: co2.get(iso3) ?? missingSignal(),
      physical: physical.get(iso3) ?? missingSignal(),
      socioeconomic: socioeconomic.get(iso3) ?? missingSignal(),
    });
  }
  return profiles;
}

/** Shared by initial aggregation and live category filtering; other signals stay intact. */
export function emotionalSignal(data: EmoData, iso3: string): CountryPainProfile["emotional"] {
  const country = data.countries[iso3];
  if (!country) {
    const missing = data.missingCountries?.[iso3];
    // Geographic profiles survive emotion filtering even when the source never covered them.
    return { categoryKey: "", category: "", nativeTerm: "", englishTerm: "",
      language: missing?.lang ?? "und", script: missing?.script ?? "Latn", value: null,
      filteredOut: missing?.filteredOut };
  }
  const category = data.categories.find((c) => c.key === country.cat);
  if (!category) throw new Error(`Unknown emotional category: ${country.cat}`);
  return { categoryKey: country.cat, category: emoCategoryLabel(category),
    nativeTerm: emoNativeTerm(country).trim() || emoCategoryLabel(category),
    englishTerm: emoCategoryLabel(category),
    language: country.lang, script: country.script, value: country.score };
}

/** Linear SVG scale whose visible area is proportional to a normalized value. */
export function proportionalAreaScale(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.sqrt(Math.max(0, Math.min(1, value)));
}
