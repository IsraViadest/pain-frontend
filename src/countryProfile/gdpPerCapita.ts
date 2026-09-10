import type { PainPoint } from "../types/api";

/** The raw GDP series is independent of the legacy already-normalized socioeconomic endpoint. */
export async function loadGdpPerCapita(): Promise<PainPoint[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}emo/gdp-per-capita-2024.json`);
  if (!response.ok) throw new Error(`GDP per capita: ${response.status}`);
  const data = await response.json() as {
    meta: { minimum: number; maximum: number; year: number; source: string; updated: string };
    countries: Record<string, number | null>;
  };
  const { minimum, maximum } = data.meta;
  if (!(minimum > 0 && maximum > minimum) || data.meta.year !== 2024) {
    throw new Error("Invalid GDP reference range or year");
  }
  return Object.entries(data.countries).flatMap(([country, value], id) => {
    if (value === null) return [];
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`Invalid GDP per capita for ${country}`);
    }
    const intensity = 1 - (Math.log(value) - Math.log(minimum)) / (Math.log(maximum) - Math.log(minimum));
    return [{ id, country, lat: null, lng: null, intensity,
      category: "GDP per capita (2024, inverted log)", uiLayer: "socioecopain", createdAt: data.meta.updated,
      metadata: { country, layerLabel: "GDP per capita", metricLabel: "current US$ per person",
        rawValue: value, year: 2024, sourceUrl: data.meta.source } }];
  });
}
