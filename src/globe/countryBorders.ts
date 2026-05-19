import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { VisualTheme } from "./layerTextures";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import { latLngToVector3 } from "./latLng";
import {
  sampleScarHeight01,
  scarRadialOffset,
} from "./scarDisplacement";
import { DEBUG_SCAR_VISUAL, isDebugScarVisual } from "./debugScarVisual";

type LineStringGeom = { type: "LineString"; coordinates: number[][] };
type MultiLineStringGeom = { type: "MultiLineString"; coordinates: number[][][] };

interface Feature {
  geometry?: LineStringGeom | MultiLineStringGeom | { type: string };
}

interface FeatureCollection {
  features: Feature[];
}

/** World-space half-width of fat lines on the unit-ish globe (LineMaterial + worldUnits). */
const COAST_LINEWIDTH = 0.0036;
const INNER_BORDER_LINEWIDTH = 0.00085;

function appendOpenLineString(
  coords: number[][],
  radius: number,
  out: number[],
): void {
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i]!;
    const p1 = coords[i + 1]!;
    const [lng0, lat0] = p0;
    const [lng1, lat1] = p1;
    if (
      !Number.isFinite(lat0) ||
      !Number.isFinite(lng0) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng1)
    ) {
      continue;
    }
    const a = latLngToVector3(lat0, lng0, radius);
    const b = latLngToVector3(lat1, lng1, radius);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}

function collectOpenLineSegments(
  fc: FeatureCollection,
  radius: number,
): Float32Array {
  const tmp: number[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "LineString") {
      appendOpenLineString((g as LineStringGeom).coordinates, radius, tmp);
    } else if (g.type === "MultiLineString") {
      for (const line of (g as MultiLineStringGeom).coordinates) {
        appendOpenLineString(line, radius, tmp);
      }
    }
  }
  return new Float32Array(tmp);
}

function makeFatLine(
  positions: Float32Array,
  linewidth: number,
  resolution: THREE.Vector2,
  color: THREE.Color,
): LineSegments2 {
  const geom = new LineSegmentsGeometry();
  geom.setPositions(positions);
  const mat = new LineMaterial({
    color,
    linewidth,
    worldUnits: true,
    resolution,
    opacity: 1,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    clipping: true,
  });
  const line = new LineSegments2(geom, mat);
  line.computeLineDistances();
  line.renderOrder = 1;
  return line;
}

export interface GlobeBorderOutlines {
  readonly group: THREE.Group;
  setResolution(width: number, height: number): void;
  /** Clip to camera-facing hemisphere (same plane object can be updated per frame). */
  setClippingPlanes(planes: THREE.Plane[]): void;
  /** Warp coastline/border strokes using the same scar displacement field as the globe. */
  setScarDisplacementMap(
    map: THREE.DataTexture | null,
    displacementScale: number,
    displacementBias: number,
  ): void;
  syncAppearance(theme: VisualTheme): void;
  dispose(): void;
}

function applyScarToLinePositions(
  base: Float32Array,
  out: Float32Array,
  map: THREE.DataTexture,
  displacementScale: number,
  displacementBias: number,
): void {
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i]!;
    const y = base[i + 1]!;
    const z = base[i + 2]!;
    const dir = new THREE.Vector3(x, y, z).normalize();
    const baseRadius = Math.sqrt(x * x + y * y + z * z);
    const { u, v } = unitDirectionToGlobeEquirectUV(dir);
    const h = sampleScarHeight01(map, u, v);
    const radial = scarRadialOffset(h, displacementScale, displacementBias);
    const s = Math.max(0.0001, baseRadius + radial);
    out[i] = dir.x * s;
    out[i + 1] = dir.y * s;
    out[i + 2] = dir.z * s;
  }
}

/**
 * Coastlines (Natural Earth `ne_110m_coastline`) as thicker fat lines;
 * land boundaries between countries (`ne_110m_admin_0_boundary_lines_land`) as thinner fat lines.
 * Uses `LineSegments2` because WebGL ignores `LineBasicMaterial.linewidth`.
 */
