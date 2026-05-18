import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PainPoint } from "../types/api";
import {
  loadGlobeBorderOutlines,
  type GlobeBorderOutlines,
} from "./countryBorders";
import {
  createEarthStippleGlobe,
  STIPPLE_LAND_TEXTURE_URL,
} from "./earthStippleGlobe";
import {
  createLayerCanvasTexture,
  getLayerBaseColorLinear,
  type VisualTheme,
} from "./layerTextures";
import { latLngToVector3 } from "./latLng";
import { createPainScarDisplacementTexture } from "./painScarField";

/** Same scale/bias on textured globe and stipple (world units along surface normal). */
const SCAR_DISPLACEMENT_SCALE = 0.13;
const SCAR_DISPLACEMENT_BIAS = -SCAR_DISPLACEMENT_SCALE * 0.5;
/** Slightly stronger on strokes to make distortion easier to verify visually. */
const BORDER_SCAR_MULTIPLIER = 1.2;

/** Runtime Three.js supports clipping on materials; some @types/three versions omit it. */
type MaterialWithClipping = THREE.Material & {
  clipping: boolean;
  clipIntersection: boolean;
  clippingPlanes: THREE.Plane[] | null;
};

const RADIUS = 1;
/** Earth rotates eastward once per sidereal day (~23h56m); slowed for calm ambient motion. */
const GLOBE_AUTO_SPIN_RAD_PER_SEC = (Math.PI * 2) / (23 * 3600 + 56 * 60 + 4) * 160;
const GLOW_RADIUS = RADIUS * 1.09;
const GLOW_VS = /* glsl */ `
varying float vGlow;
void main() {
  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 viewDir = normalize(cameraPosition - worldPos);
  float ndv = abs(dot(worldNormal, viewDir));
  float fresnel = pow(1.0 - ndv, 5.0);
  vGlow = smoothstep(0.18, 1.0, fresnel);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const GLOW_FS = /* glsl */ `
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
varying float vGlow;
void main() {
  float alpha = vGlow * uGlowIntensity;
  gl_FragColor = vec4(uGlowColor, alpha);
}
`;
const BACK_GLOW_DISTANCE = RADIUS * 1.45;
const BACK_GLOW_SIZE = RADIUS * 3.8;
const BACK_GLOW_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const BACK_GLOW_FS = /* glsl */ `
uniform vec3 uBackGlowColor;
uniform float uBackGlowIntensity;
uniform float uInnerRadius;
uniform float uMidRadius;
uniform float uOuterRadius;
varying vec2 vUv;
void main() {
  vec2 p = vUv - vec2(0.5);
  float r = length(p) * 2.0;
  float rise = smoothstep(uInnerRadius, uMidRadius, r);
  float fall = 1.0 - smoothstep(uMidRadius, uOuterRadius, r);
  float ring = rise * fall;
  float alpha = max(0.0, ring) * uBackGlowIntensity;
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(uBackGlowColor, alpha);
}
`;
type MultiplexLink = {
  aIndex: number;
  bIndex: number;
  progress: number;
};

type MultiplexRuntime = {
  nodeDirs: THREE.Vector3[];
  nodeTargets: number[];
  nodeProgress: number[];
  nodeMeshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  clusterDirs: THREE.Vector3[];
  clusterTargets: number[];
  clusterProgress: number[];
  clusterPositionAttr: THREE.BufferAttribute;
  links: MultiplexLink[];
  linkPositionAttr: THREE.BufferAttribute | null;
};
type WordCloudItem = {
  dir: THREE.Vector3;
  sprite: THREE.Sprite;
  radius: number;
  baseScaleX: number;
  baseScaleY: number;
};
export type WordCloudHoverInfo = {
  country: string;
  shortLabel: string;
  fullText: string;
  intensity: number;
};
type MultiplexNodeHover = {
  kind: "node";
  type: string;
  intensity: number;
  text?: string;
  metadata?: PainPoint["metadata"];
  lat: number;
  lng: number;
};
type MultiplexClusterHover = {
  kind: "cluster";
  count: number;
  avgIntensity: number;
  lat: number;
  lng: number;
};
export type MultiplexHoverInfo = MultiplexNodeHover | MultiplexClusterHover;
export type GlobeDisplayMode = "texture" | "points";
/** How pain submissions are drawn: floating markers vs. inward dents on the sphere. */
export type PainVisualizationMode = "points" | "scars" | "multiplex-v0";
/** Slightly above the globe so outlines sit on top of the data texture without z-fighting. */
const BORDER_RADIUS = RADIUS * 1.0009;
const BORDERS_BASE = `${import.meta.env.BASE_URL}borders/`;

export class GlobeView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly earthContent = new THREE.Group();
  private readonly globe: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  >;
  private readonly glow: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly backGlow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly markersGroup = new THREE.Group();
  private readonly multiplexGroup = new THREE.Group();
  private readonly markerGeometry: THREE.SphereGeometry;
  private readonly emotionalWordsGroup = new THREE.Group();
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private bordersOutlines: GlobeBorderOutlines | null = null;
  private pointsStipple: THREE.Points | null = null;
  private pointsMaterial: THREE.ShaderMaterial | null = null;
  private stippleCleanup: (() => void) | null = null;
  private stipplePromise: Promise<void> | null = null;
  private displayMode: GlobeDisplayMode = "texture";
  private painVizMode: PainVisualizationMode = "points";
  private lastPainPoints: PainPoint[] = [];
  private scarDisplacementMap: THREE.DataTexture | null = null;
  private stippleNeutralScarTexture: THREE.DataTexture | null = null;
  private readonly ambLight: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly fillLight: THREE.DirectionalLight;
  private visualTheme: VisualTheme = "dark";
  private currentLayerId = "environmental";
  /** Keeps coast / borders / stipple / markers on the camera-facing hemisphere only. */
  private readonly hemisphereClipPlane = new THREE.Plane();
  private readonly clipPlanesFront: THREE.Plane[] = [this.hemisphereClipPlane];
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private globeSpinY = 0;
  private multiplexTime = 0;
  private multiplexRuntime: MultiplexRuntime | null = null;
  private wordCloudEnabled = false;
  private wordCloudItems: WordCloudItem[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
    this.camera.position.set(0, 0.35, 2.6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.65;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 5;

    this.ambLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambLight);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    this.keyLight.position.set(4, 2, 3);
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.DirectionalLight(0xb8c4ff, 0.35);
    this.fillLight.position.set(-3, -1, -2);
    this.scene.add(this.fillLight);

    const geo = new THREE.SphereGeometry(RADIUS, 128, 96);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.06,
    });
    this.globe = new THREE.Mesh(geo, mat);
    this.globe.renderOrder = 0;
    this.earthContent.add(this.globe);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOW_RADIUS, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          uGlowColor: { value: new THREE.Color(0x7da8ff) },
          uGlowIntensity: { value: 0.15 },
        },
        vertexShader: GLOW_VS,
        fragmentShader: GLOW_FS,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glow.renderOrder = -1;
    this.earthContent.add(this.glow);
    this.backGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(BACK_GLOW_SIZE, BACK_GLOW_SIZE, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uBackGlowColor: { value: new THREE.Color(0xffffff) },
          uBackGlowIntensity: { value: 0.08 },
          uInnerRadius: { value: 0.55 },
          uMidRadius: { value: 0.62 },
          uOuterRadius: { value: 0.9 },
        },
        vertexShader: BACK_GLOW_VS,
        fragmentShader: BACK_GLOW_FS,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.backGlow.renderOrder = -2;
    this.scene.add(this.backGlow);
    this.scene.add(this.earthContent);
    this.markersGroup.renderOrder = 2;
    this.scene.add(this.markersGroup);
    this.multiplexGroup.renderOrder = 3;
    this.scene.add(this.multiplexGroup);
    this.emotionalWordsGroup.renderOrder = 4;
    this.scene.add(this.emotionalWordsGroup);
    this.markerGeometry = new THREE.SphereGeometry(0.018, 16, 16);

    this.setLayerTexture("environmental");
    void this.loadCountryOutlines();
    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  /** Swap between procedural canvas texture and stippled point globe (test). */
  setGlobeDisplayMode(mode: GlobeDisplayMode): void {
    this.displayMode = mode;
    this.syncBaseGlobeVisibility();
    void this.ensureStipple().then(() => {
      if (this.pointsStipple) {
        this.pointsStipple.visible = mode === "points";
      }
    });
    this.setLayerTexture(this.currentLayerId);
  }

  /** Markers on the surface vs. displacement “scars” (dents) from the same dataset. */
  setPainVisualizationMode(mode: PainVisualizationMode): void {
    if (this.painVizMode === mode) return;
    this.painVizMode = mode;
    this.syncBaseGlobeVisibility();
    this.rebuildPainGeometryAndTexture();
  }

  /**
   * Keep base mesh visible in scars mode so dents remain readable,
   * even when stipple display mode is active.
   */
  private syncBaseGlobeVisibility(): void {
    this.globe.visible = this.displayMode === "texture" || this.painVizMode === "scars";
  }

  private ensureStipple(): Promise<void> {
    if (this.pointsStipple) return Promise.resolve();
    if (!this.stipplePromise) {
      const tint = new THREE.Vector3().fromArray(
        getLayerBaseColorLinear(this.currentLayerId, this.visualTheme),
      );
      this.stipplePromise = createEarthStippleGlobe(
        RADIUS,
        36_000,
        STIPPLE_LAND_TEXTURE_URL,
        tint,
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(0.82, 0.9, 1.0),
        0.16,
        this.renderer.getPixelRatio(),
      )
        .then(({ points, material, dispose, neutralScarTexture }) => {
          this.pointsStipple = points;
          this.pointsMaterial = material;
          this.stippleCleanup = dispose;
          this.stippleNeutralScarTexture = neutralScarTexture;
          this.pointsStipple.visible = this.displayMode === "points";
          this.earthContent.add(this.pointsStipple);
          const mClip = material as unknown as MaterialWithClipping;
          mClip.clipping = true;
          mClip.clipIntersection = false;
          mClip.clippingPlanes = this.clipPlanesFront;
          this.applyPointsTint();
          this.applyStippleScarUniforms();
          this.syncWorldRotation();
        })
        .catch((e) => {
          console.warn("[GlobeView] point stipple globe failed:", e);
        })
        .finally(() => {
          this.stipplePromise = null;
        });
    }
    return this.stipplePromise ?? Promise.resolve();
  }

  private applyPointsTint(): void {
    if (!this.pointsMaterial) return;
    const rgb = getLayerBaseColorLinear(this.currentLayerId, this.visualTheme);
    const u = this.pointsMaterial.uniforms;
    u.uTint.value.set(rgb[0], rgb[1], rgb[2]);
    if (this.visualTheme === "blue") {
      u.uShadeBase.value.set(
        209 / 255,
        247 / 255,
        255 / 255,
      );
      u.uLandTint.value.set(209 / 255, 247 / 255, 255 / 255);
      u.uLandTintStrength.value = 0.3;
    } else {
      u.uShadeBase.value.set(1, 1, 1);
      u.uLandTint.value.set(0.86, 0.9, 0.96);
      u.uLandTintStrength.value = 0.22;
    }
  }

  private applyStippleScarUniforms(): void {
    if (!this.pointsMaterial) return;
    const u = this.pointsMaterial.uniforms;
    const scars = this.painVizMode === "scars" || this.painVizMode === "multiplex-v0";
    u.uScarDispScale.value = scars ? SCAR_DISPLACEMENT_SCALE : 0;
    u.uScarDispBias.value = scars ? SCAR_DISPLACEMENT_BIAS : 0;
    u.uScarActive.value = scars ? 1 : 0;
    if (scars && this.scarDisplacementMap) {
      u.uScarMap.value = this.scarDisplacementMap;
    } else if (this.stippleNeutralScarTexture) {
      u.uScarMap.value = this.stippleNeutralScarTexture;
    }
  }

  private async loadCountryOutlines(): Promise<void> {
    try {
      const w = this.renderer.domElement.clientWidth || window.innerWidth;
      const h = this.renderer.domElement.clientHeight || window.innerHeight;
      const resolution = new THREE.Vector2(w, h);
      this.bordersOutlines = await loadGlobeBorderOutlines(
        BORDERS_BASE,
        BORDER_RADIUS,
        resolution,
      );
      this.bordersOutlines.syncAppearance(this.visualTheme);
      this.bordersOutlines.setClippingPlanes(this.clipPlanesFront);
      this.bordersOutlines.setScarDisplacementMap(
        this.painVizMode === "scars" ? this.scarDisplacementMap : null,
        SCAR_DISPLACEMENT_SCALE * BORDER_SCAR_MULTIPLIER,
        SCAR_DISPLACEMENT_BIAS * BORDER_SCAR_MULTIPLIER,
      );
      this.scene.remove(this.markersGroup);
      this.scene.add(this.bordersOutlines.group);
      this.scene.add(this.markersGroup);
      this.syncWorldRotation();
    } catch (e) {
      console.warn("[GlobeView] country outlines failed to load:", e);
    }
  }

  private syncBorderAppearance(): void {
    this.bordersOutlines?.syncAppearance(this.visualTheme);
  }

  /** Match WebGL backdrop and lighting to the document UI theme. */
  setVisualTheme(theme: VisualTheme): void {
    this.applyScenePalette(theme);
    if (this.visualTheme === theme) {
      return;
    }
    this.visualTheme = theme;
    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();
    this.setLayerTexture(this.currentLayerId);
  }

  private applyScenePalette(theme: VisualTheme): void {
    if (theme === "blue") {
      this.scene.background = null;
      this.renderer.toneMappingExposure = 1.12;
      this.ambLight.color.setHex(0xd1f7ff);
      this.ambLight.intensity = 0.44;
      this.keyLight.color.setHex(0xd1f7ff);
      this.keyLight.intensity = 1.12;
      this.fillLight.color.setHex(0x3b69cc);
      this.fillLight.intensity = 0.42;
      this.globe.material.color.setHex(0xd1f7ff);
      this.glow.material.uniforms.uGlowColor.value.setHex(0x05e2c2);
      this.glow.material.uniforms.uGlowIntensity.value = 0.2;
      this.backGlow.material.uniforms.uBackGlowColor.value.setHex(0xffffff);
      this.backGlow.material.uniforms.uBackGlowIntensity.value = 0.08;
    } else {
      this.scene.background = null;
      this.renderer.toneMappingExposure = 1.05;
      this.ambLight.color.setHex(0xffffff);
      this.ambLight.intensity = 0.35;
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 1.25;
      this.fillLight.color.setHex(0xb8c4ff);
      this.fillLight.intensity = 0.35;
      this.globe.material.color.setHex(0xffffff);
      this.glow.material.uniforms.uGlowColor.value.setHex(0x7da8ff);
      this.glow.material.uniforms.uGlowIntensity.value = 0.18;
      this.backGlow.material.uniforms.uBackGlowColor.value.setHex(0xffffff);
      this.backGlow.material.uniforms.uBackGlowIntensity.value = 0.06;
    }
    this.syncBorderAppearance();
    this.applyMultiplexTheme();
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.painVizMode = "points";
    this.lastPainPoints = [];
    this.rebuildPainGeometryAndTexture();
    if (this.pointsStipple) {
      this.earthContent.remove(this.pointsStipple);
      this.pointsStipple = null;
      this.pointsMaterial = null;
    }
    if (this.stippleCleanup) {
      this.stippleCleanup();
      this.stippleCleanup = null;
      this.stippleNeutralScarTexture = null;
    }
    if (this.bordersOutlines) {
      this.scene.remove(this.bordersOutlines.group);
      this.bordersOutlines.dispose();
      this.bordersOutlines = null;
    }
    this.controls.dispose();
    this.renderer.dispose();
    this.globe.geometry.dispose();
    this.globe.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.backGlow.geometry.dispose();
    this.backGlow.material.dispose();
    this.markerGeometry.dispose();
    this.clearWordCloud();
    this.disposeMultiplexObjects();
    for (const t of this.textureCache.values()) t.dispose();
    this.textureCache.clear();
  }

  setLayerTexture(layerId: string): void {
    this.currentLayerId = layerId;
    const cacheKey = `${layerId}:${this.visualTheme}`;
    let tex = this.textureCache.get(cacheKey);
    if (!tex) {
      tex = createLayerCanvasTexture(layerId, this.visualTheme);
      this.textureCache.set(cacheKey, tex);
    }
    const m = this.globe.material;
    m.map = tex;
    m.needsUpdate = true;
    this.applyPointsTint();
    this.refreshWordCloud();
  }

  setMarkers(points: PainPoint[]): void {
    this.lastPainPoints = points;
    this.rebuildPainGeometryAndTexture();
    this.refreshWordCloud();
  }

  setWordCloudEnabled(enabled: boolean): void {
    this.wordCloudEnabled = enabled;
    this.refreshWordCloud();
  }

  private rebuildPainGeometryAndTexture(): void {
    if (
      this.painVizMode === "scars" ||
      this.painVizMode === "multiplex-v0"
    ) {
      void this.ensureStipple();
    }
    while (this.markersGroup.children.length) {
      const ch = this.markersGroup.children[0]!;
      this.markersGroup.remove(ch);
      if (ch instanceof THREE.Mesh) {
        if (Array.isArray(ch.material)) {
          for (const m of ch.material) m.dispose();
        } else {
          ch.material.dispose();
        }
      }
    }

    if (this.painVizMode === "points") {
      for (const p of this.lastPainPoints) {
        const pos = latLngToVector3(p.lat, p.lng, RADIUS * 1.002);
        const hue =
          p.type === "environmental"
            ? 0.45
            : p.type === "physical"
              ? 0.92
              : p.type === "emotional"
                ? 0.72
                : p.type === "socioeconomic"
                  ? 0.08
                  : 0.6;
        const col = new THREE.Color().setHSL(hue, 0.65, 0.55);
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.35 + 0.5 * p.intensity,
          roughness: 0.4,
          metalness: 0.2,
        });
        const mClip = mat as unknown as MaterialWithClipping;
        mClip.clipping = true;
        mClip.clipIntersection = false;
        mClip.clippingPlanes = this.clipPlanesFront;
        const mesh = new THREE.Mesh(this.markerGeometry, mat);
        mesh.position.copy(pos);
        mesh.userData.painPoint = p;
        this.markersGroup.add(mesh);
      }
    }

    this.markersGroup.visible = this.painVizMode === "points";
    this.multiplexGroup.visible = this.painVizMode === "multiplex-v0";
    if (this.painVizMode === "multiplex-v0") {
      this.rebuildMultiplexVisualization(this.lastPainPoints);
    } else {
      this.disposeMultiplexObjects();
    }

    if (this.scarDisplacementMap) {
      if (this.pointsMaterial && this.stippleNeutralScarTexture) {
        this.pointsMaterial.uniforms.uScarMap.value =
          this.stippleNeutralScarTexture;
      }
      this.scarDisplacementMap.dispose();
      this.scarDisplacementMap = null;
    }

    const mat = this.globe.material;
    if (this.painVizMode === "scars" || this.painVizMode === "multiplex-v0") {
      this.scarDisplacementMap = createPainScarDisplacementTexture(
        this.lastPainPoints,
      );
      mat.displacementMap = this.scarDisplacementMap;
      mat.displacementScale = SCAR_DISPLACEMENT_SCALE;
      mat.displacementBias = SCAR_DISPLACEMENT_BIAS;
      this.bordersOutlines?.setScarDisplacementMap(
        this.scarDisplacementMap,
        SCAR_DISPLACEMENT_SCALE * BORDER_SCAR_MULTIPLIER,
        SCAR_DISPLACEMENT_BIAS * BORDER_SCAR_MULTIPLIER,
      );
    } else {
      mat.displacementMap = null;
      mat.displacementScale = 0;
      mat.displacementBias = 0;
      mat.emissiveMap = null;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 1;
      this.bordersOutlines?.setScarDisplacementMap(null, 0, 0);
    }
    mat.needsUpdate = true;
    this.applyStippleScarUniforms();
    this.refreshWordCloud();
  }

  tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.globeSpinY -= GLOBE_AUTO_SPIN_RAD_PER_SEC * dt;
    this.syncWorldRotation();
    this.controls.update();
    this.syncBackGlowToCamera();
    this.tickMultiplex(dt);
    this.tickWordCloud();
    const cp = this.camera.position;
    if (cp.lengthSq() > 1e-10) {
      this.hemisphereClipPlane.normal.copy(cp).normalize();
    } else {
      this.hemisphereClipPlane.normal.set(0, 0, 1);
    }
    this.hemisphereClipPlane.constant = 0;
    if (this.pointsMaterial) {
      this.pointsMaterial.uniforms.uPixelRatio.value =
        this.renderer.getPixelRatio();
    }
    this.renderer.render(this.scene, this.camera);
  }

  private syncWorldRotation(): void {
    this.earthContent.rotation.y = this.globeSpinY;
    this.markersGroup.rotation.y = this.globeSpinY;
    this.multiplexGroup.rotation.y = this.globeSpinY;
    this.emotionalWordsGroup.rotation.y = this.globeSpinY;
    if (this.bordersOutlines) {
      this.bordersOutlines.group.rotation.y = this.globeSpinY;
    }
  }

  private disposeMultiplexObjects(): void {
    this.multiplexRuntime = null;
    while (this.multiplexGroup.children.length) {
      const ch = this.multiplexGroup.children[0]!;
      this.multiplexGroup.remove(ch);
      const obj = ch as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) m.dispose();
      } else {
        obj.material?.dispose();
      }
    }
  }

  private refreshWordCloud(): void {
    this.clearWordCloud();
    if (!this.wordCloudEnabled || this.currentLayerId !== "emotional") return;
    const source = this.lastPainPoints.filter((p) => p.type === "emotional");
    if (!source.length) return;
    const sample = source.slice(0, 42);
    for (const p of sample) {
      const label = p.metadata?.country ?? "emotional signal";
      const sprite = this.createWordSprite(label);
      sprite.userData.wordCloudHover = {
        country: p.metadata?.country ?? "Unknown",
        shortLabel: label,
        fullText: p.text ?? label,
        intensity: p.intensity,
      } satisfies WordCloudHoverInfo;
      const dir = latLngToVector3(p.lat, p.lng, 1).normalize();
      const radius = RADIUS * (1.11 + 0.08 * p.intensity);
      sprite.position.copy(dir.clone().multiplyScalar(radius));
      this.emotionalWordsGroup.add(sprite);
      this.wordCloudItems.push({
        dir,
        sprite,
        radius,
        baseScaleX: sprite.scale.x,
        baseScaleY: sprite.scale.y,
      });
    }
  }

  private clearWordCloud(): void {
    for (const item of this.wordCloudItems) {
      const mat = item.sprite.material;
      mat.map?.dispose();
      mat.dispose();
    }
    this.wordCloudItems = [];
    while (this.emotionalWordsGroup.children.length) {
      this.emotionalWordsGroup.remove(this.emotionalWordsGroup.children[0]!);
    }
  }

  private extractCloudWords(text: string): string[] {
    const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];
    const stop = new Set([
      "the",
      "and",
      "with",
      "from",
      "that",
      "this",
      "have",
      "into",
      "your",
      "they",
      "are",
      "for",
      "you",
      "our",
      "their",
      "pero",
      "para",
      "con",
      "una",
      "que",
      "los",
      "las",
      "del",
      "por",
      "der",
      "die",
      "und",
      "conflict",
      "deaths",
      "country",
      "github",
      "7magic7mike7",
      "pain",
      "main",
      "data",
      "peak",
      "rate",
      "death",
      "deaths",
      "ihme",
    ]);
    const freq = new Map<string, { word: string; count: number }>();
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      const k = tok.toLocaleLowerCase();
      if (stop.has(k)) continue;
      const v = freq.get(k);
      if (v) v.count += 1;
      else freq.set(k, { word: tok, count: 1 });
    }
    return [...freq.values()]
      .sort((a, b) => b.count * b.word.length - a.count * a.word.length)
      .map((v) => v.word)
      .slice(0, 5);
  }

  private fallbackPainWords(p: PainPoint): string[] {
    const lexicon: Record<string, string[]> = {
      emotional: [
        "grief",
        "fear",
        "trauma",
        "anxiety",
        "loss",
        "displacement",
        "violence",
        "isolation",
      ],
      environmental: [
        "drought",
        "flood",
        "heat",
        "wildfire",
        "erosion",
        "pollution",
      ],
      physical: ["pain", "fatigue", "injury", "chronic", "migraine", "strain"],
      socioeconomic: ["poverty", "inequality", "precarity", "debt", "inflation", "stress"],
    };
    const bag = lexicon[p.type] ?? ["pain", "stress", "strain"];
    const seed = Math.abs(
      Math.floor((p.lat + 90) * 131 + (p.lng + 180) * 71 + p.intensity * 1000),
    );
    return [bag[seed % bag.length]!, bag[(seed + 3) % bag.length]!];
  }

  private createWordSprite(text: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const mat = new THREE.SpriteMaterial({ color: 0xd1f7ff });
      return new THREE.Sprite(mat);
    }
    const pixelRatio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
    const fontPx = 13;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    const padX = 3;
    const maxText = text.slice(0, 28);
    const w = Math.ceil(ctx.measureText(maxText).width + padX * 2);
    const h = 18;
    canvas.width = Math.max(24, w) * pixelRatio;
    canvas.height = h * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d1f7ff";
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(maxText, padX, h * 0.52);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: 0.9,
    });
    const sprite = new THREE.Sprite(mat);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(0.03 * aspect, 0.03, 1);
    return sprite;
  }

  private tickWordCloud(): void {
    if (!this.wordCloudEnabled || this.currentLayerId !== "emotional") return;
    const camDir = this.camera.position.clone().normalize();
    const q = this.emotionalWordsGroup.quaternion;
    for (const item of this.wordCloudItems) {
      const worldDir = item.dir.clone().applyQuaternion(q);
      const facing = worldDir.dot(camDir);
      item.sprite.visible = facing > 0.05;
      if (!item.sprite.visible) continue;
      const scale = 0.92 + facing * 0.2;
      item.sprite.scale.set(item.baseScaleX * scale, item.baseScaleY * scale, 1);
    }
  }

  pickWordCloudHover(clientX: number, clientY: number): WordCloudHoverInfo | null {
    if (!this.wordCloudEnabled || this.currentLayerId !== "emotional") return null;
    if (!this.wordCloudItems.length) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.emotionalWordsGroup.children, false);
    for (const hit of hits) {
      const obj = hit.object;
      if (obj instanceof THREE.Sprite && obj.userData.wordCloudHover) {
        return obj.userData.wordCloudHover as WordCloudHoverInfo;
      }
    }
    return null;
  }

  private painTypeColor(type: string): THREE.Color {
    if (type === "environmental") return new THREE.Color(0x05e2c2);
    if (type === "physical") return new THREE.Color(0xff7a96);
    if (type === "emotional") return new THREE.Color(0x7f90ff);
    if (type === "socioeconomic") return new THREE.Color(0xffcc72);
    return new THREE.Color(0x9ab8d4);
  }

  private rebuildMultiplexVisualization(points: PainPoint[]): void {
    this.disposeMultiplexObjects();
    const sample = points.slice(0, 260);
    if (sample.length === 0) return;

    const directions: THREE.Vector3[] = [];
    const nodeTargets: number[] = [];
    const nodeIntensity: number[] = [];
    const nodeType: string[] = [];
    const nodeMeshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];

    for (let i = 0; i < sample.length; i++) {
      const p = sample[i]!;
      const dir = latLngToVector3(p.lat, p.lng, 1).normalize();
      directions.push(dir);
      const shell = RADIUS * (1.02 + 0.11 * p.intensity);
      nodeTargets.push(shell);
      nodeIntensity.push(p.intensity);
      nodeType.push(p.type);
      const c = this.painTypeColor(p.type);
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 10, 10),
        new THREE.MeshBasicMaterial({
          color: c,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }),
      );
      const mClip = node.material as unknown as MaterialWithClipping;
      mClip.clipping = true;
      mClip.clipIntersection = false;
      mClip.clippingPlanes = this.clipPlanesFront;
      node.position.copy(dir.clone().multiplyScalar(RADIUS * 1.003));
      node.userData.multiplexHover = {
        kind: "node",
        type: p.type,
        intensity: p.intensity,
        text: p.text,
        metadata: p.metadata,
        lat: p.lat,
        lng: p.lng,
      } satisfies MultiplexNodeHover;
      this.multiplexGroup.add(node);
      nodeMeshes.push(node);
    }

    const linkPos: number[] = [];
    const linksRuntime: MultiplexLink[] = [];
    const linkDedup = new Set<string>();
    for (let ia = 0; ia < sample.length; ia++) {
      const da = directions[ia]!;
      const typeA = nodeType[ia]!;
      const intA = nodeIntensity[ia]!;
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let ib = 0; ib < sample.length; ib++) {
        if (ib === ia) continue;
        if (nodeType[ib] !== typeA) continue;
        const db = directions[ib]!;
        const dot = da.dot(db);
        if (dot > 0.9975) continue;
        // Weighted relation: nearby + similar magnitude.
        const geoCost = 1 - dot;
        const intensityCost = Math.abs(intA - (nodeIntensity[ib] ?? intA));
        const score = geoCost * 0.78 + intensityCost * 0.22;
        if (score < bestScore) {
          bestScore = score;
          best = ib;
        }
      }
      if (best < 0) continue;
      const a = Math.min(ia, best);
      const b = Math.max(ia, best);
      const key = `${a}:${b}`;
      if (linkDedup.has(key)) continue;
      linkDedup.add(key);
      const pa = directions[ia]!.clone().multiplyScalar(RADIUS * 1.003);
      const pb = directions[best]!.clone().multiplyScalar(RADIUS * 1.003);
      linksRuntime.push({
        aIndex: ia,
        bIndex: best,
        progress: 0,
      });
      linkPos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    if (linkPos.length > 0) {
      const linksGeom = new THREE.BufferGeometry();
      linksGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linkPos, 3),
      );
      const linksMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const linksClip = linksMat as unknown as MaterialWithClipping;
      linksClip.clipping = true;
      linksClip.clipIntersection = false;
      linksClip.clippingPlanes = this.clipPlanesFront;
      const links = new THREE.LineSegments(linksGeom, linksMat);
      links.name = "multiplexLinks";
      this.multiplexGroup.add(links);
    }

    const bins = new Map<
      string,
      { dir: THREE.Vector3; weight: number; count: number; latBin: number; lngBin: number }
    >();
    for (let i = 0; i < sample.length; i++) {
      const p = sample[i]!;
      const latBin = Math.round((p.lat + 90) / 18);
      const lngBin = Math.round((p.lng + 180) / 24);
      const key = `${latBin}:${lngBin}`;
      const prev = bins.get(key);
      if (prev) {
        prev.dir.add(directions[i]!);
        prev.weight += p.intensity;
        prev.count += 1;
      } else {
        bins.set(key, {
          dir: directions[i]!.clone(),
          weight: p.intensity,
          count: 1,
          latBin,
          lngBin,
        });
      }
    }

    const clusterPos: number[] = [];
    const clusterCol: number[] = [];
    const clusterMeta: MultiplexClusterHover[] = [];
    const clusterDirs: THREE.Vector3[] = [];
    const clusterTargets: number[] = [];
    for (const v of bins.values()) {
      if (v.count < 2) continue;
      const dir = v.dir.normalize();
      const avg = v.weight / v.count;
      const shell = RADIUS * (1.15 + Math.min(0.24, v.count * 0.012 + avg * 0.08));
      clusterDirs.push(dir.clone());
      clusterTargets.push(shell);
      const p = dir.clone().multiplyScalar(RADIUS * 1.01);
      clusterPos.push(p.x, p.y, p.z);
      clusterCol.push(1.0, 0.227, 0.259);
      const lat = 90 - v.latBin * 18;
      const lng = v.lngBin * 24 - 180;
      clusterMeta.push({
        kind: "cluster",
        count: v.count,
        avgIntensity: avg,
        lat,
        lng,
      });
    }
    if (clusterPos.length > 0) {
      const clusterGeom = new THREE.BufferGeometry();
      clusterGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(clusterPos, 3),
      );
      clusterGeom.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(clusterCol, 3),
      );
      const clusterMat = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
      const clusterClip = clusterMat as unknown as MaterialWithClipping;
      clusterClip.clipping = true;
      clusterClip.clipIntersection = false;
      clusterClip.clippingPlanes = this.clipPlanesFront;
      const clusters = new THREE.Points(clusterGeom, clusterMat);
      clusters.name = "multiplexClusters";
      clusters.userData.clusterMeta = clusterMeta;
      this.multiplexGroup.add(clusters);
    }

    const linkObj = this.multiplexGroup.children.find(
      (ch) => ch instanceof THREE.LineSegments,
    ) as THREE.LineSegments | undefined;
    const linkPosAttr = linkObj
      ? (linkObj.geometry.getAttribute("position") as THREE.BufferAttribute)
      : null;
    const clusterObj = this.multiplexGroup.children.find(
      (ch) => ch instanceof THREE.Points && ch.name === "multiplexClusters",
    ) as THREE.Points | undefined;
    const clusterPosAttr = clusterObj
      ? (clusterObj.geometry.getAttribute("position") as THREE.BufferAttribute)
      : null;
    this.multiplexRuntime = {
      nodeDirs: directions.map((d) => d.clone()),
      nodeTargets,
      nodeProgress: new Array(directions.length).fill(0),
      nodeMeshes,
      clusterDirs,
      clusterTargets,
      clusterProgress: new Array(clusterDirs.length).fill(0),
      clusterPositionAttr:
        clusterPosAttr ?? new THREE.BufferAttribute(new Float32Array(0), 3),
      links: linksRuntime,
      linkPositionAttr: linkPosAttr,
    };

    this.applyMultiplexTheme();
  }

  pickMultiplexHover(clientX: number, clientY: number): MultiplexHoverInfo | null {
    if (this.painVizMode !== "multiplex-v0") return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.raycaster.params.Points.threshold = 0.06;
    const hits = this.raycaster.intersectObjects(this.multiplexGroup.children, false);
    if (hits.length === 0) return null;
    for (const hit of hits) {
      const obj = hit.object;
      if (obj instanceof THREE.Mesh && obj.userData.multiplexHover) {
        return obj.userData.multiplexHover as MultiplexNodeHover;
      }
      if (obj instanceof THREE.Points && obj.name === "multiplexClusters") {
        const idx = hit.index ?? -1;
        const meta = (obj.userData.clusterMeta as MultiplexClusterHover[] | undefined) ?? [];
        if (idx >= 0 && idx < meta.length) return meta[idx]!;
      }
    }
    return null;
  }

  private applyMultiplexTheme(): void {
    const white = new THREE.Color(0xffffff);
    const pale = new THREE.Color(0xd1f7ff);
    for (const ch of this.multiplexGroup.children) {
      if (ch instanceof THREE.LineSegments) {
        ch.material.color.copy(this.visualTheme === "blue" ? white : pale);
      }
      if (ch instanceof THREE.Points && ch.name === "multiplexClusters") {
        const m = ch.material as THREE.PointsMaterial;
        m.size = this.visualTheme === "blue" ? 0.05 : 0.045;
        m.opacity = this.visualTheme === "blue" ? 0.58 : 0.5;
      }
      if (ch instanceof THREE.Mesh && ch.geometry instanceof THREE.SphereGeometry) {
        const m = ch.material as THREE.MeshBasicMaterial;
        m.opacity = this.visualTheme === "blue" ? 0.72 : 0.62;
      }
    }
  }

  private tickMultiplex(dt: number): void {
    if (this.painVizMode !== "multiplex-v0") return;
    this.multiplexTime += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.multiplexTime * 0.55);
    for (const ch of this.multiplexGroup.children) {
      if (ch instanceof THREE.Mesh && ch.geometry instanceof THREE.SphereGeometry) {
        const m = ch.material as THREE.MeshBasicMaterial;
        m.opacity = (this.visualTheme === "blue" ? 0.58 : 0.5) + pulse * 0.2;
      } else if (ch instanceof THREE.Points && ch.name === "multiplexClusters") {
        const m = ch.material as THREE.PointsMaterial;
        m.opacity = (this.visualTheme === "blue" ? 0.36 : 0.3) + pulse * 0.14;
      } else if (ch instanceof THREE.LineSegments) {
        ch.material.opacity = 0.09 + pulse * 0.12;
      }
    }
    const rt = this.multiplexRuntime;
    if (!rt) return;
    const camDir = this.camera.position.clone().normalize();
    const q = this.multiplexGroup.quaternion;
    const baseRadius = RADIUS * 1.003;
    const growRate = 2.1;
    const shrinkRate = 1.5;

    for (let i = 0; i < rt.nodeDirs.length; i++) {
      const localDir = rt.nodeDirs[i]!;
      const worldDir = localDir.clone().applyQuaternion(q);
      const visible = worldDir.dot(camDir) > 0;
      const targetProgress = visible ? 1 : 0;
      const speed = visible ? growRate : shrinkRate;
      const p = THREE.MathUtils.damp(
        rt.nodeProgress[i]!,
        targetProgress,
        speed,
        dt,
      );
      rt.nodeProgress[i] = p;
      const radius = THREE.MathUtils.lerp(baseRadius, rt.nodeTargets[i]!, p);
      const node = rt.nodeMeshes[i];
      if (node) {
        node.position.copy(localDir.clone().multiplyScalar(radius));
        node.visible = p > 0.01;
        node.scale.setScalar(0.8 + p * 0.3);
      }
    }

    if (rt.clusterPositionAttr.count > 0) {
      const clusterArr = rt.clusterPositionAttr.array as Float32Array;
      for (let i = 0; i < rt.clusterDirs.length; i++) {
        const localDir = rt.clusterDirs[i]!;
        const worldDir = localDir.clone().applyQuaternion(q);
        const visible = worldDir.dot(camDir) > 0;
        const targetProgress = visible ? 1 : 0;
        const p = THREE.MathUtils.damp(
          rt.clusterProgress[i]!,
          targetProgress,
          visible ? 1.5 : 1.2,
          dt,
        );
        rt.clusterProgress[i] = p;
        const radius = THREE.MathUtils.lerp(RADIUS * 1.01, rt.clusterTargets[i]!, p);
        const pos = localDir.clone().multiplyScalar(radius);
        const j = i * 3;
        clusterArr[j] = pos.x;
        clusterArr[j + 1] = pos.y;
        clusterArr[j + 2] = pos.z;
      }
      rt.clusterPositionAttr.needsUpdate = true;
    }

    if (rt.linkPositionAttr && rt.links.length > 0) {
      const linkArr = rt.linkPositionAttr.array as Float32Array;
      for (let i = 0; i < rt.links.length; i++) {
        const link = rt.links[i]!;
        const aDir = rt.nodeDirs[link.aIndex]!;
        const bDir = rt.nodeDirs[link.bIndex]!;
        const wa = aDir.clone().applyQuaternion(q);
        const wb = bDir.clone().applyQuaternion(q);
        const visible = wa.dot(camDir) > 0.03 && wb.dot(camDir) > 0.03;
        link.progress = THREE.MathUtils.damp(
          link.progress,
          visible ? 1 : 0,
          visible ? 1.7 : 1.2,
          dt,
        );
        const aNodeProgress = rt.nodeProgress[link.aIndex] ?? 0;
        const bNodeProgress = rt.nodeProgress[link.bIndex] ?? 0;
        const aPos = aDir.clone().multiplyScalar(
          THREE.MathUtils.lerp(baseRadius, rt.nodeTargets[link.aIndex]!, aNodeProgress),
        );
        const bPos = bDir.clone().multiplyScalar(
          THREE.MathUtils.lerp(baseRadius, rt.nodeTargets[link.bIndex]!, bNodeProgress),
        );
        const j = i * 6;
        linkArr[j] = aPos.x;
        linkArr[j + 1] = aPos.y;
        linkArr[j + 2] = aPos.z;
        linkArr[j + 3] = bPos.x;
        linkArr[j + 4] = bPos.y;
        linkArr[j + 5] = bPos.z;
        const alpha = visible ? link.progress : 0;
        if (alpha <= 0.001) {
          linkArr[j] = 0;
          linkArr[j + 1] = 0;
          linkArr[j + 2] = 0;
          linkArr[j + 3] = 0;
          linkArr[j + 4] = 0;
          linkArr[j + 5] = 0;
        }
      }
      rt.linkPositionAttr.needsUpdate = true;
    }
  }

  private syncBackGlowToCamera(): void {
    const camPos = this.camera.position;
    const camDist = camPos.length();
    const camDir = camPos.clone().normalize();
    this.backGlow.position.copy(camDir.multiplyScalar(-BACK_GLOW_DISTANCE));
    this.backGlow.quaternion.copy(this.camera.quaternion);
    const cameraToPlane = camDist + BACK_GLOW_DISTANCE;
    const alpha = Math.asin(THREE.MathUtils.clamp(RADIUS / camDist, 0, 0.9999));
    const silhouetteRadiusOnPlane = Math.tan(alpha) * cameraToPlane;
    const planeHalf = BACK_GLOW_SIZE * 0.5;
    const silhouetteNorm = THREE.MathUtils.clamp(
      silhouetteRadiusOnPlane / planeHalf,
      0.15,
      0.94,
    );
    const inner = Math.min(0.97, silhouetteNorm + 0.02);
    const outer = Math.min(0.995, inner + 0.105);
    const mid = inner + (outer - inner) * 0.48;
    this.backGlow.material.uniforms.uInnerRadius.value = inner;
    this.backGlow.material.uniforms.uMidRadius.value = mid;
    this.backGlow.material.uniforms.uOuterRadius.value = outer;
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.bordersOutlines?.setResolution(w, h);
  };
}
