import type { EmoData } from "../emo/emoData";
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
    category: string;
    nativeTerm: string;
    englishTerm: string;
    value: number;
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

/** Build the 195 country profiles from cached layer arrays and indexed polygons. */
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
  const categoryByKey = new Map(
    emotionalData.categories.map((category) => [category.key, category]),
  );
  const profiles = new Map<string, CountryPainProfile>();

  for (const [rawIso3, country] of Object.entries(emotionalData.countries)) {
    const iso3 = rawIso3.trim().toUpperCase();
    const category = categoryByKey.get(country.cat);
    if (!category) throw new Error(`Unknown emotional category: ${country.cat}`);
    profiles.set(iso3, {
      iso3,
      countryName: country.name,
      emotional: {
        category: category.label,
        nativeTerm: country.term.trim() || category.label,
        englishTerm: country.en.trim() || category.label,
        value: country.score,
      },
      temperature: temperature.get(iso3) ?? missingSignal(),
      co2: co2.get(iso3) ?? missingSignal(),
      physical: physical.get(iso3) ?? missingSignal(),
      socioeconomic: socioeconomic.get(iso3) ?? missingSignal(),
    });
  }
  return profiles;
}

/** Linear SVG scale whose visible area is proportional to a normalized value. */
export function proportionalAreaScale(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.sqrt(Math.max(0, Math.min(1, value)));
}
