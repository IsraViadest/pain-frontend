import { readFileSync } from "node:fs";
import {
  buildCountryGeometries,
  findCountryInGeometries,
} from "../src/globe/countryGeometry";

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const squareWithHole = buildCountryGeometries({
  features: [
    {
      properties: { ISO_A3: "BOX" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
        ],
      },
    },
  ],
});
equal(findCountryInGeometries(squareWithHole, 2, 2), "BOX", "polygon interior");
equal(findCountryInGeometries(squareWithHole, 5, 5), null, "polygon hole");
equal(findCountryInGeometries(squareWithHole, 0, 5), "BOX", "polygon boundary");

const antimeridian = buildCountryGeometries({
  features: [
    {
      properties: { ISO_A3: "-99", ADM0_A3: "DAT" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [[179, -10], [-179, -10], [-179, 10], [179, 10], [179, -10]],
        ],
      },
    },
  ],
});
equal(findCountryInGeometries(antimeridian, 0, 179.5), "DAT", "east seam");
equal(findCountryInGeometries(antimeridian, 0, -179.5), "DAT", "west seam");
equal(findCountryInGeometries(antimeridian, 0, 0), null, "away from seam");

const sourceUrl = new URL(
  "../public/borders/ne_110m_admin_0_countries.geojson",
  import.meta.url,
);
const countries = buildCountryGeometries(
  JSON.parse(readFileSync(sourceUrl, "utf8")) as Parameters<
    typeof buildCountryGeometries
  >[0],
);
equal(countries.length, 177, "Natural Earth country count");
equal(findCountryInGeometries(countries, 48.2082, 16.3738), "AUT", "Vienna");
equal(findCountryInGeometries(countries, 28.6139, 77.209), "IND", "New Delhi");
equal(findCountryInGeometries(countries, -41.2866, 174.7756), "NZL", "Wellington");
equal(countries.some((country) => country.key === "SGP"), false, "Singapore absent");

console.info(`country geometry check passed: ${countries.length} countries`);
