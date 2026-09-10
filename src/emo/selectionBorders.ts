/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { GlobeView } from "../globe/GlobeView";
import { appendOpenLineString, LINE_BIAS_FRACTION } from "../globe/countryBorders";
import { SCAR_OVERLAY_SURFACE_BIAS } from "../globe/scarDisplacement";
import type { IndexedCountryGeometry } from "../globe/countryGeometry";

const MAX_SEGMENTS = 65_536;
export const COUNTRY_SELECTION_STORAGE_RESERVE_BYTES = MAX_SEGMENTS * 6 * 4 * 5 + 2048;
const TEXEL_RADIANS = 2 * Math.PI / 2048;
type Marker = { lat: number; lng: number; strength: number };

/** Two bounded batches carry origin and peer strokes; shared edges keep the stronger owner. */
export function createCountrySelectionBorders(globe: GlobeView) {
  const group = new THREE.Group();
  group.name = "emo-country-selection-borders";
  globe.earthContent.add(group);
  const front = new THREE.Plane();
  const resolution = new THREE.Vector2();
  const batches = [0, 1].map((index) => {
    const material = new LineMaterial({ worldUnits: true, transparent: true,
      depthWrite: false, depthTest: true, toneMapped: false, clipping: true,
      clippingPlanes: [front], polygonOffset: true, polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      // Bit 1 deduplicates caps; bit 2 protects dots. Paint only where neither is set,
      // then mark bit 1 without changing dot coverage or any other stencil bits.
      stencilWrite: true, stencilWriteMask: 1, stencilFuncMask: 3,
      stencilRef: 0, stencilFunc: THREE.EqualStencilFunc,
      stencilZPass: THREE.InvertStencilOp });
    const mesh = new LineSegments2(new LineSegmentsGeometry(), material);
    mesh.renderOrder = 2.1 + index * 0.001;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material, base: new Float32Array(), warped: new Float32Array() };
  });
  let lastPositions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null = null;
  let lastVersion = -1;

  function update(): void {
    front.normal.copy(globe.camera.position).normalize();
    globe.renderer.getSize(resolution);
    for (const batch of batches) batch.material.resolution.copy(resolution);
    const positions = globe.getCountrySurfaceGeometry().getAttribute("position");
    const version = positions instanceof THREE.InterleavedBufferAttribute
      ? positions.data.version : positions.version;
    if (positions === lastPositions && version === lastVersion) return;
    lastPositions = positions;
    lastVersion = version;
    for (const batch of batches) {
      if (!batch.mesh.visible) continue;
      globe.projectCountryOutlinePositions(batch.base, batch.warped);
      // Like ordinary coastlines, lift the stroke center by its half-width so the surface
      // cannot clip the stroke into alternating exposed caps at close zoom.
      const lift = SCAR_OVERLAY_SURFACE_BIAS + batch.material.linewidth * LINE_BIAS_FRACTION;
      for (let i = 0; i < batch.warped.length; i += 3) {
        const scale = 1 + lift / Math.hypot(batch.warped[i], batch.warped[i + 1], batch.warped[i + 2]);
        batch.warped[i] *= scale; batch.warped[i + 1] *= scale; batch.warped[i + 2] *= scale;
      }
      (batch.mesh.geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute)
        .data.needsUpdate = true;
      batch.mesh.geometry.computeBoundingBox();
      batch.mesh.geometry.computeBoundingSphere();
    }
  }

  return {
    update,
    paint(countries: readonly IndexedCountryGeometry[], strengths: ReadonlyMap<string, number>,
      markers: readonly Marker[], markerRadius: number, color: string, width: number,
      glow: boolean): void {
      const edges = new Map<string, { a: number[]; b: number[]; strength: number }>();
      const pointKey = (p: number[]) => `${((p[0] + 180) % 360 + 360) % 360},${p[1]}`;
      function addRing(ring: number[][], strength: number): void {
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1], b = ring[i], ka = pointKey(a), kb = pointKey(b);
          if (ka === kb) continue;
          const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          if ((edges.get(key)?.strength ?? 0) < strength) edges.set(key, { a, b, strength });
        }
      }
      if (width > 0) {
        for (const country of countries) {
          const strength = strengths.get(country.key) ?? 0;
          if (strength <= 0) continue;
          const polygons = country.geometry.type === "Polygon"
            ? [country.geometry.coordinates] : country.geometry.coordinates;
          for (const polygon of polygons) for (const ring of polygon) addRing(ring, strength);
        }
        if (markerRadius > 0) for (const marker of markers) {
          const ring = Array.from({ length: 49 }, (_, i) => {
            const angle = i / 48 * 2 * Math.PI;
            return [marker.lng + Math.cos(angle) * markerRadius /
              Math.max(0.15, Math.cos(marker.lat * Math.PI / 180)),
            Math.max(-90, Math.min(90, marker.lat + Math.sin(angle) * markerRadius))];
          });
          ring[48] = ring[0];
          addRing(ring, marker.strength);
        }
      }
      const byStrength = new Map<number, number[]>();
      let segmentCount = 0;
      for (const edge of edges.values()) {
        let points = byStrength.get(edge.strength);
        if (!points) byStrength.set(edge.strength, points = []);
        const previousLength = points.length;
        appendOpenLineString([edge.a, edge.b], 1, points, 0.25);
        segmentCount += (points.length - previousLength) / 6;
        if (segmentCount > MAX_SEGMENTS) throw new Error("Selected country border exceeds segment cap");
      }
      if (byStrength.size > batches.length) throw new Error("Selection requires more than two border weights");
      const groups = [...byStrength.entries()].sort(([a], [b]) => b - a);
      let storageBytes = 0;
      batches.forEach((batch, i) => {
        const [strength, points] = groups[i] ?? [0, []];
        batch.mesh.geometry.dispose();
        batch.base = new Float32Array(points);
        batch.warped = new Float32Array(batch.base.length);
        batch.mesh.geometry.setPositions(batch.warped);
        batch.material.color.set(color);
        batch.material.linewidth = width * TEXEL_RADIANS;
        batch.material.opacity = strength;
        batch.material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
        batch.mesh.visible = points.length > 0;
        // Base XYZ, shared CPU/GPU instance XYZ, numeric build scratch, and fixed line quad.
        storageBytes += batch.base.byteLength * 5 + 1024;
      });
      globe.setSelectionBorderStorageBytes(storageBytes);
      // Project the new shared instance buffers once through the surface-version path.
      lastPositions = null;
      update();
    },
    destroy(): void {
      for (const batch of batches) {
        batch.mesh.geometry.dispose();
        batch.material.dispose();
      }
      globe.earthContent.remove(group);
      globe.setSelectionBorderStorageBytes(0);
    },
  };
}
