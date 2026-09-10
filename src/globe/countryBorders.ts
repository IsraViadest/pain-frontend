/*
 * File attribution
 * edited by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/**
 * SHELL: coastlines + country borders (fat LineSegments2 in a THREE.Group).
 * Loaded by GlobeView.loadCountryOutlines() → loadGlobeBorderOutlines().
 * Scar mode: CPU-warped positions via scarDisplacement.ts (same field as stipple dents).
 */
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { VisualTheme } from "./layerTextures";
import { latLngToVector3 } from "./latLng";
import {
  applyScarToSpherePositions,
  SCAR_OVERLAY_SURFACE_BIAS,
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

/**
 * Fraction of fat-line world linewidth added to {@link SCAR_OVERLAY_SURFACE_BIAS}
 * when CPU-warping border strokes onto the scar field. ~0.5–0.6 keeps coast/inner lines
 * on the deformed shell and reduces z-fighting with stipple; shared by coast and inner.
 */
export const LINE_BIAS_FRACTION = 0.55;

export function appendOpenLineString(
  coords: number[][],
  radius: number,
  out: number[],
  maxDegrees: number,
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
    let a = latLngToVector3(lat0, lng0, radius);
    const end = latLngToVector3(lat1, lng1, radius);
    const degrees = THREE.MathUtils.radToDeg(a.angleTo(end));
    const count = Math.max(1, Math.ceil(degrees / maxDegrees));
    const longitudeSpan = ((lng1 - lng0 + 540) % 360) - 180;
    for (let step = 1; step <= count; step++) {
      const t = step / count;
      // Keep the source's unwrapped map segment; only add samples before scar displacement.
      const b = step === count ? end : latLngToVector3(
        lat0 + (lat1 - lat0) * t, lng0 + longitudeSpan * t, radius,
      );
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
      a = b;
    }
  }
}

function collectOpenLineSegments(
  fc: FeatureCollection,
  radius: number,
  maxDegrees = Infinity,
): Float32Array {
  const tmp: number[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "LineString") {
      appendOpenLineString((g as LineStringGeom).coordinates, radius, tmp, maxDegrees);
    } else if (g.type === "MultiLineString") {
      for (const line of (g as MultiLineStringGeom).coordinates) {
        appendOpenLineString(line, radius, tmp, maxDegrees);
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
  line.renderOrder = 4;
  return line;
}

export interface GlobeBorderOutlines {
  readonly group: THREE.Group;
  additionalStorageBytes(): number;
  setMaxSegmentDegrees(degrees: number): void;
  setDisplayPaths(paths: { coastLines: number[][][]; borderLines: number[][][] } | null): void;
  setCoastVisible(visible: boolean): void;
  setInnerBordersVisible(visible: boolean): void;
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
  let displayCoast = coastFc;
  let displayInner = innerFc;

  const coastPos = collectOpenLineSegments(coastFc, radius);
  const innerPos = collectOpenLineSegments(innerFc, radius);
  const originalSegments = (coastPos.length + innerPos.length) / 6;
  let coastBasePos: Float32Array = coastPos.slice();
  let innerBasePos: Float32Array = innerPos.slice();
  let coastWarpPos = coastPos.slice();
  let innerWarpPos = innerPos.slice();
  let maxSegmentDegrees = Infinity;
  let lastMap: THREE.DataTexture | null = null;
  let lastScale = 0;
  let lastBias = 0;

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

  const outlines: GlobeBorderOutlines = {
    group,
    additionalStorageBytes(): number {
      // Base XYZ endpoints, shared warp/instance buffer, and CPU/GPU distance buffers.
      const segments = (coastBasePos.length + innerBasePos.length) / 6;
      return Math.max(0, segments - originalSegments) * 88;
    },
    setMaxSegmentDegrees(degrees: number): void {
      if (degrees === maxSegmentDegrees) return;
      maxSegmentDegrees = degrees;
      coastBasePos = collectOpenLineSegments(displayCoast, radius, degrees);
      innerBasePos = collectOpenLineSegments(displayInner, radius, degrees);
      coastWarpPos = coastBasePos.slice();
      innerWarpPos = innerBasePos.slice();
      this.setScarDisplacementMap(lastMap, lastScale, lastBias);
    },
    setDisplayPaths(paths): void {
      const collection = (coordinates: number[][][]): FeatureCollection => ({
        features: [{ geometry: { type: "MultiLineString", coordinates } }],
      });
      displayCoast = paths ? collection(paths.coastLines) : coastFc;
      displayInner = paths ? collection(paths.borderLines) : innerFc;
      const degrees = maxSegmentDegrees;
      maxSegmentDegrees = NaN;
      this.setMaxSegmentDegrees(degrees);
    },
    setCoastVisible(visible: boolean): void {
      coastLine.visible = visible;
    },
    setInnerBordersVisible(visible: boolean): void {
      innerLine.visible = visible;
    },
    setResolution(width: number, height: number): void {
      resolution.set(width, height);
      coastMat.resolution.copy(resolution);
      innerMat.resolution.copy(resolution);
      coastMat.needsUpdate = true;
      innerMat.needsUpdate = true;
    },
    setClippingPlanes(planes: THREE.Plane[]): void {
      const enabled = planes.length > 0;
      coastMat.clipping = enabled;
      innerMat.clipping = enabled;
      coastMat.clippingPlanes = planes;
      innerMat.clippingPlanes = planes;
    },
    setScarDisplacementMap(
      map: THREE.DataTexture | null,
      displacementScale: number,
      displacementBias: number,
    ): void {
      const scarActive = Boolean(map);
      lastMap = map;
      lastScale = displacementScale;
      lastBias = displacementBias;
      // Write depth in scar mode so fat lines win over transparent stipple sprites.
      coastMat.depthWrite = true;
      innerMat.depthWrite = true;
      coastMat.polygonOffset = scarActive;
      coastMat.polygonOffsetFactor = scarActive ? -2 : 0;
      coastMat.polygonOffsetUnits = scarActive ? -2 : 0;
      innerMat.polygonOffset = scarActive;
      innerMat.polygonOffsetFactor = scarActive ? -2 : 0;
      innerMat.polygonOffsetUnits = scarActive ? -2 : 0;

      if (!map) {
        coastWarpPos.set(coastBasePos);
        innerWarpPos.set(innerBasePos);
      } else {
        const coastBias =
          SCAR_OVERLAY_SURFACE_BIAS + COAST_LINEWIDTH * LINE_BIAS_FRACTION;
        const innerBias =
          SCAR_OVERLAY_SURFACE_BIAS + INNER_BORDER_LINEWIDTH * LINE_BIAS_FRACTION;
        applyScarToSpherePositions(
          coastBasePos,
          coastWarpPos,
          map,
          displacementScale,
          displacementBias,
          coastBias,
        );
        applyScarToSpherePositions(
          innerBasePos,
          innerWarpPos,
          map,
          displacementScale,
          displacementBias,
          innerBias,
        );
      }

      const coastGeom = coastLine.geometry as LineSegmentsGeometry;
      const innerGeom = innerLine.geometry as LineSegmentsGeometry;
      // Release replaced attributes and Three's cached instance limit before changing density.
      coastGeom.dispose();
      innerGeom.dispose();
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
  return outlines;
}
