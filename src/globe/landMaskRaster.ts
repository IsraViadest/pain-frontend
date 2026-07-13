/**
 * Rasterize Natural Earth country polygons to an equirectangular land mask
 * using the same plate-carrée mapping as borders and globeEquirectUV.
 */

type PolygonCoords = number[][][];
type MultiPolygonCoords = number[][][][];

type PolygonGeom = { type: "Polygon"; coordinates: PolygonCoords };
type MultiPolygonGeom = { type: "MultiPolygon"; coordinates: MultiPolygonCoords };

interface LandMaskFeature {
  geometry?: PolygonGeom | MultiPolygonGeom | { type: string };
}

interface LandMaskFeatureCollection {
  features: LandMaskFeature[];
}

function lngLatToCanvas(
  lng: number,
  lat: number,
  w: number,
  h: number,
): [number, number] {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

function traceRing(
  ctx: CanvasRenderingContext2D,
  ring: number[][],
  w: number,
  h: number,
): void {
  if (ring.length < 2) return;
  const [x0, y0] = lngLatToCanvas(ring[0]![0]!, ring[0]![1]!, w, h);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = lngLatToCanvas(ring[i]![0]!, ring[i]![1]!, w, h);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillPolygonWithHoles(
  ctx: CanvasRenderingContext2D,
  rings: number[][][],
  w: number,
  h: number,
): void {
  const outer = rings[0];
  if (!outer?.length) return;
  ctx.beginPath();
  traceRing(ctx, outer, w, h);
  ctx.fill();
  for (let i = 1; i < rings.length; i++) {
    const hole = rings[i];
    if (!hole?.length) continue;
    ctx.beginPath();
    traceRing(ctx, hole, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

function fillGeometry(
  ctx: CanvasRenderingContext2D,
  geom: PolygonGeom | MultiPolygonGeom,
  w: number,
  h: number,
): void {
  if (geom.type === "Polygon") {
    fillPolygonWithHoles(ctx, geom.coordinates, w, h);
    return;
  }
  for (const polygon of geom.coordinates) {
    fillPolygonWithHoles(ctx, polygon, w, h);
  }
}

/** White = land, black = ocean (equirectangular; default matches DummyPain 1000×482). */
export async function rasterLandMaskFromCountries(
  geojsonUrl: string,
  sampleW = 1024,
  sampleH = 512,
): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const res = await fetch(geojsonUrl);
  if (!res.ok) {
    throw new Error(`Land mask GeoJSON fetch failed: ${res.status}`);
  }
  const fc = (await res.json()) as LandMaskFeatureCollection;

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unsupported");
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sampleW, sampleH);
  ctx.fillStyle = "#fff";

  for (const feature of fc.features) {
    const g = feature.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      fillGeometry(ctx, g as PolygonGeom, sampleW, sampleH);
    } else if (g.type === "MultiPolygon") {
      fillGeometry(ctx, g as MultiPolygonGeom, sampleW, sampleH);
    }
  }

  const { data, width, height } = ctx.getImageData(0, 0, sampleW, sampleH);
  return { data, w: width, h: height };
}
