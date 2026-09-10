/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  buildCountryGeometries,
  findCountryInGeometries,
} from "../src/globe/countryGeometry";
import { latLngToVector3, vector3ToLatLng } from "../src/globe/latLng";

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function close(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
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
equal(findCountryInGeometries(countries, -80, 150), "ATA", "Antarctica east");
equal(findCountryInGeometries(countries, -80, -150), null, "Antarctica Ross Sea");
equal(countries.some((country) => country.key === "SGP"), false, "Singapore absent");

const earth = new THREE.Group();
const globe = new THREE.Object3D();
earth.add(globe);
earth.rotation.y = 1.2;
earth.updateMatrixWorld(true);
const source = { lat: 51.5072, lng: -0.1276 };
const worldPoint = globe.localToWorld(latLngToVector3(source.lat, source.lng, 1));
const recovered = vector3ToLatLng(globe.worldToLocal(worldPoint));
close(recovered.lat, source.lat, "rotated surface latitude");
close(recovered.lng, source.lng, "rotated surface longitude");

console.info(`country geometry check passed: ${countries.length} countries`);
