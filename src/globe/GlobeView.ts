import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MapLayer, PainPoint } from "../types/api";
import { isChoroplethMapLayer } from "../api/layers";
import {
  loadGlobeBorderOutlines,
  type GlobeBorderOutlines,
} from "./countryBorders";
import {
  aggregateChoroplethValues,
  createChoroplethTexture,
  ensureChoroplethCountriesLoaded,
} from "./choroplethField";
import {
  createEarthStippleGlobe,
  STIPPLE_LAND_MASK_GEOJSON_URL,
} from "./earthStippleGlobe";
import {
  createLayerCanvasTexture,
  getLayerBaseColorLinear,
  type VisualTheme,
} from "./layerTextures";
import { latLngToVector3, vector3ToLatLng } from "./latLng";
import {
  CO2_HAZE_TUNE_DEFAULTS,
  createCo2HazeTexture,
  filterCo2HazePoints,
  type Co2HazeTune,
} from "./co2HazeField";
import {
  createPainHeatTexture,
  type HeatMapBuildParams,
} from "./painHeatField";
import {
  createTemperatureHazeTexture,
  filterTemperatureHazePoints,
  TEMPERATURE_HAZE_TUNE_DEFAULTS,
} from "./temperatureHazeField";
import {
  createPainScarDisplacementTexture,
  drawScarMapPreview,
} from "./painScarField";
import { unitDirectionToGlobeEquirectUV } from "./globeEquirectUV";
import {
  applyScarToSpherePositions,
  sampleScarHeight01,
  SCAR_OVERLAY_SURFACE_BIAS,
} from "./scarDisplacement";
import { DEBUG_SCAR_VISUAL, isDebugScarVisual } from "./debugScarVisual";

export type { Co2HazeTune };

/**
 * “Inner black sphere” in scar mode is usually NOT a mesh — land/ocean stipple is GPU-dented;
 * transparent ocean + wrong limb culling read as see-through and nested shells. Strong
 * hemisphere clip bias + facing cull (see debug defaults) fix back-side bleed without an extra fill mesh.
 */
/** Stipple: discard when dot(surfaceNormal, viewDir) < this; can be negative to keep more limb dots. */
export const GLOBE_DEBUG_TUNE_DEFAULTS = {
  facingCullMin: -0.2,
  scarDispScale: 0.12,
  scarDispBias: -0.052,
  oceanAlphaBoost: 0.2,
  /** 1 = land dents only (nested “inner sphere”); 0 = land + ocean move together. */
  scarLandOnly: 0,
  oceanAlphaMin: 0.16,
  /** Clip plane offset along view (world units); more negative clips harder at the limb. */
  hemisphereClipBias: -0.5,
  glowIntensity: 0.38,
  /** Scar height map: min stamp radius (px on 1000×482 texture). */
  scarStampRadiusMin: 1,
  /** Scales stamp footprint before min clamp. */
  scarStampRadiusMul: 0.15,
  /** Scales per-stamp depth in texture. */
  scarStampPeakMul: 0.35,
  /** Gaussian tightness inside each stamp disk. */
  scarFalloffSigma: 1.05,
  /** Post-stamp box blur (px); 0 = off. */
  scarBlurPass1Radius: 4,
  scarBlurPass2Radius: 1,
} as const;

export type GlobeDebugTune = {
  facingCullMin: number;
  scarDispScale: number;
  scarDispBias: number;
  oceanAlphaBoost: number;
  scarLandOnly: number;
  oceanAlphaMin: number;
  hemisphereClipBias: number;
  glowIntensity: number;
  scarStampRadiusMin: number;
  scarStampRadiusMul: number;
  scarStampPeakMul: number;
  scarFalloffSigma: number;
  scarBlurPass1Radius: number;
  scarBlurPass2Radius: number;
};

const SCAR_HEIGHT_MAP_TUNE_KEYS: readonly (keyof GlobeDebugTune)[] = [
  "scarStampRadiusMin",
  "scarStampRadiusMul",
  "scarStampPeakMul",
  "scarFalloffSigma",
  "scarBlurPass1Radius",
  "scarBlurPass2Radius",
];

const STIPPLE_FACING_CULL_OFF = -0.5;
/** Default stipple heat-map mix strength (debug panel Heat map section). */
const HEAT_MAP_STRENGTH_DEFAULT = 2.82;
/** Runtime Three.js supports clipping on materials; some @types/three versions omit it. */
type MaterialWithClipping = THREE.Material & {
  clipping: boolean;
  clipIntersection: boolean;
  clippingPlanes: THREE.Plane[] | null;
};

const RADIUS = 1;
/** Max angular distance (°) between a surface click and nearest pain point before pick returns null. */
const MAX_CLICK_SOUND_RADIUS_DEG = 15;

/** Spherical law of cosines — central angle between two WGS84 positions, in degrees. */
function greatCircleDistanceDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = THREE.MathUtils.degToRad(lat1);
  const φ2 = THREE.MathUtils.degToRad(lat2);
  const Δλ = THREE.MathUtils.degToRad(lng2 - lng1);
  const cosC =
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return THREE.MathUtils.radToDeg(
    Math.acos(THREE.MathUtils.clamp(cosC, -1, 1)),
  );
}

/** Rim sphere (`glow`) additive shell. */
const GLOBE_ATMOSPHERE_GLOW_ENABLED = true;
/** Solid globe shell tint (map cleared when applied — solid color). */
const GLOBE_SHELL_COLOR = 0x080c1a;
/** Show solid `globe` mesh in scar/multiplex mode (stipple display). */
const GLOBE_SHELL_VISIBLE_IN_SCAR_MODE = false;
/** Earth rotates eastward once per sidereal day (~23h56m); slowed for calm ambient motion. */
const GLOBE_AUTO_SPIN_RAD_PER_SEC = (Math.PI * 2) / (23 * 3600 + 56 * 60 + 4) * 160;
const GLOW_RADIUS = RADIUS * 1.09;
/** Country choropleth shell just above the solid globe (below CO2 haze). */
const CHOROPLETH_SHELL_RADIUS = RADIUS * 1.001;
/** CO2 haze shell between solid globe and rim glow. */
const HAZE_RADIUS = RADIUS * 1.05;
/** Temperature haze shell just outside the solid globe (inside CO2 haze). */
const TEMPERATURE_SHELL_RADIUS = RADIUS * 1.003;
/** Pain “points” mode marker sphere radius on the globe surface. */
const MARKER_BASE_RADIUS = 0.018;
const MARKER_SPHERE_WIDTH_SEGMENTS = 8;
const MARKER_SPHERE_HEIGHT_SEGMENTS = 8;
/** Minimum emissive floor when tuning emissiveBase down (low-intensity markers stay visible). */
const MARKER_EMISSIVE_BASE_MIN = 0.25;
const MARKER_EMISSIVE_INTENSITY_SCALE = 0.5;
/** Instance radius multiplier at intensity 0 (scales up by MARKER_RADIUS_INTENSITY_SPAN toward 1). */
const MARKER_RADIUS_INTENSITY_MIN = 0.7;
const MARKER_RADIUS_INTENSITY_SPAN = 0.6;
/** Grow instanced buffer when point count exceeds capacity. */
const MARKER_INSTANCE_CAPACITY_GROWTH = 1.25;
const MARKER_INSTANCE_INITIAL_CAPACITY = 256;
/** Base marker color before per-instance layer tint is applied (instanceColor × emissive). */
const MARKER_COLOR_WHITE = 0xffffff;
/** Word-cloud connector lines (surface → sprite). */
const WORD_CLOUD_LINE_COLOR = 0xffffff;
const WORD_CLOUD_LINE_OPACITY = 0.3;
/** Hide far-side sprites / degenerate their connectors (camera-facing dot product). */
const WORD_CLOUD_FACING_MIN = 0.05;

export type GlobeMarkerTune = {
  radius: number;
  roughness: number;
  metalness: number;
  opacity: number;
  emissiveBase: number;
};

/** Default pain-marker look (debug panel Markers section; geometry uses {@link MARKER_BASE_RADIUS} as unit scale). */
const GLOBE_MARKER_TUNE_DEFAULTS: GlobeMarkerTune = {
  radius: 0.006,
  roughness: 1.0,
  metalness: 0.0,
  opacity: 0.27,
  emissiveBase: 0.67,
};

/** Heat texture stamp curve + stipple mix strength (debug panel Heat map section). */
export type GlobeHeatTune = HeatMapBuildParams & {
  heatStrength: number;
};

const GLOBE_HEAT_TUNE_DEFAULTS: GlobeHeatTune = {
  peakPower: 0.7,
  peakFloor: 0.02,
  heatStrength: 2.3,
};

/** Defaults for debug-panel CO2 haze stamp / blur / alpha. */
const GLOBE_CO2_HAZE_TUNE_DEFAULTS: Co2HazeTune = {
  ...CO2_HAZE_TUNE_DEFAULTS,
};

/** Uniform scale on `bordersOutlines.group` (debug panel Borders section). */
const BORDER_SHELL_SCALE_DEFAULT = 0.9999;
const BORDER_SHELL_SCALE_MIN = 0.99;
const BORDER_SHELL_SCALE_MAX = 1.01;

/**
 * CPU stamp / blur + shell opacity scale for Temperature haze
 * (debug panel Temperature Heat section).
 */
export type TempHeatTune = {
  /** Base stamp radius in texture pixels before intensity scaling. */
  stampRadiusBase: number;
  /** Extra stamp radius at full intensity (px). */
  stampRadiusSpan: number;
  /** First box-blur radius (px); 0 skips the pass. */
  blurPass1Radius: number;
  /** Second box-blur radius (px); 0 skips the pass. */
  blurPass2Radius: number;
  /** Multiplier on temperature shell material opacity (breathing base). */
  heatStrength: number;
};

const GLOBE_TEMP_HEAT_TUNE_DEFAULTS: TempHeatTune = {
  stampRadiusBase: 3,
  stampRadiusSpan: 5,
  blurPass1Radius: 2,
  blurPass2Radius: 1,
  heatStrength: 1,
};

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
  /** Index into the connector position buffer (`i * 6` floats). */
  segmentOffset: number;
};

