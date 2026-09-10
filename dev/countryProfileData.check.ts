/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import type { EmoData } from "../src/emo/emoData";
import { buildCountryGeometries } from "../src/globe/countryGeometry";
import type { PainPoint } from "../src/types/api";
import {
  buildCountryPainProfiles,
  proportionalAreaScale,
} from "../src/countryProfile/data";

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function point(
  uiLayer: string,
  intensity: number,
  category: string,
  lat: number | null,
  lng: number | null,
  country?: string,
): PainPoint {
  return {
    id: Math.round(intensity * 1000),
    uiLayer,
    intensity,
    category,
    lat,
    lng,
    country,
    createdAt: "2026-09-05T00:00:00Z",
  };
}

const geometries = buildCountryGeometries({
  features: [
    {
      properties: { ISO_A3: "AAA" },
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
    },
    {
      properties: { ISO_A3: "BBB" },
      geometry: {
        type: "Polygon",
        coordinates: [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]],
      },
    },
  ],
});

const emotionalData: EmoData = {
  meta: {
    generated: "2026-09-05T00:00:00Z",
    source: { lexicon: "fixture", percentages: "fixture", percentagesAreDummy: true },
    rule: "fixture",
    countryCount: 2,
    categoryCount: 1,
    englishFallbackCount: 1,
    tiedWinnerCount: 0,
  },
  categories: [
    { key: "01_hurt", catKey: "hurt", label: "Hurt", family: "fixture" },
  ],
  countries: {
    AAA: {
      name: "Alpha",
      cat: "01_hurt",
      score: 0.75,
      term: "Dolor",
      en: "Hurt",
      lang: "aa",
      langEn: "Alpha",
      script: "Latn",
      terms: {},
      scores: {},
    },
    BBB: {
      name: "Beta",
      cat: "01_hurt",
      score: 0.5,
      term: "",
      en: "",
      lang: "bb",
      langEn: "Beta",
      script: "Latn",
      terms: {},
      scores: {},
    },
  },
};

const profiles = buildCountryPainProfiles(
  emotionalData,
  {
    environmental: [
      point("envpain", 0.2, "Temperature", 2, 2),
      point("envpain", 0.8, "Temperature", 3, 3),
      point("envpain", 0.4, "CO2", 4, 4),
      point("envpain", 1, "Temperature", -40, -40),
    ],
    physical: [
      point("physpain", 0.3, "Migraine", 2, 2),
      point("physpain", 0.9, "Low back pain", 3, 3),
    ],
    socioeconomic: [
      point("socioecopain", 0.5, "GDP", null, null, "AAA"),
      point("socioecopain", 0.6, "GDP", null, null, "AAA"),
      point("socioecopain", 0.2, "GDP", null, null, "BBB"),
    ],
  },
  geometries,
);

equal(profiles.size, 2, "profile count");
const alpha = profiles.get("AAA")!;
equal(alpha.countryName, "Alpha", "country name");
equal(alpha.emotional.nativeTerm, "Dolor", "native term");
equal(alpha.emotional.englishTerm, "Hurt", "English category term");
equal(alpha.temperature.value, 0.8, "temperature peak");
equal(alpha.temperature.pointCount, 2, "temperature count");
equal(alpha.co2.value, 0.4, "CO2 peak");
equal(alpha.co2.pointCount, 1, "CO2 count");
equal(alpha.physical.value, 0.9, "physical peak");
equal(alpha.physical.pointCount, 2, "physical count");
equal(alpha.socioeconomic.value, 0.6, "socioeconomic peak");
equal(alpha.socioeconomic.pointCount, 2, "socioeconomic count");

const beta = profiles.get("BBB")!;
equal(beta.emotional.nativeTerm, "Hurt", "missing native fallback");
equal(beta.emotional.englishTerm, "Hurt", "missing English fallback");
equal(beta.temperature.value, null, "missing temperature");
equal(beta.temperature.pointCount, 0, "missing temperature count");
equal(beta.socioeconomic.value, 0.2, "Beta socioeconomic value");

equal(proportionalAreaScale(null), 0, "missing scale");
equal(proportionalAreaScale(-1), 0, "negative scale");
equal(proportionalAreaScale(0.25), 0.5, "quarter-area scale");
equal(proportionalAreaScale(4), 1, "scale upper clamp");

console.info(`country profile data check passed: ${profiles.size} profiles`);