export async function loadGlobeBorderOutlines(
  bordersBaseUrl: string,
  radius: number,
  resolution: THREE.Vector2,
): Promise<GlobeBorderOutlines> {
  const coastUrl = `${bordersBaseUrl}ne_110m_coastline.geojson`;
  const innerUrl = `${bordersBaseUrl}ne_110m_admin_0_boundary_lines_land.geojson`;

  const [coastRes, innerRes] = await Promise.all([fetch(coastUrl), fetch(innerUrl)]);
  if (!coastRes.ok) {
    throw new Error(`Coastline fetch failed: ${coastRes.status}`);
  }
  if (!innerRes.ok) {
    throw new Error(`Boundary fetch failed: ${innerRes.status}`);
  }

  const coastFc = (await coastRes.json()) as FeatureCollection;
  const innerFc = (await innerRes.json()) as FeatureCollection;

  const coastPos = collectOpenLineSegments(coastFc, radius);
  const innerPos = collectOpenLineSegments(innerFc, radius);
  const coastBasePos = coastPos.slice();
  const innerBasePos = innerPos.slice();
  const coastWarpPos = coastPos.slice();
  const innerWarpPos = innerPos.slice();

  const coastColor = new THREE.Color(0x6a7588);
  const innerColor = new THREE.Color(0x5a6270);

  const coastLine = makeFatLine(coastPos, COAST_LINEWIDTH, resolution, coastColor);
  const innerLine = makeFatLine(
    innerPos,
    INNER_BORDER_LINEWIDTH,
    resolution,
    innerColor,
  );

  const group = new THREE.Group();
  group.add(coastLine);
  group.add(innerLine);

  const coastMat = coastLine.material as LineMaterial;
  const innerMat = innerLine.material as LineMaterial;

  return {
    group,
    setResolution(width: number, height: number): void {
      resolution.set(width, height);
      coastMat.resolution.copy(resolution);
      innerMat.resolution.copy(resolution);
      coastMat.needsUpdate = true;
      innerMat.needsUpdate = true;
    },
    setClippingPlanes(planes: THREE.Plane[]): void {
      coastMat.clippingPlanes = planes;
      innerMat.clippingPlanes = planes;
    },
    setScarDisplacementMap(
      map: THREE.DataTexture | null,
      displacementScale: number,
      displacementBias: number,
    ): void {
      if (!map) {
        coastWarpPos.set(coastBasePos);
        innerWarpPos.set(innerBasePos);
      } else {
        applyScarToLinePositions(
          coastBasePos,
          coastWarpPos,
          map,
          displacementScale,
          displacementBias,
        );
        applyScarToLinePositions(
          innerBasePos,
          innerWarpPos,
          map,
          displacementScale,
          displacementBias,
        );
      }

      const coastGeom = coastLine.geometry as LineSegmentsGeometry;
      const innerGeom = innerLine.geometry as LineSegmentsGeometry;
      coastGeom.setPositions(coastWarpPos);
      innerGeom.setPositions(innerWarpPos);
      coastLine.computeLineDistances();
      innerLine.computeLineDistances();
    },
    syncAppearance(theme: VisualTheme): void {
      if (isDebugScarVisual()) {
        coastMat.color.setHex(DEBUG_SCAR_VISUAL.coastOutlineHex);
        innerMat.color.setHex(DEBUG_SCAR_VISUAL.innerBorderHex);
        coastMat.linewidth = DEBUG_SCAR_VISUAL.coastLineWidth;
        innerMat.linewidth = DEBUG_SCAR_VISUAL.innerBorderLineWidth;
      } else if (theme === "blue") {
        coastMat.color.setHex(0x8ab8dd);
        innerMat.color.setHex(0x6a92b0);
        coastMat.linewidth = COAST_LINEWIDTH;
        innerMat.linewidth = INNER_BORDER_LINEWIDTH;
      } else {
        coastMat.color.setHex(0x6a7588);
        innerMat.color.setHex(0x5a6270);
        coastMat.linewidth = COAST_LINEWIDTH;
        innerMat.linewidth = INNER_BORDER_LINEWIDTH;
      }
      coastMat.opacity = 1;
      innerMat.opacity = 1;
      coastMat.transparent = false;
      innerMat.transparent = false;
      coastMat.needsUpdate = true;
      innerMat.needsUpdate = true;
    },
    dispose(): void {
      coastLine.geometry.dispose();
      innerLine.geometry.dispose();
      coastMat.dispose();
      innerMat.dispose();
    },
  };
}
