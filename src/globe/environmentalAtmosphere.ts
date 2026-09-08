import * as THREE from "three";
import { createAtmosphereSurface } from "./atmosphereSurface";
import { createAtmosphereVolume } from "./atmosphereVolume";

export type AtmosphereMode = "control" | "flat" | "mantle" | "cloudlets" | "volume" |
  "volume-strong" | "volume-separated" | "volume-strong-separated" |
  "volume-very-strong-separated" | "volume-near-opaque-separated" | "volume-log-separated" |
  "volume-log-near-opaque-separated";

const MAX_DEPTH_PIXELS = 1_048_576;
const COLORS = { temperature: "#d74846", co2: "#90dcb5" };

/** A private depth pass clips air against the actual surface without hiding ground stipple. */
export function createEnvironmentalAtmosphere(options: {
  mode: Exclude<AtmosphereMode, "control">;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  earthContent: THREE.Group;
  surfaceGeometry: THREE.BufferGeometry;
  smooth?: boolean;
}) {
  const { mode, renderer, camera, earthContent, surfaceGeometry } = options;
  const drawingSize = new THREE.Vector2();
  const inverseEarth = new THREE.Matrix4();
  const surfaceRadius = { value: 0 };
  let surfacePositions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null = null;
  let surfaceVersion = -1;
  let sphericalRadius = 0;
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  depth.minFilter = depth.magFilter = THREE.NearestFilter;
  const depthTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: depth, depthBuffer: true, stencilBuffer: false, samples: 0,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    generateMipmaps: false, colorSpace: THREE.NoColorSpace,
  });
  const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
  const depthMesh = new THREE.Mesh(surfaceGeometry, depthMaterial);
  depthMesh.matrixAutoUpdate = false;
  const depthScene = new THREE.Scene();
  depthScene.add(depthMesh);
  const shared = { renderer, depth, drawingSize, inverseEarth, surfaceRadius,
    colors: COLORS, smooth: options.smooth };
  const volumeMode = mode.startsWith("volume");
  const volume = volumeMode ? createAtmosphereVolume({ ...shared,
    treatment: mode as "volume" | "volume-strong" | "volume-separated" |
      "volume-strong-separated" | "volume-near-opaque-separated" |
      "volume-very-strong-separated" | "volume-log-separated" |
      "volume-log-near-opaque-separated" }) : null;
  const surface = volumeMode ? null : createAtmosphereSurface({ ...shared,
    mode: mode as "flat" | "mantle" | "cloudlets" });
  const object = (volume ?? surface)!.object;
  object.visible = false;
  earthContent.add(object);
  let temperature: THREE.DataTexture | null = null;
  let co2: THREE.DataTexture | null = null;
  let disposed = false;
  const clearColor = new THREE.Color();
  const viewport = new THREE.Vector4();
  const scissor = new THREE.Vector4();

  return {
    setFields(nextTemperature: THREE.DataTexture | null, nextCo2: THREE.DataTexture | null): void {
      temperature = nextTemperature;
      co2 = nextCo2;
      object.visible = Boolean(temperature || co2);
      volume?.setFields(temperature, co2);
      surface?.setFields(temperature, co2);
    },
    /** Called before the main render, with the same camera/earth matrices for all passes. */
    prepare(samples: 16 | 32 | 48, fraction: number): void {
      if (disposed || (!temperature && !co2)) return;
      renderer.getDrawingBufferSize(drawingSize);
      if (drawingSize.x <= 0 || drawingSize.y <= 0) return;
      const positions = surfaceGeometry.getAttribute("position");
      const version = positions instanceof THREE.InterleavedBufferAttribute
        ? positions.data.version : positions.version;
      if (positions !== surfacePositions || version !== surfaceVersion) {
        surfacePositions = positions;
        surfaceVersion = version;
        const radiusSquared = positions.getX(0) ** 2 + positions.getY(0) ** 2 + positions.getZ(0) ** 2;
        sphericalRadius = Math.sqrt(radiusSquared);
        for (let i = 1; i < positions.count; i++) {
          const squared = positions.getX(i) ** 2 + positions.getY(i) ** 2 + positions.getZ(i) ** 2;
          if (Math.abs(squared - radiusSquared) > 0.00001) {
            sphericalRadius = 0;
            break;
          }
        }
      }
      // Only the complete closed sphere can replace its depth raster analytically.
      const range = surfaceGeometry.drawRange;
      surfaceRadius.value = range.start === 0 && range.count >= (surfaceGeometry.index?.count ?? positions.count)
        ? sphericalRadius : 0;
      const ratio = Math.min(options.smooth ? fraction : 0.5, 1,
        Math.sqrt((options.smooth ? 2 * MAX_DEPTH_PIXELS : MAX_DEPTH_PIXELS) / (drawingSize.x * drawingSize.y)),
        renderer.capabilities.maxTextureSize / Math.max(drawingSize.x, drawingSize.y));
      depthTarget.setSize(Math.max(1, Math.floor(drawingSize.x * ratio)),
        Math.max(1, Math.floor(drawingSize.y * ratio)));
      earthContent.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      inverseEarth.copy(earthContent.matrixWorld).invert();
      depthMesh.matrix.copy(earthContent.matrixWorld);
      depthMesh.matrixWorldNeedsUpdate = true;
      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      const previousAlpha = renderer.getClearAlpha();
      const previousScissorTest = renderer.getScissorTest();
      renderer.getClearColor(clearColor);
      renderer.getViewport(viewport);
      renderer.getScissor(scissor);
      try {
        renderer.autoClear = false;
        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(depthTarget);
        renderer.clear(true, true, false);
        renderer.render(depthScene, camera);
        volume?.render(camera, samples, fraction);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(previousScissorTest);
        renderer.setClearColor(clearColor, previousAlpha);
        renderer.autoClear = previousAutoClear;
      }
    },
    stats() {
      const detail = (volume ?? surface)!.stats();
      return { mode, ...detail, additionalBytes: detail.additionalBytes +
        depthTarget.width * depthTarget.height * 8 + 4096,
      depthWidth: depthTarget.width, depthHeight: depthTarget.height };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      earthContent.remove(object);
      volume?.dispose();
      surface?.dispose();
      depthTarget.dispose();
      depthMaterial.dispose();
      // The caller owns the surface geometry and the two data fields.
    },
  };
}
