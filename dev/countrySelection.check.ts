/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import type { CountryPainProfile } from "../src/countryProfile/data";
import {
  CountrySelectionController,
  type CountrySelectionChange,
} from "../src/countryProfile/selection";

function profile(iso3: string): CountryPainProfile {
  const signal = { value: 0.5, pointCount: 1 };
  return {
    iso3,
    countryName: iso3 === "AAA" ? "Alpha" : "Beta",
    emotional: {
      categoryKey: "01_hurt",
      category: "Hurt",
      nativeTerm: "Hurt",
      englishTerm: "Hurt",
      language: "en",
      script: "Latn",
      value: 0.5,
    },
    temperature: signal,
    co2: signal,
    physical: signal,
    socioeconomic: signal,
  };
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const changes: CountrySelectionChange[] = [];
const metrics: string[] = [];
const controller = new CountrySelectionController(
  new Map([
    ["AAA", profile("AAA")],
    ["BBB", profile("BBB")],
  ]),
  (change) => changes.push(change),
  (selected, enabled) => metrics.push(`${selected.iso3}:${enabled}`),
);

equal(controller.select("AAA", true), true, "open known country");
equal(controller.selectedIso3, "AAA", "selected ISO after open");
equal(metrics, ["AAA:true"], "open metric");
equal(changes.map((change) => change.action), ["open"], "open change");

controller.select("AAA", true);
equal(metrics, ["AAA:true"], "same-country select is inert");

controller.select("BBB", true);
equal(metrics, ["AAA:true", "AAA:false", "BBB:true"], "replacement metrics");
equal(changes.map((change) => change.action), ["open", "change"], "change event");

controller.clear(true);
equal(metrics.at(-1), "BBB:false", "human close metric");
equal(changes.at(-1)?.action, "close", "close event");

const metricCount = metrics.length;
controller.select("AAA", false);
controller.toggle("AAA", false);
equal(metrics.length, metricCount, "automated open and close stay out of metrics");

controller.select("AAA", true);
controller.select("AAA", false);
equal(metrics.slice(-2), ["AAA:true", "AAA:false"], "tour closes human metric");

const changeCount = changes.length;
equal(controller.select("ZZZ", true), false, "unknown country refused");
equal(changes.length, changeCount, "unknown country leaves state unchanged");

console.info("country selection check passed");