/** One connector: start = dir × startRadius, end = dir × endRadius. Radii 0 → degenerate (hidden). */
function writeWordCloudSegment(
  positions: Float32Array,
  offset: number,
  dir: THREE.Vector3,
  startRadius: number,
  endRadius: number,
): void {
  positions[offset] = dir.x * startRadius;
  positions[offset + 1] = dir.y * startRadius;
  positions[offset + 2] = dir.z * startRadius;
  positions[offset + 3] = dir.x * endRadius;
  positions[offset + 4] = dir.y * endRadius;
  positions[offset + 5] = dir.z * endRadius;
}
export type WordCloudHoverInfo = {
  country: string;
  shortLabel: string;
  fullText: string;
  intensity: number;
};
/** Debug-only marker hover payload (points viz, InstancedMesh pick). */
export type MarkerHoverInfo = {
  layerId: string;
  intensity: number;
  lat: number;
  lng: number;
  category: string;
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
type GlobeDisplayMode = "texture" | "points";
/** How pain submissions are drawn: floating markers vs. inward dents on the sphere. */
export const PAIN_VIZ_MODE = {
  points: "points",
  scars: "scars",
  multiplexV0: "multiplex-v0",
} as const;
export type PainVisualizationMode =
  (typeof PAIN_VIZ_MODE)[keyof typeof PAIN_VIZ_MODE];

/** Toggle targets for the temporary globe debug panel (`globeDebugPanel.ts`). */
export type GlobeDebugLayerId =
  | "glow"
  | "globe"
  | "stipple"
  | "stippleLand"
  | "stippleOcean"
  | "coastlines"
  | "countryBorders"
  | "markers"
  | "multiplex"
  | "wordCloud"
  | "scarDisplacement"
  | "heatOverlay"
  | "hemisphereClip"
  | "lights";

export type GlobeDebugLayerState = {
  id: GlobeDebugLayerId;
  visible: boolean;
  /** Visibility from app mode alone (ignores debug overrides). */
  autoVisible: boolean;
  available: boolean;
  overridden: boolean;
};
const BORDERS_BASE = `${import.meta.env.BASE_URL}borders/`;

/**
 * GLOBE SCENE LAYERS (bottom → top, renderOrder)
 * =============================================
 * All geographic shells use radius RADIUS (= 1) unless noted.
 *
 * scene (root)
 * ├── lights (ambLight, keyLight, fillLight)
 * ├── earthContent      rotates with auto-spin; parent of solid + choropleth + CO2 haze + rim glow
 * │   ├── glow              renderOrder -1  — rim sphere (GLOBE_ATMOSPHERE_GLOW_ENABLED)
 * │   ├── co2Haze           renderOrder -1  — CO2 category haze (HAZE_RADIUS; AdditiveBlending)
 * │   ├── temperatureShell  renderOrder -1  — Temperature haze (TEMPERATURE_SHELL_RADIUS)
 * │   ├── choroplethShell   renderOrder  1  — country fill (CHOROPLETH_SHELL_RADIUS; NormalBlending)
 * │   └── globe             renderOrder  0  — solid MeshStandardMaterial sphere (“globe shell”)
 * │       · always GLOBE_SHELL_COLOR (no choropleth map swap)
 * │       · scar mode: usually hidden; CPU-warped when debug showGlobeMeshInScarMode
 * ├── pointsStipple     renderOrder  2  — land/ocean dots (earthStippleGlobe.ts)
 * │       · scar: GPU displacement + heat tint on land dots
 * ├── markersGroup      renderOrder  2  — pain “points” mode markers (small spheres)
 * ├── bordersOutlines   renderOrder  3  — coast + country lines (countryBorders.ts)
 * ├── multiplexGroup    renderOrder  3  — multiplex-v0 nodes / links / clusters
 * └── textLayerGroup renderOrder 4 — word-cloud sprites + connector LineSegments
 *
 * Scar / heat data (not separate meshes):
 *   painScarField.ts  → scarDisplacementMap → dents (stipple VS + border CPU warp)
 *   painHeatField.ts  → painHeatMap         → orange heat tint (stipple FS only)
 *
 * Visibility toggles (search these method names):
 *   syncBaseGlobeVisibility()  — globe solid shell
 *   syncStippleVisibility()    — pointsStipple layer
 *   syncScarVisualization()    — scar + heat textures, border/stipple warp
 *   rebuildPainGeometryAndTexture() — markersGroup / multiplexGroup
 *
 * Files:
 *   GlobeView.ts          — scene graph, modes, orchestration
 *   earthStippleGlobe.ts    — stipple point shell + shaders
 *   countryBorders.ts     — coastline + inner border line shell
 *   painScarField.ts      — height map for dents
 *   painHeatField.ts      — intensity map for heat color
 *   layerTextures.ts      — procedural texture for globe shell (texture mode)
 *
 * Scar-mode artifact: “inner black sphere” → see SCAR_DISPLACEMENT_* comment above;
 *   not glow/globe (those are separate). Clip plane can add a flat dark cut at the limb.
 */

/** Layer metadata passed from main.ts into {@link GlobeView.updateLayerVisuals} (not raw API shape). */
export type GlobeLayerDisplayMeta = Pick<
  MapLayer,
  "color" | "text" | "geospatial"
> & {
  lexiconBucket: string;
};

export class GlobeView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Rotating group: solid globe + choropleth + temperature/CO2 haze + rim glow (spins with globeSpinY). */
  readonly earthContent = new THREE.Group();
  /** SHELL 0 — Solid sphere (MeshStandardMaterial). See syncBaseGlobeVisibility(). */
  private readonly globe: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  >;
  /**
   * SHELL choropleth — country fill at CHOROPLETH_SHELL_RADIUS (MeshBasicMaterial).
   * Separate from `globe` so scars can dent the solid shell underneath.
   */
  private readonly choroplethShell: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  >;
  /** SHELL CO2 haze — equirect gray+alpha map at HAZE_RADIUS; visible when CO2 points exist. */
  private readonly co2Haze: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  >;
  private co2HazeMap: THREE.DataTexture | null = null;
  /**
   * SHELL temperature haze — equirect red+alpha map at TEMPERATURE_SHELL_RADIUS;
   * visible when Temperature points exist.
   */
  private readonly temperatureShell: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  >;
  private temperatureShellMap: THREE.DataTexture | null = null;
  /** SHELL rim — Larger additive sphere (BackSide); can read as an extra outer haze. */
  private readonly glow: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  /** SHELL markers — “points” viz mode only (InstancedMesh in rebuildMarkerInstanceMatrices). */
  private readonly markersGroup = new THREE.Group();
  private readonly multiplexGroup = new THREE.Group();
  private readonly markerGeometry: THREE.SphereGeometry;
  /** Single draw call for all pain markers; marker picking is out of scope (no per-instance userData). */
  private painMarkersInstanced: THREE.InstancedMesh | null = null;
  private markerMaterial: THREE.MeshStandardMaterial | null = null;
  private markerInstanceCapacity = 0;
  private markerUseInstanceColor = true;
  private readonly markerTempMatrix = new THREE.Matrix4();
  private readonly markerTempPosition = new THREE.Vector3();
  private readonly markerTempScale = new THREE.Vector3(1, 1, 1);
  private readonly markerTempQuaternion = new THREE.Quaternion();
  private readonly markerTempColor = new THREE.Color();
  private readonly textLayerGroup = new THREE.Group();
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  /** SHELL coast + borders — LineSegments2 group (loadCountryOutlines). */
  private bordersOutlines: GlobeBorderOutlines | null = null;
  /** SHELL stipple — Points on sphere (ensureStipple → earthStippleGlobe). */
  private pointsStipple: THREE.Points | null = null;
  private pointsMaterial: THREE.ShaderMaterial | null = null;
  private stippleCleanup: (() => void) | null = null;
  private stipplePromise: Promise<void> | null = null;
  private stippleLandMaskUrl: string | null = null;
  /** Unwarped stipple shell; scar mode warps a copy into the points geometry. */
  private stippleBasePositions: Float32Array | null = null;
  /** Unwarped globe sphere; scar mode warps vertices (same path as stipple + borders). */
  private readonly globeBasePositions: Float32Array;
  private displayMode: GlobeDisplayMode = "texture";
  private painVizMode: PainVisualizationMode = PAIN_VIZ_MODE.points;
  private lastPainPoints: PainPoint[] = [];
  private scarDisplacementMap: THREE.DataTexture | null = null;
  private painHeatMap: THREE.DataTexture | null = null;
  private choroplethMap: THREE.DataTexture | null = null;
  private scarMapPreviewCanvas: HTMLCanvasElement | null = null;
  private scarBuildGeneration = 0;
  private choroplethBuildGeneration = 0;
  /**
   * When true, rebuild scars + choropleth shell + CO2 haze + word clouds together
   * from multi-layer `lastPainPoints` (filtered by uiLayer ids below).
   */
  private showAllLayersMode = false;
  private allLayersPhyspainLayerId = "physpain";
  private allLayersChoroplethLayerId = "socioecopain";
  private allLayersChoroplethColorHex: string | null = null;
  private allLayersEmopainLayerId = "emopain";
  private stippleNeutralScarTexture: THREE.DataTexture | null = null;
  private stippleNeutralHeatTexture: THREE.DataTexture | null = null;
  private readonly ambLight: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly fillLight: THREE.DirectionalLight;
  private visualTheme: VisualTheme = "dark";
  private currentLayerId = "";
  private currentLayerMeta: GlobeLayerDisplayMeta | undefined;
  private currentLayerColorHex: string | null = null;
  private currentLayerSupportsText = false;
  private currentLayerLexiconBucket = "generic";
  /** Keeps coast / borders / stipple / markers on the camera-facing hemisphere only. */
  private readonly hemisphereClipPlane = new THREE.Plane();
  private readonly clipPlanesFront: THREE.Plane[] = [this.hemisphereClipPlane];
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private globeSpinY = 0;
  private autoSpinEnabled = true;
  private surfaceMarkerRings: {
    mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    elapsed: number;
  }[] = [];
  private multiplexTime = 0;
  private multiplexRuntime: MultiplexRuntime | null = null;
  private wordCloudEnabled = false;
  private wordCloudItems: WordCloudItem[] = [];
  private wordCloudConnectors: THREE.LineSegments<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  > | null = null;
  /** Per-layer visibility overrides from the debug panel (`null` = follow auto). */
  private readonly debugLayerOverrides = new Map<GlobeDebugLayerId, boolean>();
  /** Live tuning (debug panel sliders) — see GLOBE_DEBUG_TUNE_DEFAULTS. */
  private debugTune: GlobeDebugTune = { ...GLOBE_DEBUG_TUNE_DEFAULTS };
  /** Pain marker material / size (debug panel Markers section). */
  private markerTune: GlobeMarkerTune = { ...GLOBE_MARKER_TUNE_DEFAULTS };
  /**
   * When false (production default), point markers stay disposed.
   * Debug panel “Show point markers” sets this so points-mode rebuild can run.
   */
  private markersDebugEnabled = false;
  private heatTune: GlobeHeatTune = { ...GLOBE_HEAT_TUNE_DEFAULTS };
  private co2HazeTune: Co2HazeTune = { ...GLOBE_CO2_HAZE_TUNE_DEFAULTS };
  private tempHeatTune: TempHeatTune = { ...GLOBE_TEMP_HEAT_TUNE_DEFAULTS };
  /** Uniform scale for coast/border line shell (`bordersOutlines.group`). */
  private borderShellScale = BORDER_SHELL_SCALE_DEFAULT;

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
    if (isDebugScarVisual()) {
      this.scene.background = new THREE.Color(DEBUG_SCAR_VISUAL.sceneBackground);
      this.renderer.setClearColor(DEBUG_SCAR_VISUAL.sceneBackground, 1);
    } else {
      this.scene.background = null;
    }

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

    // --- SHELL 0: solid globe (hidden in scar mode; see syncBaseGlobeVisibility) ---
    const geo = new THREE.SphereGeometry(RADIUS, 192, 128);
    const mat = new THREE.MeshStandardMaterial({
      color: GLOBE_SHELL_COLOR,
      roughness: 0.78,
      metalness: 0.06,
      transparent: false,
      opacity: 1,
    });
    this.globe = new THREE.Mesh(geo, mat);
    this.globe.renderOrder = 0;
    this.globeBasePositions = new Float32Array(
      geo.attributes.position!.array,
    );
    this.earthContent.add(this.globe);

    // --- Choropleth country-fill shell (just above solid globe; NormalBlending) ---
    this.choroplethShell = new THREE.Mesh(
      new THREE.SphereGeometry(CHOROPLETH_SHELL_RADIUS, 128, 96),
      new THREE.MeshBasicMaterial({
        map: null,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    this.choroplethShell.renderOrder = 1;
    this.choroplethShell.visible = false;
    this.earthContent.add(this.choroplethShell);

    // --- Temperature haze shell (just outside globe; red+alpha equirect from Temperature points) ---
    this.temperatureShell = new THREE.Mesh(
      new THREE.SphereGeometry(TEMPERATURE_SHELL_RADIUS, 64, 48),
      new THREE.MeshBasicMaterial({
        map: null,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.temperatureShell.renderOrder = -1;
    this.temperatureShell.frustumCulled = false;
    this.temperatureShell.visible = false;
    this.earthContent.add(this.temperatureShell);

    // --- CO2 haze shell (between globe and rim glow; gray+alpha equirect from CO2 points) ---
    this.co2Haze = new THREE.Mesh(
      new THREE.SphereGeometry(HAZE_RADIUS, 64, 48),
      new THREE.MeshBasicMaterial({
        map: null,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.co2Haze.renderOrder = -1;
    this.co2Haze.visible = false;
    this.earthContent.add(this.co2Haze);

    // --- Rim glow shell (slightly larger sphere; additive fresnel on back faces) ---
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOW_RADIUS, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          uGlowColor: { value: new THREE.Color(0x7da8ff) },
          uGlowIntensity: { value: GLOBE_DEBUG_TUNE_DEFAULTS.glowIntensity },
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
    this.glow.visible = GLOBE_ATMOSPHERE_GLOW_ENABLED;
    this.earthContent.add(this.glow);

    this.scene.add(this.earthContent);

    // --- Overlay shells (siblings of earthContent; same world rotation via syncWorldRotation) ---
    this.markersGroup.renderOrder = 2;
    this.scene.add(this.markersGroup);
    this.multiplexGroup.renderOrder = 3;
    this.scene.add(this.multiplexGroup);
    this.textLayerGroup.renderOrder = 4;
    this.scene.add(this.textLayerGroup);
    this.markerGeometry = new THREE.SphereGeometry(
      MARKER_BASE_RADIUS,
      MARKER_SPHERE_WIDTH_SEGMENTS,
      MARKER_SPHERE_HEIGHT_SEGMENTS,
    );
    this.markerUseInstanceColor = GlobeView.probeMarkerInstanceColorSupport();

    // Neutral tint until main.ts applyGlobeLayer runs after fetchLayers.
    this.updateLayerVisuals("");
    void this.loadCountryOutlines();
    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  // --- Public mode API (called from main.ts HUD) ---

  /** Swap between procedural canvas texture and stippled point globe (test). */
  setGlobeDisplayMode(mode: GlobeDisplayMode): void {
    this.displayMode = mode;
    this.syncGlobeSurfaceVisibility();
    void this.ensureStipple().then(() => {
      this.syncGlobeSurfaceVisibility();
      if (
        this.painVizMode === PAIN_VIZ_MODE.scars ||
        this.painVizMode === PAIN_VIZ_MODE.multiplexV0
      ) {
        this.syncScarVisualization();
      }
    });
    if (
      this.painVizMode === PAIN_VIZ_MODE.scars ||
      this.painVizMode === PAIN_VIZ_MODE.multiplexV0
    ) {
      this.syncScarVisualization();
    }
    this.updateLayerVisuals(this.currentLayerId, this.currentLayerMeta);
  }

  /** Markers on the surface vs. displacement “scars” (dents) from the same dataset. */
  setPainVisualizationMode(mode: PainVisualizationMode): void {
    if (this.painVizMode === mode) return;
    this.painVizMode = mode;
    this.syncGlobeSurfaceVisibility();
    this.rebuildPainGeometryAndTexture();
  }

  /** Debug panel: force a layer on/off (`clearDebugLayerOverride` restores auto). */
  // --- Debug panel API (globeDebugPanel.ts) ---

  setDebugLayerVisible(id: GlobeDebugLayerId, visible: boolean): void {
    this.debugLayerOverrides.set(id, visible);
    this.applyDebugLayerVisibility();
  }

  clearDebugLayerOverride(id: GlobeDebugLayerId): void {
    this.debugLayerOverrides.delete(id);
    this.applyDebugLayerVisibility();
  }

  resetDebugLayerOverrides(): void {
    this.debugLayerOverrides.clear();
    this.applyDebugLayerVisibility();
  }

  getDebugTune(): GlobeDebugTune {
    return { ...this.debugTune };
  }

  /** Adjust stipple/scar tuning live (debug panel). */
  setDebugTune(partial: Partial<GlobeDebugTune>): void {
    this.debugTune = { ...this.debugTune, ...partial };
    this.applyStippleTuneUniforms();
    this.applyHemisphereClipping();
    this.applyStippleScarUniforms();
    if (
      partial.scarDispScale !== undefined ||
      partial.scarDispBias !== undefined
    ) {
      this.refreshCpuScarDisplacementFromTune();
    }
    if (
      SCAR_HEIGHT_MAP_TUNE_KEYS.some((k) => partial[k] !== undefined) &&
      (this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0)
    ) {
      this.scheduleScarFieldRebuild();
    }
  }

  resetDebugTune(): void {
    this.debugTune = { ...GLOBE_DEBUG_TUNE_DEFAULTS };
    this.applyStippleTuneUniforms();
    this.applyHemisphereClipping();
    this.applyStippleScarUniforms();
    this.refreshCpuScarDisplacementFromTune();
    if (
      this.painVizMode === PAIN_VIZ_MODE.scars ||
      this.painVizMode === PAIN_VIZ_MODE.multiplexV0
    ) {
      this.scheduleScarFieldRebuild();
    }
  }

  /** Whether point markers may rebuild in points mode (debug panel only). */
  getMarkersDebugEnabled(): boolean {
    return this.markersDebugEnabled;
  }

  /**
   * Enable/disable point-marker InstancedMesh (debug panel).
   * Triggers {@link syncPainMarkersForVizMode} so the mesh appears or is disposed immediately.
   */
  setMarkersDebugEnabled(enabled: boolean): void {
    this.markersDebugEnabled = enabled;
    this.syncPainMarkersForVizMode();
  }

  /** Current pain-marker tuning (debug panel Markers section). */
  getMarkerTune(): GlobeMarkerTune {
    return { ...this.markerTune };
  }

  /** Adjust pain-marker tuning (debug panel). Material updates live; radius rebuilds instance matrices. */
  setMarkerTune(partial: Partial<GlobeMarkerTune>): void {
    const radiusChanged =
      partial.radius !== undefined && partial.radius !== this.markerTune.radius;
    const merged = { ...this.markerTune, ...partial };
    if (partial.emissiveBase !== undefined) {
      merged.emissiveBase = Math.max(
        MARKER_EMISSIVE_BASE_MIN,
        partial.emissiveBase,
      );
    }
    this.markerTune = merged;
    this.applyMarkerMaterialTune();
    if (
      radiusChanged &&
      this.painVizMode === PAIN_VIZ_MODE.points
    ) {
      this.rebuildMarkerInstanceMatrices(this.lastPainPoints);
    } else if (partial.emissiveBase !== undefined && this.lastPainPoints.length > 0) {
      this.updateMarkerInstanceColors(this.lastPainPoints);
    }
  }

  /** Restore {@link GLOBE_MARKER_TUNE_DEFAULTS} and re-apply marker look. */
  resetMarkerTune(): void {
    this.markerTune = { ...GLOBE_MARKER_TUNE_DEFAULTS };
    this.applyMarkerMaterialTune();
    if (
      this.painVizMode === PAIN_VIZ_MODE.points &&
      this.lastPainPoints.length > 0
    ) {
      this.rebuildMarkerInstanceMatrices(this.lastPainPoints);
    }
  }

  /** Current heat-map build + stipple mix tuning (debug panel Heat map section). */
  getHeatTune(): GlobeHeatTune {
    return { ...this.heatTune };
  }

  /** Adjust heat stamp curve and/or stipple mix; peak params rebuild the heat texture. */
  setHeatTune(partial: Partial<GlobeHeatTune>): void {
    const peakChanged =
      (partial.peakPower !== undefined &&
        partial.peakPower !== this.heatTune.peakPower) ||
      (partial.peakFloor !== undefined &&
        partial.peakFloor !== this.heatTune.peakFloor);
    this.heatTune = { ...this.heatTune, ...partial };
    if (peakChanged && this.lastPainPoints.length > 0) {
      this.rebuildPainHeatMap();
    } else {
      this.applyStippleHeatUniforms();
    }
  }

  /** Restore {@link GLOBE_HEAT_TUNE_DEFAULTS}, rebuild heat texture, reapply uniforms. */
  resetHeatTune(): void {
    this.heatTune = { ...GLOBE_HEAT_TUNE_DEFAULTS };
    if (this.lastPainPoints.length > 0) {
      this.rebuildPainHeatMap();
    } else {
      this.applyStippleHeatUniforms();
    }
  }

  /** Current CO2 haze stamp / blur / alpha tuning (debug panel CO2 Haze section). */
  getCo2HazeTune(): Co2HazeTune {
    return { ...this.co2HazeTune };
  }

  /**
   * Update CO2 haze knobs without rebuilding — call {@link rebuildCo2Haze} to apply
   * (CPU stamp over large Env layers is expensive).
   */
  setCo2HazeTune(partial: Partial<Co2HazeTune>): void {
    this.co2HazeTune = { ...this.co2HazeTune, ...partial };
  }

  /** Rebuild the CO2 haze DataTexture from {@link lastPainPoints} and current tune. */
  rebuildCo2Haze(): void {
    this.rebuildCo2HazeMap();
  }

  /** Current border shell uniform scale (debug panel Borders section). */
  getBorderShellScale(): number {
    return this.borderShellScale;
  }

  /** Scale coast/border group uniformly (`bordersOutlines.group.scale.setScalar`). */
  setBorderShellScale(scale: number): void {
    this.borderShellScale = THREE.MathUtils.clamp(
      scale,
      BORDER_SHELL_SCALE_MIN,
      BORDER_SHELL_SCALE_MAX,
    );
    this.applyBorderShellScale();
  }

  /** Restore {@link BORDER_SHELL_SCALE_DEFAULT} and re-apply. */
  resetBorderShellScale(): void {
    this.borderShellScale = BORDER_SHELL_SCALE_DEFAULT;
    this.applyBorderShellScale();
  }

  private applyBorderShellScale(): void {
    this.bordersOutlines?.group.scale.setScalar(this.borderShellScale);
  }

  /** Current Temperature haze stamp / blur / strength (debug panel Temperature Heat). */
  getTempHeatTune(): TempHeatTune {
    return { ...this.tempHeatTune };
  }

  /**
   * Update Temperature haze knobs without rebuilding — call {@link rebuildTempHeat}
   * to apply stamp/blur (CPU stamp can be slow on large Env layers).
   */
  setTempHeatTune(partial: Partial<TempHeatTune>): void {
    this.tempHeatTune = { ...this.tempHeatTune, ...partial };
  }

  /** Rebuild Temperature haze shell from {@link lastPainPoints} and current temp tune. */
  rebuildTempHeat(): void {
    this.rebuildTemperatureShellMap();
  }

  private applyStippleTuneUniforms(): void {
    this.glow.material.uniforms.uGlowIntensity.value =
      this.debugTune.glowIntensity;
    if (!this.pointsMaterial) return;
    const u = this.pointsMaterial.uniforms;
    u.uScarLandOnly.value = this.debugTune.scarLandOnly;
    u.uOceanAlphaMin.value = this.debugTune.oceanAlphaMin;
    if (!isDebugScarVisual()) {
      u.uOceanAlphaBoost.value = this.debugTune.oceanAlphaBoost;
    }
  }

  getDebugLayerStates(): GlobeDebugLayerState[] {
    const ids: GlobeDebugLayerId[] = [
      "glow",
      "globe",
      "stipple",
      "stippleLand",
      "stippleOcean",
      "coastlines",
      "countryBorders",
      "markers",
      "multiplex",
      "wordCloud",
      "scarDisplacement",
      "heatOverlay",
      "hemisphereClip",
      "lights",
    ];
    return ids.map((id) => ({
      id,
      visible: this.getDebugLayerVisible(id),
      autoVisible: this.getAutoDebugLayerVisible(id),
      available: this.isDebugLayerAvailable(id),
      overridden: this.debugLayerOverrides.has(id),
    }));
  }

  private resolveDebugLayerVisibility(
    id: GlobeDebugLayerId,
    autoVisible: boolean,
  ): boolean {
    const o = this.debugLayerOverrides.get(id);
    return o !== undefined ? o : autoVisible;
  }

  private getAutoGlobeVisible(): boolean {
    // Single-layer choropleth: hide the solid shell so only choroplethShell shows.
    if (this.isChoroplethLayerActive() && !this.showAllLayersMode) return false;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    if (scars) {
      return (
        GLOBE_SHELL_VISIBLE_IN_SCAR_MODE ||
        (isDebugScarVisual() && DEBUG_SCAR_VISUAL.showGlobeMeshInScarMode)
      );
    }
    return this.displayMode === "texture";
  }

  private getAutoStippleVisible(): boolean {
    return (
      this.displayMode === "points" ||
      this.painVizMode === PAIN_VIZ_MODE.scars ||
      this.painVizMode === PAIN_VIZ_MODE.multiplexV0
    );
  }

  private getAutoScarDisplacementActive(): boolean {
    if (this.shouldSuppressScarsForChoropleth()) return false;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    return scars && Boolean(this.scarDisplacementMap);
  }

  private getAutoHeatOverlayActive(): boolean {
    if (this.shouldSuppressScarsForChoropleth()) return false;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    return scars && Boolean(this.painHeatMap);
  }

  private isDebugLayerAvailable(id: GlobeDebugLayerId): boolean {
    switch (id) {
      case "stipple":
      case "stippleLand":
      case "stippleOcean":
      case "scarDisplacement":
      case "heatOverlay":
        return Boolean(this.pointsStipple);
      case "coastlines":
      case "countryBorders":
        return Boolean(this.bordersOutlines);
      case "wordCloud":
        return this.wordCloudEnabled;
      default:
        return true;
    }
  }

  private getAutoDebugLayerVisible(id: GlobeDebugLayerId): boolean {
    switch (id) {
      case "glow":
        return GLOBE_ATMOSPHERE_GLOW_ENABLED;
      case "globe":
        return this.getAutoGlobeVisible();
      case "stipple":
        return this.getAutoStippleVisible();
      case "stippleLand":
      case "stippleOcean":
        return this.getAutoStippleVisible();
      case "coastlines":
      case "countryBorders":
        return Boolean(this.bordersOutlines);
      case "markers":
        return (
          !this.shouldSuppressScarsForChoropleth() &&
          this.painVizMode === PAIN_VIZ_MODE.points
        );
      case "multiplex":
        return (
          !this.shouldSuppressScarsForChoropleth() &&
          this.painVizMode === PAIN_VIZ_MODE.multiplexV0
        );
      case "wordCloud":
        return this.wordCloudEnabled && this.textLayerGroup.children.length > 0;
      case "scarDisplacement":
        return this.getAutoScarDisplacementActive();
      case "heatOverlay":
        return this.getAutoHeatOverlayActive();
      case "hemisphereClip":
      case "lights":
        return true;
      default:
        return true;
    }
  }

  private getDebugLayerVisible(id: GlobeDebugLayerId): boolean {
    switch (id) {
      case "glow":
        return this.glow.visible;
      case "globe":
        return this.globe.visible;
      case "stipple":
        return this.pointsStipple?.visible ?? false;
      case "stippleLand":
        return (
          (this.pointsMaterial?.uniforms.uShowLand?.value as number) >= 0.5
        );
      case "stippleOcean":
        return (
          (this.pointsMaterial?.uniforms.uShowOcean?.value as number) >= 0.5
        );
      case "coastlines":
        return this.bordersOutlines?.group.children[0]?.visible ?? false;
      case "countryBorders":
        return this.bordersOutlines?.group.children[1]?.visible ?? false;
      case "markers":
        return this.markersGroup.visible;
      case "multiplex":
        return this.multiplexGroup.visible;
      case "wordCloud":
        return this.textLayerGroup.visible;
      case "scarDisplacement":
        return (this.pointsMaterial?.uniforms.uScarActive?.value as number) >= 0.5;
      case "heatOverlay":
        return (this.pointsMaterial?.uniforms.uHeatActive?.value as number) >= 0.5;
      case "hemisphereClip":
        return (
          (this.pointsMaterial?.uniforms.uFacingCullMin?.value as number) >=
          0
        );
      case "lights":
        return this.ambLight.visible;
      default:
        return false;
    }
  }

  /** Apply mesh/uniform visibility (respects debug overrides). */
  private applyDebugLayerVisibility(): void {
    this.globe.visible = this.resolveDebugLayerVisibility(
      "globe",
      this.getAutoGlobeVisible(),
    );
    if (this.pointsStipple) {
      this.pointsStipple.visible = this.resolveDebugLayerVisibility(
        "stipple",
        this.getAutoStippleVisible(),
      );
    }
    this.glow.visible = this.resolveDebugLayerVisibility(
      "glow",
      GLOBE_ATMOSPHERE_GLOW_ENABLED,
    );
    this.markersGroup.visible = this.resolveDebugLayerVisibility(
      "markers",
      !this.shouldSuppressScarsForChoropleth() &&
        this.painVizMode === PAIN_VIZ_MODE.points,
    );
    this.multiplexGroup.visible = this.resolveDebugLayerVisibility(
      "multiplex",
      !this.shouldSuppressScarsForChoropleth() &&
        this.painVizMode === PAIN_VIZ_MODE.multiplexV0,
    );
    this.textLayerGroup.visible = this.resolveDebugLayerVisibility(
      "wordCloud",
      this.wordCloudEnabled && this.textLayerGroup.children.length > 0,
    );
    if (this.bordersOutlines) {
      const coastAuto = Boolean(this.bordersOutlines);
      this.bordersOutlines.setCoastVisible(
        this.resolveDebugLayerVisibility("coastlines", coastAuto),
      );
      this.bordersOutlines.setInnerBordersVisible(
        this.resolveDebugLayerVisibility("countryBorders", coastAuto),
      );
    }
    if (this.pointsMaterial) {
      const u = this.pointsMaterial.uniforms;
      const stippleOn = this.pointsStipple?.visible ?? false;
      u.uShowLand.value = this.resolveDebugLayerVisibility(
        "stippleLand",
        this.getAutoStippleVisible(),
      )
        ? 1
        : 0;
      u.uShowOcean.value = this.resolveDebugLayerVisibility(
        "stippleOcean",
        this.getAutoStippleVisible(),
      )
        ? 1
        : 0;
    }
    const lightsOn = this.resolveDebugLayerVisibility("lights", true);
    this.ambLight.visible = lightsOn;
    this.keyLight.visible = lightsOn;
    this.fillLight.visible = lightsOn;
    this.applyHemisphereClipping();
    this.applyStippleScarUniforms();
    this.applyStippleHeatUniforms();
    this.syncStippleBackdropClearColor();
  }

  private applyHemisphereClipping(): void {
    const enabled = this.resolveDebugLayerVisibility("hemisphereClip", true);
    const planes = enabled ? this.clipPlanesFront : [];

    // Point sprites + a plane through the origin clip at the limb and look like a
    // smaller inner sphere when zooming; use shader facing cull on stipple instead.
    if (this.pointsMaterial) {
      const m = this.pointsMaterial as unknown as MaterialWithClipping;
      m.clipping = false;
      m.clippingPlanes = [];
      this.pointsMaterial.uniforms.uFacingCullMin.value = enabled
        ? this.debugTune.facingCullMin
        : STIPPLE_FACING_CULL_OFF;
    }

    this.bordersOutlines?.setClippingPlanes(planes);

    for (const ch of this.markersGroup.children) {
      if (ch instanceof THREE.InstancedMesh) {
        const m = ch.material as unknown as MaterialWithClipping;
        m.clipping = enabled;
        m.clippingPlanes = planes;
      }
    }
    for (const ch of this.multiplexGroup.children) {
      const mats = Array.isArray(
        (ch as THREE.Object3D & { material?: THREE.Material | THREE.Material[] })
          .material,
      )
        ? ((ch as THREE.Mesh).material as THREE.Material[])
        : [(ch as THREE.Mesh).material];
      for (const mat of mats) {
        if (!mat) continue;
        const m = mat as unknown as MaterialWithClipping;
        m.clipping = enabled;
        m.clippingPlanes = planes;
      }
    }
  }

  /**
   * SHELL 0 visibility — solid `globe` mesh.
   * Texture display: on. Scar/multiplex: GLOBE_SHELL_VISIBLE_IN_SCAR_MODE (or debugScarVisual flag).
   */
  private syncBaseGlobeVisibility(): void {
    this.globe.visible = this.resolveDebugLayerVisibility(
      "globe",
      this.getAutoGlobeVisible(),
    );
  }

  /** Solid globe shell: full opacity, no layer map (choropleth lives on choroplethShell). */
  private applyGlobeShellColor(): void {
    const mat = this.globe.material as THREE.MeshStandardMaterial;
    mat.map = null;
    mat.color.setHex(GLOBE_SHELL_COLOR);
    mat.transparent = false;
    mat.opacity = 1;
    mat.needsUpdate = true;
  }

  /** Whether the active layer should use country choropleth (single-layer socio path). */
  private isChoroplethLayerActive(): boolean {
    const meta = this.currentLayerMeta;
    if (!meta) return false;
    return isChoroplethMapLayer(meta);
  }

  /** Paint choropleth shell in single-layer choropleth mode or show-all mode. */
  private shouldPaintChoropleth(): boolean {
    return this.showAllLayersMode || this.isChoroplethLayerActive();
  }

  /**
   * Single-layer choropleth replaces scars/markers; show-all keeps both
   * (choropleth on choroplethShell, scars on stipple/globe).
   */
  private shouldSuppressScarsForChoropleth(): boolean {
    return this.isChoroplethLayerActive() && !this.showAllLayersMode;
  }

  /** Points for one production layer id when show-all combines multiple fetches. */
  private pointsForUiLayer(layerId: string): PainPoint[] {
    return this.lastPainPoints.filter((p) => p.uiLayer === layerId);
  }

  private disposeChoroplethMap(): void {
    const mat = this.choroplethShell.material;
    if (mat.map === this.choroplethMap) {
      mat.map = null;
      mat.needsUpdate = true;
    }
    if (this.choroplethMap) {
      this.choroplethMap.dispose();
      this.choroplethMap = null;
    }
    this.choroplethShell.visible = false;
  }

  /** Map choropleth RGBA texture onto choroplethShell (transparent where no country data). */
  private applyChoroplethMaterial(): void {
    const mat = this.choroplethShell.material;
    if (!this.choroplethMap) {
      mat.map = null;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      this.choroplethShell.visible = false;
      return;
    }
    this.choroplethMap.needsUpdate = true;
    mat.map = this.choroplethMap;
    // White multiply so texture RGB (layer yellow) is unchanged.
    mat.color.setHex(0xffffff);
    mat.transparent = true;
    mat.opacity = 1;
    mat.needsUpdate = true;
    this.choroplethShell.visible = true;
  }

  /** Rebuild country choropleth texture when choropleth layer is active or show-all is on. */
  private scheduleChoroplethRebuild(): void {
    const generation = ++this.choroplethBuildGeneration;
    this.disposeChoroplethMap();
    if (!this.shouldPaintChoropleth()) {
      this.applyGlobeShellColor();
      return;
    }

    const points = this.showAllLayersMode
      ? this.pointsForUiLayer(this.allLayersChoroplethLayerId)
      : this.lastPainPoints;
    const colorHex = this.showAllLayersMode
      ? this.allLayersChoroplethColorHex
      : this.currentLayerColorHex;
    void (async () => {
      await ensureChoroplethCountriesLoaded();
      if (generation !== this.choroplethBuildGeneration) return;
      if (!this.shouldPaintChoropleth()) return;
      const values = aggregateChoroplethValues(points);
      this.choroplethMap = createChoroplethTexture(values, colorHex);
      this.applyChoroplethMaterial();
      this.syncGlobeSurfaceVisibility();
    })();
  }

  /** Neutral base color for the displaced globe under stipple (no canvas layer map). */
  private applyGlobeScarShellMaterial(): void {
    if (this.shouldSuppressScarsForChoropleth()) return;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    if (!scars || this.displayMode !== "points") return;
    if (isDebugScarVisual()) {
      this.applyDebugGlobeMaterial();
      return;
    }
    this.applyGlobeShellColor();
    const mat = this.globe.material as THREE.MeshStandardMaterial;
    mat.roughness = 0.82;
    mat.metalness = 0.06;
    mat.needsUpdate = true;
  }

  /**
   * SHELL stipple visibility — `pointsStipple` (earthStippleGlobe).
   * On for displayMode "points" and for painVizMode scars | multiplex-v0.
   */
  private syncStippleVisibility(): void {
    if (!this.pointsStipple) return;
    this.pointsStipple.visible = this.resolveDebugLayerVisibility(
      "stipple",
      this.getAutoStippleVisible(),
    );
  }

  private syncGlobeSurfaceVisibility(): void {
    this.syncBaseGlobeVisibility();
    this.syncStippleVisibility();
    this.applyDebugLayerVisibility();
    this.syncStippleBackdropClearColor();
    this.syncBorderOutlinesRenderOrder();
  }

  /**
   * Keep coast/border lines above the choropleth shell (renderOrder 1).
   * Restores the usual border stack order when choropleth is off.
   */
  private syncBorderOutlinesRenderOrder(): void {
    if (!this.bordersOutlines) return;
    // Choropleth shell: above globe (0) / shell (1). Otherwise: documented default from loadCountryOutlines.
    this.bordersOutlines.group.renderOrder = this.shouldPaintChoropleth() ? 2 : 3;
  }

  /** Keep canvas clear transparent — CSS theme shows outside the globe (never fill whole viewport). */
  private syncStippleBackdropClearColor(): void {
    if (isDebugScarVisual()) return;
    this.renderer.setClearColor(0x000000, 0);
  }

  private disposeStipple(): void {
    if (this.pointsStipple) {
      this.earthContent.remove(this.pointsStipple);
      this.pointsStipple = null;
      this.pointsMaterial = null;
    }
    if (this.stippleCleanup) {
      this.stippleCleanup();
      this.stippleCleanup = null;
    }
    this.stippleNeutralScarTexture = null;
    this.stippleNeutralHeatTexture = null;
    this.stippleLandMaskUrl = null;
    this.stippleBasePositions = null;
  }

  private captureStippleBasePositions(): void {
    if (!this.pointsStipple) return;
    const pos = this.pointsStipple.geometry.getAttribute("position");
    if (!pos) return;
    this.stippleBasePositions = new Float32Array(pos.array);
  }

  /** Reset stipple positions to the base sphere before CPU scar warp. */
  private resetStippleShellPositions(): void {
    if (!this.pointsStipple || !this.stippleBasePositions) return;
    const posAttr = this.pointsStipple.geometry.getAttribute("position");
    if (!posAttr) return;
    (posAttr.array as Float32Array).set(this.stippleBasePositions);
    posAttr.needsUpdate = true;
    this.pointsStipple.geometry.computeBoundingSphere();
  }

  private resetGlobeShellPositions(): void {
    const posAttr = this.globe.geometry.getAttribute("position");
    if (!posAttr) return;
    (posAttr.array as Float32Array).set(this.globeBasePositions);
    posAttr.needsUpdate = true;
    this.globe.geometry.computeVertexNormals();
    this.globe.geometry.computeBoundingSphere();
  }

  private warpGlobeMeshToScarField(map: THREE.DataTexture): void {
    const posAttr = this.globe.geometry.getAttribute("position");
    if (!posAttr) return;
    applyScarToSpherePositions(
      this.globeBasePositions,
      posAttr.array as Float32Array,
      map,
      this.debugTune.scarDispScale,
      this.debugTune.scarDispBias,
      0,
    );
    posAttr.needsUpdate = true;
    this.globe.geometry.computeVertexNormals();
    this.globe.geometry.computeBoundingSphere();
  }

  /**
   * Borders + solid globe use CPU vertex warp; stipple uses GPU scar uniforms.
   * Use the same scale/bias (`debugTune`) so outlines sit on the same deformed shell as dots.
   */
  private refreshCpuScarDisplacementFromTune(): void {
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    const map = this.scarDisplacementMap;
    if (!scars || !map) return;

    this.bordersOutlines?.setScarDisplacementMap(
      map,
      this.debugTune.scarDispScale,
      this.debugTune.scarDispBias,
    );
    if (this.globe.visible) {
      this.resetGlobeShellPositions();
      this.warpGlobeMeshToScarField(map);
    }
  }

  /**
   * Scar + heat fields → stipple shader uniforms + CPU-warped coast/border lines.
   * Does not add meshes; updates existing shells. See painScarField.ts, painHeatField.ts.
   */
  private syncScarVisualization(): void {
    if (this.shouldSuppressScarsForChoropleth()) return;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    const mat = this.globe.material as THREE.MeshStandardMaterial;

    if (this.pointsStipple && !this.stippleBasePositions) {
      this.captureStippleBasePositions();
    }

    if (scars && this.scarDisplacementMap && this.painHeatMap) {
      const map = this.scarDisplacementMap;
      map.needsUpdate = true;
      this.painHeatMap.needsUpdate = true;

      mat.displacementMap = null;
      mat.displacementScale = 0;
      mat.displacementBias = 0;
      mat.polygonOffset = false;
      mat.polygonOffsetFactor = 0;
      mat.polygonOffsetUnits = 0;

      if (this.globe.visible) {
        this.resetGlobeShellPositions();
        this.warpGlobeMeshToScarField(map);
      }

      this.resetStippleShellPositions();

      this.bordersOutlines?.setScarDisplacementMap(
        map,
        this.debugTune.scarDispScale,
        this.debugTune.scarDispBias,
      );
    } else {
      mat.displacementMap = null;
      mat.displacementScale = 0;
      mat.displacementBias = 0;
      mat.polygonOffset = false;
      mat.polygonOffsetFactor = 0;
      mat.polygonOffsetUnits = 0;
      this.resetGlobeShellPositions();
      this.bordersOutlines?.setScarDisplacementMap(null, 0, 0);
      this.resetStippleShellPositions();
    }

    mat.needsUpdate = true;
    this.applyGlobeScarShellMaterial();
    this.applyStippleScarUniforms();
    this.applyStippleHeatUniforms();
    this.applyDebugLayerVisibility();

    if (isDebugScarVisual() && DEBUG_SCAR_VISUAL.logScarSync) {
      const u = this.pointsMaterial?.uniforms;
      console.info("[scar debug] sync", {
        mode: this.painVizMode,
        displayMode: this.displayMode,
        hasScarMap: Boolean(this.scarDisplacementMap),
        globeVisible: this.globe.visible,
        stippleVisible: this.pointsStipple?.visible ?? false,
        bordersLoaded: Boolean(this.bordersOutlines),
        painPoints: this.lastPainPoints.length,
        globeCpuWarp: scars && Boolean(this.scarDisplacementMap),
        scarScale: this.debugTune.scarDispScale,
        scarBias: this.debugTune.scarDispBias,
      });
    }
  }

  private applyDebugGlobeMaterial(): void {
    const mat = this.globe.material;
    if (!isDebugScarVisual()) {
      mat.transparent = false;
      mat.opacity = 1;
      return;
    }
    mat.color.setHex(DEBUG_SCAR_VISUAL.globeMeshColor);
    mat.transparent = true;
    mat.opacity = DEBUG_SCAR_VISUAL.globeMeshOpacity;
    mat.needsUpdate = true;
  }

  /** Debug HUD: live preview of the in-memory scar height map (not a file on disk). */
  setScarMapPreviewCanvas(canvas: HTMLCanvasElement | null): void {
    this.scarMapPreviewCanvas = canvas;
    if (canvas && this.scarDisplacementMap) {
      drawScarMapPreview(canvas, this.scarDisplacementMap);
    }
  }

  private updateScarMapPreview(): void {
    if (
      !isDebugScarVisual() ||
      !this.scarMapPreviewCanvas ||
      !this.scarDisplacementMap
    ) {
      return;
    }
    drawScarMapPreview(this.scarMapPreviewCanvas, this.scarDisplacementMap);
  }

  /** Rebuild CPU heat texture from {@link lastPainPoints} and current {@link heatTune} peak curve. */
  private rebuildPainHeatMap(): void {
    if (this.painHeatMap) {
      this.painHeatMap.dispose();
      this.painHeatMap = null;
    }
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    if (scars && this.lastPainPoints.length > 0) {
      this.painHeatMap = createPainHeatTexture(this.lastPainPoints, {
        peakPower: this.heatTune.peakPower,
        peakFloor: this.heatTune.peakFloor,
      });
    }
    this.applyStippleHeatUniforms();
  }

  /** Build scar height map off the hot path (full layers are ~20k rows). */
  private scheduleScarFieldRebuild(): void {
    const generation = ++this.scarBuildGeneration;

    if (this.scarDisplacementMap) {
      this.scarDisplacementMap.dispose();
      this.scarDisplacementMap = null;
    }

    if (this.shouldSuppressScarsForChoropleth()) {
      return;
    }

    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    if (!scars) {
      const mat = this.globe.material as THREE.MeshStandardMaterial;
      mat.emissiveMap = null;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 1;
      this.rebuildPainHeatMap();
      void this.ensureStipple().then(() => this.syncScarVisualization());
      return;
    }

    const scarLayerId = this.showAllLayersMode
      ? this.allLayersPhyspainLayerId
      : this.currentLayerId;
    const points = this.showAllLayersMode
      ? this.pointsForUiLayer(this.allLayersPhyspainLayerId)
      : this.lastPainPoints;
    window.setTimeout(() => {
      if (generation !== this.scarBuildGeneration) return;
      this.scarDisplacementMap = createPainScarDisplacementTexture(
        points,
        scarLayerId,
        {
          stampRadiusMin: this.debugTune.scarStampRadiusMin,
          stampRadiusMul: this.debugTune.scarStampRadiusMul,
          stampPeakMul: this.debugTune.scarStampPeakMul,
          falloffSigma: this.debugTune.scarFalloffSigma,
          blurPass1Radius: this.debugTune.scarBlurPass1Radius,
          blurPass2Radius: this.debugTune.scarBlurPass2Radius,
        },
      );
      this.rebuildPainHeatMap();
      this.updateScarMapPreview();
      void this.ensureStipple().then(() => {
        if (generation !== this.scarBuildGeneration) return;
        this.syncScarVisualization();
      });
      if (this.pointsStipple && this.pointsMaterial) {
        this.syncScarVisualization();
      }
    }, 0);
  }

  /** Creates SHELL stipple if missing (earthStippleGlobe.ts) and parents it to earthContent. */
  private ensureStipple(): Promise<void> {
    if (
      this.pointsStipple &&
      this.stippleLandMaskUrl === STIPPLE_LAND_MASK_GEOJSON_URL
    ) {
      if (!this.stippleBasePositions) {
        this.captureStippleBasePositions();
      }
      return Promise.resolve();
    }
    if (this.pointsStipple) {
      this.disposeStipple();
    }
    if (!this.stipplePromise) {
      const tint = new THREE.Vector3().fromArray(
        this.getActiveLayerColorLinear(),
      );
      this.stipplePromise = createEarthStippleGlobe(
        RADIUS,
        82_000,
        STIPPLE_LAND_MASK_GEOJSON_URL,
        tint,
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(0.82, 0.9, 1.0),
        0.16,
        this.renderer.getPixelRatio(),
      )
        .then(({ points, material, dispose, neutralScarTexture, neutralHeatTexture }) => {
          this.pointsStipple = points;
          this.pointsMaterial = material;
          this.stippleCleanup = dispose;
          this.stippleLandMaskUrl = STIPPLE_LAND_MASK_GEOJSON_URL;
          this.stippleNeutralScarTexture = neutralScarTexture;
          this.stippleNeutralHeatTexture = neutralHeatTexture;
          this.syncStippleVisibility();
          // SHELL stipple — lives on earthContent so it spins with the globe
          this.pointsStipple.renderOrder = 2;
          this.earthContent.add(this.pointsStipple);
          const mClip = material as unknown as MaterialWithClipping;
          mClip.clipping = false;
          mClip.clippingPlanes = [];
          this.applyPointsTint();
          this.applyHemisphereClipping();
          this.captureStippleBasePositions();
          this.syncScarVisualization();
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
    const u = this.pointsMaterial.uniforms;
    if (isDebugScarVisual()) {
      const [lr, lg, lb] = DEBUG_SCAR_VISUAL.stippleLandRgb;
      const [or, og, ob] = DEBUG_SCAR_VISUAL.stippleOceanRgb;
      const [tr, tg, tb] = DEBUG_SCAR_VISUAL.stippleTintRgb;
      u.uTint.value.set(tr, tg, tb);
      u.uShadeBase.value.set(or, og, ob);
      u.uLandTint.value.set(lr, lg, lb);
      u.uLandTintStrength.value = 1;
      u.uOceanAlphaBoost.value = DEBUG_SCAR_VISUAL.stippleOceanAlphaBoost;
      u.uOceanPointScale.value = DEBUG_SCAR_VISUAL.stippleOceanPointScale;
      this.applyStippleHeatUniforms();
      return;
    }
    u.uOceanPointScale.value = 1;
    const rgb = this.getActiveLayerColorLinear();
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
    this.applyStippleTuneUniforms();
    this.applyStippleHeatUniforms();
    this.syncStippleBackdropClearColor();
  }

  private applyStippleScarUniforms(): void {
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    const scarOn = this.resolveDebugLayerVisibility(
      "scarDisplacement",
      scars && Boolean(this.scarDisplacementMap),
    );
    const scale = scarOn ? this.debugTune.scarDispScale : 0;
    const bias = scarOn ? this.debugTune.scarDispBias : 0;
    const active = scarOn ? 1 : 0;

    if (!this.pointsMaterial) return;
    const u = this.pointsMaterial.uniforms;
    u.uScarDispScale.value = scale;
    u.uScarDispBias.value = bias;
    u.uScarActive.value = active;
    if (scarOn && this.scarDisplacementMap) {
      u.uScarMap.value = this.scarDisplacementMap;
    } else if (this.stippleNeutralScarTexture) {
      u.uScarMap.value = this.stippleNeutralScarTexture;
    }
  }

  private applyStippleHeatUniforms(): void {
    if (!this.pointsMaterial) return;
    const u = this.pointsMaterial.uniforms;
    const scars =
      this.painVizMode === PAIN_VIZ_MODE.scars || this.painVizMode === PAIN_VIZ_MODE.multiplexV0;
    const heatOn = this.resolveDebugLayerVisibility(
      "heatOverlay",
      scars && Boolean(this.painHeatMap),
    );
    u.uHeatActive.value = heatOn ? 1 : 0;
    u.uHeatStrength.value = this.heatTune.heatStrength;
    if (heatOn && this.painHeatMap) {
      this.painHeatMap.needsUpdate = true;
      u.uHeatMap.value = this.painHeatMap;
    } else if (this.stippleNeutralHeatTexture) {
      u.uHeatMap.value = this.stippleNeutralHeatTexture;
    }

    u.uHeatCool.value.set(0.04, 0.07, 0.18);
    const [heatR, heatG, heatB] = this.getActiveLayerColorLinear();
    u.uHeatHot.value.set(heatR, heatG, heatB); // hot end — active layer color
  }

  /** SHELL coast + borders — loads GeoJSON, adds `bordersOutlines.group` to scene. */
  private async loadCountryOutlines(): Promise<void> {
    try {
      const w = this.renderer.domElement.clientWidth || window.innerWidth;
      const h = this.renderer.domElement.clientHeight || window.innerHeight;
      const resolution = new THREE.Vector2(w, h);
      this.bordersOutlines = await loadGlobeBorderOutlines(
        BORDERS_BASE,
        RADIUS,
        resolution,
      );
      this.bordersOutlines.syncAppearance(this.visualTheme);
      this.bordersOutlines.setClippingPlanes(this.clipPlanesFront);
      this.syncScarVisualization();
      this.scene.remove(this.markersGroup);
      // Coast + country border lines (countryBorders.ts); scar-warped in syncScarVisualization
      this.syncBorderOutlinesRenderOrder();
      this.applyBorderShellScale();
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

  // --- Theme, layer tint, and pain data from main.ts ---

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
    this.updateLayerVisuals(this.currentLayerId, this.currentLayerMeta);
    this.applyGlobeScarShellMaterial();
    this.syncScarVisualization();
  }

  private getActiveLayerColorLinear(): [number, number, number] {
    return getLayerBaseColorLinear(this.currentLayerColorHex, this.visualTheme);
  }

  private applyScenePalette(theme: VisualTheme): void {
    if (isDebugScarVisual()) {
      this.scene.background = new THREE.Color(DEBUG_SCAR_VISUAL.sceneBackground);
      this.renderer.setClearColor(DEBUG_SCAR_VISUAL.sceneBackground, 1);
      this.renderer.toneMappingExposure = 1;
      this.ambLight.color.setHex(0xffffff);
      this.ambLight.intensity = 0.85;
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 1.1;
      this.fillLight.color.setHex(0xffffff);
      this.fillLight.intensity = 0.45;
      this.glow.material.uniforms.uGlowColor.value.setHex(0x4488ff);
      this.glow.material.uniforms.uGlowIntensity.value = 0.08;
      this.applyDebugGlobeMaterial();
      this.syncBorderAppearance();
      this.applyPointsTint();
      return;
    }

    this.renderer.setClearColor(0x000000, 0);
    if (theme === "blue") {
      this.scene.background = null;
      this.renderer.toneMappingExposure = 1.12;
      this.ambLight.color.setHex(0xd1f7ff);
      this.ambLight.intensity = 0.44;
      this.keyLight.color.setHex(0xd1f7ff);
      this.keyLight.intensity = 1.12;
      this.fillLight.color.setHex(0x3b69cc);
      this.fillLight.intensity = 0.42;
      this.applyGlobeShellColor();
      this.glow.material.uniforms.uGlowColor.value.setHex(0x05e2c2);
    } else {
      this.scene.background = null;
      this.renderer.toneMappingExposure = 1.05;
      this.ambLight.color.setHex(0xffffff);
      this.ambLight.intensity = 0.35;
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 1.25;
      this.fillLight.color.setHex(0xb8c4ff);
      this.fillLight.intensity = 0.35;
      this.applyGlobeShellColor();
      this.glow.material.uniforms.uGlowColor.value.setHex(0x7da8ff);
    }
    this.syncBorderAppearance();
    this.applyMultiplexTheme();
    this.applyStippleTuneUniforms();
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.painVizMode = PAIN_VIZ_MODE.points;
    this.lastPainPoints = [];
    this.rebuildPainGeometryAndTexture();
    this.disposeStipple();
    if (this.bordersOutlines) {
      this.scene.remove(this.bordersOutlines.group);
      this.bordersOutlines.dispose();
      this.bordersOutlines = null;
    }
    this.controls.dispose();
    this.renderer.dispose();
    this.globe.geometry.dispose();
    this.globe.material.dispose();
    if (this.choroplethMap) {
      this.choroplethMap.dispose();
      this.choroplethMap = null;
    }
    this.choroplethShell.geometry.dispose();
    this.choroplethShell.material.dispose();
    if (this.co2HazeMap) {
      this.co2HazeMap.dispose();
      this.co2HazeMap = null;
    }
    this.co2Haze.geometry.dispose();
    this.co2Haze.material.dispose();
    if (this.temperatureShellMap) {
      this.temperatureShellMap.dispose();
      this.temperatureShellMap = null;
    }
    this.temperatureShell.geometry.dispose();
    this.temperatureShell.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.markerGeometry.dispose();
    this.disposePainMarkersInstanced();
    if (this.markerMaterial) {
      this.markerMaterial.dispose();
      this.markerMaterial = null;
    }
    this.clearWordCloud();
    this.disposeMultiplexObjects();
    this.choroplethBuildGeneration++;
    this.disposeChoroplethMap();
    for (const t of this.textureCache.values()) t.dispose();
    this.textureCache.clear();
  }

  /**
   * Select active layer and refresh layer-driven visuals.
   *
   * Stores layer id and display metadata (color, text, geospatial, lexicon bucket), caches a
   * procedural layer canvas texture, then reapplies globe shell tint, stipple tint,
   * scar shell material, marker colors, and the word cloud. Country choropleth layers
   * (`geospatial: false` && `text: false`) get an equirect fill instead of scars/markers.
   *
   * @param meta — display fields from main.ts (`applyGlobeLayer`: color, text, geospatial, lexicon bucket).
   */
  updateLayerVisuals(
    layerId: string,
    meta?: GlobeLayerDisplayMeta,
  ): void {
    this.currentLayerId = layerId;
    if (arguments.length >= 2) {
      this.currentLayerMeta = meta;
    }
    this.currentLayerSupportsText = this.currentLayerMeta?.text === true;
    this.currentLayerColorHex = this.currentLayerMeta?.color ?? null;
    this.currentLayerLexiconBucket =
      this.currentLayerMeta?.lexiconBucket ?? "generic";
    if (this.currentLayerColorHex == null && layerId.length > 0) {
      console.warn(
        "[GlobeView] Layer metadata missing or has no color — using neutral fallback.",
        layerId,
      );
    }
    const cacheKey = `${layerId}:${this.currentLayerColorHex ?? "default"}:${this.visualTheme}`;
    let tex = this.textureCache.get(cacheKey);
    if (!tex) {
      tex = createLayerCanvasTexture(
        this.currentLayerColorHex,
        this.visualTheme,
        layerId,
      );
      this.textureCache.set(cacheKey, tex);
    }
    if (this.shouldPaintChoropleth() && !this.showAllLayersMode) {
      // Texture built in rebuildPainGeometryAndTexture (choropleth path).
      // Keep solid globe at GLOBE_SHELL_COLOR — never the layer yellow/etc.
      this.applyGlobeShellColor();
    } else if (!this.showAllLayersMode) {
      this.disposeChoroplethMap();
      // Solid shell (GLOBE_SHELL_COLOR); layer canvas stays cached but is not mapped onto the mesh.
      this.applyGlobeShellColor();
    } else {
      this.applyGlobeShellColor();
    }
    const m = this.globe.material as THREE.MeshStandardMaterial;
    m.roughness = 0.78;
    m.metalness = 0.06;
    m.needsUpdate = true;
    this.applyPointsTint();
    this.applyGlobeScarShellMaterial();
    this.updateMarkerInstanceColors(this.lastPainPoints);
    this.refreshWordCloud();
    this.rebuildPainGeometryAndTexture();
  }

  /** Entry from main.ts after fetchPoints — drives markers, scars, multiplex, word cloud. */
  setMarkers(points: PainPoint[]): void {
    this.lastPainPoints = points;
    this.rebuildPainGeometryAndTexture();
    this.refreshWordCloud();
  }

  /**
   * Concurrent phys scars + socio choropleth + env CO2 haze + emo word clouds.
   * Call before {@link setMarkers} with concatenated per-layer fetches.
   */
  setShowAllLayersMode(
    enabled: boolean,
    opts?: {
      physpainLayerId: string;
      choroplethLayerId: string;
      choroplethColorHex: string | null;
      emopainLayerId: string;
      lexiconBucket: string;
    },
  ): void {
    this.showAllLayersMode = enabled;
    if (enabled && opts) {
      this.allLayersPhyspainLayerId = opts.physpainLayerId;
      this.allLayersChoroplethLayerId = opts.choroplethLayerId;
      this.allLayersChoroplethColorHex = opts.choroplethColorHex;
      this.allLayersEmopainLayerId = opts.emopainLayerId;
      this.currentLayerLexiconBucket = opts.lexiconBucket;
      this.currentLayerSupportsText = true;
    } else if (!enabled) {
      this.allLayersChoroplethColorHex = null;
    }
  }

  setWordCloudEnabled(enabled: boolean): void {
    this.wordCloudEnabled = enabled;
    this.refreshWordCloud();
  }

  /**
   * Quick capability probe: InstancedMesh.setColorAt + instanceColor with MeshStandardMaterial (Three r170).
   * When unavailable, markers use uniform layer emissive (no per-instance tint); intensity-based color
   * variation is lost on that path, but intensity-based radius (instance matrices) still applies.
   */
  private static probeMarkerInstanceColorSupport(): boolean {
    const supported =
      typeof THREE.InstancedMesh.prototype.setColorAt === "function";
    if (!supported) {
      console.warn(
        "[GlobeView] InstancedMesh.setColorAt unavailable — uniform layer emissive only (no per-instance tint); intensity-based radius unchanged.",
      );
    }
    return supported;
  }

  private createMarkerMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: this.markerTune.roughness,
      metalness: this.markerTune.metalness,
      opacity: this.markerTune.opacity,
      transparent: this.markerTune.opacity < 1,
    });
    const mClip = mat as unknown as MaterialWithClipping;
    mClip.clipping = true;
    mClip.clipIntersection = false;
    mClip.clippingPlanes = this.clipPlanesFront;
    return mat;
  }

  /** Live marker material from {@link markerTune} (roughness, metalness, opacity). */
  private applyMarkerMaterialTune(): void {
    if (!this.markerMaterial) return;
    this.markerMaterial.roughness = this.markerTune.roughness;
    this.markerMaterial.metalness = this.markerTune.metalness;
    this.markerMaterial.opacity = this.markerTune.opacity;
    this.markerMaterial.transparent = this.markerTune.opacity < 1;
    this.markerMaterial.needsUpdate = true;
  }

  /** Clamped {@link markerTune.emissiveBase} — floor ensures low-intensity markers stay visible. */
  private markerEmissiveBaseEffective(): number {
    return Math.max(MARKER_EMISSIVE_BASE_MIN, this.markerTune.emissiveBase);
  }

  /** Per-instance emissive multiplier from stored intensity (colors only; no matrix rebuild). */
  private markerEmissiveScale(intensity: number): number {
    // Clamp for visualization only — stored intensity is never modified, only the local rendering value is clamped here.
    const clampedIntensity = Math.min(Math.max(0, intensity), 1);
    return (
      this.markerEmissiveBaseEffective() +
      MARKER_EMISSIVE_INTENSITY_SCALE * clampedIntensity
    );
  }

  /** Instance matrix scale from base tune radius × intensity (baked per point in rebuild). */
  private markerInstanceScaleForPoint(intensity: number): number {
    // Clamp for visualization only — stored intensity is never modified, only the local rendering value is clamped here.
    const clampedIntensity = Math.min(Math.max(0, intensity), 1);
    const worldRadius =
      this.markerTune.radius *
      (MARKER_RADIUS_INTENSITY_MIN +
        MARKER_RADIUS_INTENSITY_SPAN * clampedIntensity);
    return worldRadius / MARKER_BASE_RADIUS;
  }

  private disposePainMarkersInstanced(): void {
    if (!this.painMarkersInstanced) return;
    this.painMarkersInstanced.dispose();
    (
      this.painMarkersInstanced.instanceMatrix as unknown as {
        dispose?: () => void;
      }
    ).dispose?.();
    (
      this.painMarkersInstanced.instanceColor as unknown as {
        dispose?: () => void;
      }
    )?.dispose?.();
    this.markersGroup.remove(this.painMarkersInstanced);
    this.painMarkersInstanced = null;
    this.markerInstanceCapacity = 0;
  }

  private ensurePainMarkersInstanced(requiredCount: number): THREE.InstancedMesh {
    if (
      this.painMarkersInstanced &&
      this.markerInstanceCapacity >= requiredCount
    ) {
      return this.painMarkersInstanced;
    }
    this.disposePainMarkersInstanced();
    const capacity = Math.max(
      requiredCount,
      this.markerInstanceCapacity > 0
        ? Math.ceil(this.markerInstanceCapacity * MARKER_INSTANCE_CAPACITY_GROWTH)
        : MARKER_INSTANCE_INITIAL_CAPACITY,
    );
    if (!this.markerMaterial) {
      this.markerMaterial = this.createMarkerMaterial();
    }
    const mesh = new THREE.InstancedMesh(
      this.markerGeometry,
      this.markerMaterial,
      capacity,
    );
    mesh.frustumCulled = false;
    if (this.markerUseInstanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 3),
        3,
      );
    }
    this.markersGroup.add(mesh);
    this.painMarkersInstanced = mesh;
    this.markerInstanceCapacity = capacity;
    return mesh;
  }

  private logMarkerRebuildMeasure(pointCount: number): void {
    performance.mark("pain-markers-rebuild-end");
    performance.measure(
      "pain-markers-rebuild",
      "pain-markers-rebuild-start",
      "pain-markers-rebuild-end",
    );
    const entries = performance.getEntriesByName("pain-markers-rebuild");
    const last = entries[entries.length - 1];
    if (last) {
      console.info(
        `[GlobeView perf] pain-markers-rebuild: ${last.duration.toFixed(2)} ms (${pointCount} points)`,
      );
    }
    performance.clearMeasures("pain-markers-rebuild");
    performance.clearMarks("pain-markers-rebuild-start");
    performance.clearMarks("pain-markers-rebuild-end");
  }

  /** Per-instance tint from layer color × emissive scale; does not touch instance matrices. */
  private updateMarkerInstanceColors(points: PainPoint[]): void {
    const mesh = this.painMarkersInstanced;
    if (!mesh || points.length === 0) return;

    const base = this.markerColorForActiveLayer();
    const effectiveBase = this.markerEmissiveBaseEffective();
    if (this.markerMaterial) {
      this.markerMaterial.color.set(MARKER_COLOR_WHITE);
      this.markerMaterial.emissive.copy(base);
      this.markerMaterial.emissiveIntensity = effectiveBase;
      this.markerMaterial.needsUpdate = true;
    }

    if (!this.markerUseInstanceColor || !mesh.instanceColor) {
      console.warn(
        "[GlobeView] Skipping per-instance marker tint — uniform layer emissive only (no per-instance tint); intensity-based radius unchanged.",
      );
      return;
    }

    for (let i = 0; i < points.length; i++) {
      const scale = this.markerEmissiveScale(points[i]!.intensity);
      this.markerTempColor.copy(base).multiplyScalar(scale);
      mesh.setColorAt(i, this.markerTempColor);
    }
    mesh.instanceColor.needsUpdate = true;
  }

  /** Rebuild marker instance matrices when point data changes (setMarkers / viz mode). */
  private rebuildMarkerInstanceMatrices(points: PainPoint[]): void {
    performance.mark("pain-markers-rebuild-start");

    if (points.length === 0) {
      if (this.painMarkersInstanced) {
        this.painMarkersInstanced.count = 0;
      }
      this.logMarkerRebuildMeasure(0);
      return;
    }

    const mesh = this.ensurePainMarkersInstanced(points.length);
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const scale = this.markerInstanceScaleForPoint(p.intensity);
      this.markerTempScale.set(scale, scale, scale);
      this.markerTempPosition.copy(latLngToVector3(p.lat, p.lng, RADIUS));
      this.markerTempMatrix.compose(
        this.markerTempPosition,
        this.markerTempQuaternion,
        this.markerTempScale,
      );
      mesh.setMatrixAt(i, this.markerTempMatrix);
    }
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    this.updateMarkerInstanceColors(points);
    this.logMarkerRebuildMeasure(points.length);
  }

  /**
   * Point markers are off in production (layers use scars, shells, word clouds, choropleth).
   * Rebuild only when the debug panel enables {@link markersDebugEnabled} and viz mode is points.
   */
  private syncPainMarkersForVizMode(): void {
    if (this.painVizMode === PAIN_VIZ_MODE.points && this.markersDebugEnabled) {
      this.rebuildMarkerInstanceMatrices(this.lastPainPoints);
    } else {
      this.disposePainMarkersInstanced();
    }
  }

  /**
   * Rebuild markers, multiplex graph, scar/heat fields, choropleth shell, and CO2 /
   * Temperature haze from `lastPainPoints` (called after `setMarkers`, viz-mode changes,
   * and layer updates).
   * Single-layer choropleth skips scars/markers and paints the country-fill shell only.
   * Show-all mode runs scars + choropleth + haze + word clouds together.
   */
  private rebuildPainGeometryAndTexture(): void {
    if (this.shouldSuppressScarsForChoropleth()) {
      this.disposePainMarkersInstanced();
      this.disposeMultiplexObjects();
      // Invalidate any in-flight scar rebuild so it cannot re-apply scars over choropleth.
      this.scarBuildGeneration++;
      if (this.scarDisplacementMap) {
        this.scarDisplacementMap.dispose();
        this.scarDisplacementMap = null;
      }
      if (this.painHeatMap) {
        this.painHeatMap.dispose();
        this.painHeatMap = null;
      }
      this.bordersOutlines?.setScarDisplacementMap(null, 0, 0);
      this.resetGlobeShellPositions();
      this.resetStippleShellPositions();
      this.scheduleChoroplethRebuild();
      this.syncGlobeSurfaceVisibility();
      this.refreshWordCloud();
      return;
    }

    if (!this.showAllLayersMode) {
      this.disposeChoroplethMap();
    }

    if (
      this.painVizMode === PAIN_VIZ_MODE.scars ||
      this.painVizMode === PAIN_VIZ_MODE.multiplexV0
    ) {
      void this.ensureStipple();
    }

    this.syncPainMarkersForVizMode();

    this.applyDebugLayerVisibility();
    if (this.painVizMode === PAIN_VIZ_MODE.multiplexV0) {
      this.rebuildMultiplexVisualization(this.lastPainPoints);
    } else {
      this.disposeMultiplexObjects();
    }

    this.scheduleScarFieldRebuild();
    if (this.showAllLayersMode) {
      this.scheduleChoroplethRebuild();
    }
    this.rebuildPainHeatMap();
    this.rebuildTemperatureShellMap();
    this.rebuildCo2HazeMap();
    this.syncGlobeSurfaceVisibility();
    this.refreshWordCloud();
  }

  /**
   * Stamp Temperature-only points into the red haze shell map; hide when none remain.
   * Triggered with scar/heat rebuilds from {@link rebuildPainGeometryAndTexture} / `setMarkers`.
   */
  private rebuildTemperatureShellMap(): void {
    if (this.temperatureShellMap) {
      this.temperatureShellMap.dispose();
      this.temperatureShellMap = null;
    }
    const temperaturePoints = filterTemperatureHazePoints(this.lastPainPoints);
    const mat = this.temperatureShell.material;
    if (temperaturePoints.length === 0) {
      mat.map = null;
      mat.needsUpdate = true;
      this.temperatureShell.visible = false;
      return;
    }
    this.temperatureShellMap = createTemperatureHazeTexture(temperaturePoints, {
      stampRadiusBase: this.tempHeatTune.stampRadiusBase,
      stampRadiusSpan: this.tempHeatTune.stampRadiusSpan,
      blurPass1Radius: this.tempHeatTune.blurPass1Radius,
      blurPass2Radius: this.tempHeatTune.blurPass2Radius,
      maxAlpha: TEMPERATURE_HAZE_TUNE_DEFAULTS.maxAlpha,
      alphaThreshold: TEMPERATURE_HAZE_TUNE_DEFAULTS.alphaThreshold,
    });
    mat.map = this.temperatureShellMap;
    mat.needsUpdate = true;
    this.temperatureShell.visible = true;
  }

  /**
   * Stamp CO2-only points into the haze shell map; hide the mesh when none remain.
   * Triggered with scar/heat rebuilds from {@link rebuildPainGeometryAndTexture} / `setMarkers`.
   */
  private rebuildCo2HazeMap(): void {
    if (this.co2HazeMap) {
      this.co2HazeMap.dispose();
      this.co2HazeMap = null;
    }
    const co2Points = filterCo2HazePoints(this.lastPainPoints);
    const mat = this.co2Haze.material;
    if (co2Points.length === 0) {
      mat.map = null;
      mat.needsUpdate = true;
      this.co2Haze.visible = false;
      return;
    }
    this.co2HazeMap = createCo2HazeTexture(co2Points, this.co2HazeTune);
    mat.map = this.co2HazeMap;
    mat.needsUpdate = true;
    this.co2Haze.visible = true;
  }

  /**
   * Pause or resume ambient globe spin around the Y axis.
   * Used to freeze the globe during the post-submit fly-to animation.
   */
  setAutoSpinEnabled(enabled: boolean): void {
    this.autoSpinEnabled = enabled;
  }

  /** Circle geometry radius for post-submit surface marker. */
  private static readonly SURFACE_MARKER_RADIUS = 0.035;
  /** Circle geometry segment count for post-submit surface marker. */
  private static readonly SURFACE_MARKER_SEGMENTS = 32;
  /** Matches survey result panel color (#abacc0). */
  private static readonly SURFACE_MARKER_COLOR = 0xabacc0;
  private static readonly SURFACE_MARKER_EMISSIVE_INTENSITY = 0.3;
  private static readonly SURFACE_MARKER_OPACITY = 0.25;
  /** Offset above globe surface (RADIUS = 1). */
  private static readonly SURFACE_MARKER_OFFSET = 0.02;
  /** Expanding ring outer radius at full scale. */
  private static readonly SURFACE_MARKER_RING_MAX_RADIUS = 0.06;
  private static readonly SURFACE_MARKER_RING_CYCLE_SEC = 2;
  private static readonly SURFACE_MARKER_RING_OPACITY = 0.4;
  private static readonly SURFACE_MARKER_RING_COLOR = 0x7eb8d4;

  /** Semi-transparent disc on the globe at lat/lng; returns cleanup. */
  addSurfaceMarker(lat: number, lng: number): () => void {
    const geometry = new THREE.CircleGeometry(
      GlobeView.SURFACE_MARKER_RADIUS,
      GlobeView.SURFACE_MARKER_SEGMENTS,
    );
    const material = new THREE.MeshStandardMaterial({
      color: GlobeView.SURFACE_MARKER_COLOR,
      emissive: GlobeView.SURFACE_MARKER_COLOR,
      emissiveIntensity: GlobeView.SURFACE_MARKER_EMISSIVE_INTENSITY,
      transparent: true,
      opacity: GlobeView.SURFACE_MARKER_OPACITY,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const ringGeometry = new THREE.RingGeometry(
      0,
      GlobeView.SURFACE_MARKER_RING_MAX_RADIUS,
      GlobeView.SURFACE_MARKER_SEGMENTS,
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: GlobeView.SURFACE_MARKER_RING_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    const position = latLngToVector3(
      lat,
      lng,
      RADIUS + GlobeView.SURFACE_MARKER_OFFSET,
    );
    const outward = position.clone().normalize();
    // World Y rotation — frozen globeSpinY at marker placement
    const globeRotation = new THREE.Euler(0, this.globeSpinY, 0);
    position.applyEuler(globeRotation);
    outward.applyEuler(globeRotation);
    mesh.position.copy(position);
    ringMesh.position.copy(position);
    // CircleGeometry default normal is +Z (face outward from sphere center)
    const surfaceQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      outward,
    );
    mesh.quaternion.copy(surfaceQuat);
    ringMesh.quaternion.copy(surfaceQuat);
    const ringEntry = { mesh: ringMesh, elapsed: 0 };
    this.surfaceMarkerRings.push(ringEntry);
    this.scene.add(mesh, ringMesh);
    return () => {
      this.scene.remove(mesh, ringMesh);
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      const idx = this.surfaceMarkerRings.indexOf(ringEntry);
      if (idx >= 0) this.surfaceMarkerRings.splice(idx, 1);
    };
  }

  private tickSurfaceMarkerRings(dt: number): void {
    const cycle = GlobeView.SURFACE_MARKER_RING_CYCLE_SEC;
    const maxOpacity = GlobeView.SURFACE_MARKER_RING_OPACITY;
    for (const ring of this.surfaceMarkerRings) {
      ring.elapsed += dt;
      const progress = Math.min(1, (ring.elapsed % cycle) / cycle);
      const scale = Math.max(0.01, progress);
      ring.mesh.scale.setScalar(scale);
      ring.mesh.material.opacity =
        maxOpacity * Math.sin(Math.PI * progress);
    }
  }

  /** Per-frame update: spin, controls, hemisphere clip, multiplex / word-cloud animation. */
  tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.autoSpinEnabled) {
      this.globeSpinY -= GLOBE_AUTO_SPIN_RAD_PER_SEC * dt;
    }
    this.syncWorldRotation();
    if (this.temperatureShell.visible) {
      (this.temperatureShell.material as THREE.MeshBasicMaterial).opacity =
        (0.85 + 0.15 * Math.sin(this.clock.elapsedTime * 0.3)) *
        this.tempHeatTune.heatStrength;
    }
    if (this.co2Haze.visible) {
      (this.co2Haze.material as THREE.MeshBasicMaterial).opacity =
        0.85 + 0.15 * Math.sin(this.clock.elapsedTime * 0.3);
    }
    this.controls.update();
    this.tickMultiplex(dt);
    this.tickWordCloud();
    this.tickSurfaceMarkerRings(dt);
    const cp = this.camera.position;
    if (cp.lengthSq() > 1e-10) {
      this.hemisphereClipPlane.normal.copy(cp).normalize();
    } else {
      this.hemisphereClipPlane.normal.set(0, 0, 1);
    }
    this.hemisphereClipPlane.constant = this.debugTune.hemisphereClipBias;
    this.applyHemisphereClipping();
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
    this.textLayerGroup.rotation.y = this.globeSpinY;
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
    const textOk =
      this.wordCloudEnabled &&
      (this.showAllLayersMode || this.currentLayerSupportsText);
    if (!textOk) return;
    const sourcePoints = this.showAllLayersMode
      ? this.pointsForUiLayer(this.allLayersEmopainLayerId)
      : this.lastPainPoints;
    if (!sourcePoints.length) return;
    // One sprite per emo row (no sample cap).
    const n = sourcePoints.length;
    const linePositions = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const p = sourcePoints[i]!;
      const label = this.wordCloudLabelForPoint(p);
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
      this.textLayerGroup.add(sprite);
      const segmentOffset = i * 6;
      writeWordCloudSegment(linePositions, segmentOffset, dir, RADIUS, radius);
      this.wordCloudItems.push({
        dir,
        sprite,
        radius,
        baseScaleX: sprite.scale.x,
        baseScaleY: sprite.scale.y,
        segmentOffset,
      });
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3),
    );
    const lineMat = new THREE.LineBasicMaterial({
      color: WORD_CLOUD_LINE_COLOR,
      transparent: true,
      opacity: WORD_CLOUD_LINE_OPACITY,
      depthWrite: false,
    });
    const connectors = new THREE.LineSegments(lineGeom, lineMat);
    connectors.frustumCulled = false;
    connectors.raycast = () => {};
    this.textLayerGroup.add(connectors);
    this.wordCloudConnectors = connectors;
    this.applyDebugLayerVisibility();
  }

  private clearWordCloud(): void {
    if (this.wordCloudConnectors) {
      this.textLayerGroup.remove(this.wordCloudConnectors);
      this.wordCloudConnectors.geometry.dispose();
      this.wordCloudConnectors.material.dispose();
      this.wordCloudConnectors = null;
    }
    for (const item of this.wordCloudItems) {
      const mat = item.sprite.material;
      mat.map?.dispose();
      mat.dispose();
    }
    this.wordCloudItems = [];
    while (this.textLayerGroup.children.length) {
      this.textLayerGroup.remove(this.textLayerGroup.children[0]!);
    }
  }

  private wordCloudLabelForPoint(p: PainPoint): string {
    if (p.text) {
      const words = this.extractCloudWords(p.text);
      if (words[0]) return words[0];
    }
    const [word] = this.fallbackPainWords(p);
    return word ?? "text signal";
  }

  /**
   * Marker tint in points viz mode.
   *
   * Uses {@link currentLayerColorHex} (selected layer from updateLayerVisuals), not `p.uiLayer`:
   * (1) All visible points are fetched for the selected layer id.
   * (2) Multi-layer views will need per-point / per-uiLayer colors — revisit with deferred
   *     multiplex per-uiLayer tinting (`painTypeColor` multi-layer work).
   */
  private markerColorForActiveLayer(): THREE.Color {
    const [r, g, b] = this.getActiveLayerColorLinear();
    return new THREE.Color(r, g, b);
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

  /**
   * Procedural word-cloud labels when `extractCloudWords` finds nothing useful.
   *
   * Uses {@link currentLayerLexiconBucket} (from main.ts via updateLayerVisuals), not `p.uiLayer`:
   * (1) All visible points belong to the selected layer.
   * (2) Multi-layer views will need per-point buckets — revisit with deferred multiplex
   *     per-uiLayer tinting (`painTypeColor` multi-layer work).
   */
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
      socioeconomic: [
        "poverty",
        "inequality",
        "precarity",
        "debt",
        "inflation",
        "stress",
      ],
      generic: ["pain", "stress", "strain"],
    };
    const bag =
      lexicon[this.currentLayerLexiconBucket] ?? lexicon.generic ?? ["pain"];
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

  /** Per-frame animation update for text-layer word-cloud sprites (billboard toward camera). */
  private tickWordCloud(): void {
    if (!this.wordCloudEnabled) return;
    if (!this.showAllLayersMode && !this.currentLayerSupportsText) return;
    const camDir = this.camera.position.clone().normalize();
    const q = this.textLayerGroup.quaternion;
    const posAttr = this.wordCloudConnectors?.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute | undefined;
    const linePositions = posAttr
      ? (posAttr.array as Float32Array)
      : null;
    let linesDirty = false;
    for (const item of this.wordCloudItems) {
      const worldDir = item.dir.clone().applyQuaternion(q);
      const facing = worldDir.dot(camDir);
      item.sprite.visible = facing > WORD_CLOUD_FACING_MIN;
      if (linePositions) {
        if (!item.sprite.visible) {
          writeWordCloudSegment(linePositions, item.segmentOffset, item.dir, 0, 0);
        } else {
          writeWordCloudSegment(
            linePositions,
            item.segmentOffset,
            item.dir,
            RADIUS,
            item.radius,
          );
        }
        linesDirty = true;
      }
      if (!item.sprite.visible) continue;
      const scale = 0.92 + facing * 0.2;
      item.sprite.scale.set(item.baseScaleX * scale, item.baseScaleY * scale, 1);
    }
    if (linesDirty && posAttr) posAttr.needsUpdate = true;
  }

  pickWordCloudHover(clientX: number, clientY: number): WordCloudHoverInfo | null {
    if (!this.wordCloudEnabled) return null;
    if (!this.showAllLayersMode && !this.currentLayerSupportsText) return null;
    if (!this.wordCloudItems.length) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.textLayerGroup.children, false);
    for (const hit of hits) {
      const obj = hit.object;
      if (obj instanceof THREE.Sprite && obj.userData.wordCloudHover) {
        return obj.userData.wordCloudHover as WordCloudHoverInfo;
      }
    }
    return null;
  }

  /**
   * Raycast the pain-marker InstancedMesh (points viz only).
   * Debug UI calls this from `main.ts` when globe debug is opt-in.
   * `instanceId` indexes {@link lastPainPoints} (same order as matrix rebuild).
   */
  pickMarkerHover(clientX: number, clientY: number): MarkerHoverInfo | null {
    if (this.painVizMode !== PAIN_VIZ_MODE.points) return null;
    const mesh = this.painMarkersInstanced;
    if (!mesh || mesh.count === 0 || this.lastPainPoints.length === 0) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    // Canvas-normalized [0,1] → NDC [-1,1] for Three.js Raycaster (* 2 - 1 per axis).
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(mesh, false);
    for (const hit of hits) {
      if (hit.object !== mesh) continue;
      const instanceId = hit.instanceId;
      if (
        instanceId == null ||
        instanceId < 0 ||
        mesh.count <= instanceId ||
        this.lastPainPoints.length <= instanceId
      ) {
        continue;
      }
      const p = this.lastPainPoints[instanceId]!;
      return {
        layerId: p.uiLayer,
        intensity: p.intensity,
        lat: p.lat,
        lng: p.lng,
        category: p.category ?? "—",
      };
    }
    return null;
  }

  /**
   * Raycast the globe surface and return the nearest pain point within
   * {@link MAX_CLICK_SOUND_RADIUS_DEG} (all viz modes).
   *
   * @param clientX — pointer X in viewport CSS pixels.
   * @param clientY — pointer Y in viewport CSS pixels.
   * @returns {@link MarkerHoverInfo} for the nearest point, or `null` if no hit / too far / no data.
   */
  pickNearestPainPoint(clientX: number, clientY: number): MarkerHoverInfo | null {
    if (this.lastPainPoints.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    // Canvas-normalized [0,1] → NDC [-1,1] for Three.js Raycaster (* 2 - 1 per axis).
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.globe, false);
    const hit = hits[0];
    if (!hit) return null;

    const click = vector3ToLatLng(hit.point);
    let nearest: PainPoint | null = null;
    let nearestDeg = Infinity;
    for (const p of this.lastPainPoints) {
      const deg = greatCircleDistanceDeg(click.lat, click.lng, p.lat, p.lng);
      if (deg < nearestDeg) {
        nearestDeg = deg;
        nearest = p;
      }
    }
    if (!nearest || nearestDeg > MAX_CLICK_SOUND_RADIUS_DEG) return null;

    return {
      layerId: nearest.uiLayer,
      intensity: nearest.intensity,
      lat: nearest.lat,
      lng: nearest.lng,
      category: nearest.category ?? "—",
    };
  }

  /**
   * Sample scar dent strength at a pointer click on the globe sphere.
   *
   * @param clientX — pointer X in viewport CSS pixels.
   * @param clientY — pointer Y in viewport CSS pixels.
   * @returns 0 = no pain, 1 = maximum scar dent; `null` if no scar map or no ray hit.
   */
  sampleScarAtClick(clientX: number, clientY: number): number | null {
    if (!this.scarDisplacementMap) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    // Canvas-normalized [0,1] → NDC [-1,1] for Three.js Raycaster (* 2 - 1 per axis).
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.globe, false);
    const hit = hits[0];
    if (!hit) return null;

    const dir = hit.point.clone().normalize();
    const { u, v } = unitDirectionToGlobeEquirectUV(dir);
    const h = sampleScarHeight01(this.scarDisplacementMap, u, v);
    // Neutral scar height is ~0.5; dents go below 0.5, so intensity rises as h falls.
    return THREE.MathUtils.clamp((0.5 - h) * 2, 0, 1);
  }

  /** Multiplex node tint for the active layer (per-type colors deferred to step 4b). */
  private painTypeColor(_type: string): THREE.Color {
    const [r, g, b] = this.getActiveLayerColorLinear();
    return new THREE.Color(r, g, b);
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
      nodeType.push(p.uiLayer);
      const c = this.painTypeColor(p.uiLayer);
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
        type: p.uiLayer,
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
    if (this.painVizMode !== PAIN_VIZ_MODE.multiplexV0) return null;
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

  /** Per-frame animation update for multiplex nodes, links, and cluster beacons. */
  private tickMultiplex(dt: number): void {
    if (this.painVizMode !== PAIN_VIZ_MODE.multiplexV0) return;
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

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.bordersOutlines?.setResolution(w, h);
  };
}
