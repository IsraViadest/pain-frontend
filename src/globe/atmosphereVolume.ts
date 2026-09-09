/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
import * as THREE from "three";

const MAX_PIXELS = 1_048_576;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const VOLUME_INTEGRATION = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uDepth;
uniform sampler2D uTemperature;
uniform sampler2D uCo2;
uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;
uniform mat4 uInverseEarth;
uniform vec3 uTemperatureColor;
uniform vec3 uCo2Color;
uniform int uSamples;
uniform float uOpacityTier;
uniform float uSeparated;
uniform float uLogResponse;
uniform float uSurfaceRadius;

vec3 localPosition(vec2 uv, float depth) {
  vec4 view = uInverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return (uInverseEarth * uCameraWorld * vec4(view.xyz / view.w, 1.0)).xyz;
}

// A scarred ray ends at its actual depth sample, never an invented average across two surfaces.
float surfaceDistance(vec2 uv, vec3 origin, vec3 direction, float farDistance) {
  if (uSurfaceRadius > 0.0) {
    float b = dot(origin, direction);
    float discriminant = b * b - dot(origin, origin) + uSurfaceRadius * uSurfaceRadius;
    if (discriminant <= 0.0) return farDistance;
    return max(0.0, -b - sqrt(discriminant));
  }
  float depth = texture2D(uDepth, uv).r;
  return depth < 1.0 ? dot(localPosition(uv, depth) - origin, direction) : farDistance;
}

// SphereGeometry's north is v=1; both borrowed RGBA field maps have flipY=true.
vec2 fieldUv(vec3 direction) {
  return vec2(fract(atan(direction.z, -direction.x) * 0.15915494309189535 + 1.0),
    0.5 + asin(clamp(direction.y, -1.0, 1.0)) * 0.3183098861837907);
}

float envelope(float radius, float alpha) {
  // Display thickness follows existing density, without assigning a physical altitude.
  float top = 1.0 + mix(0.035, 0.09, alpha);
  return smoothstep(0.94, 1.0, radius) * (1.0 - smoothstep(1.005, top, radius));
}

float temperatureEnvelope(float radius, float alpha) {
  float top = 1.018 + mix(0.025, 0.057, alpha);
  return smoothstep(0.97, 1.0, radius) * (1.0 - smoothstep(1.006, top, radius));
}

float co2Envelope(float radius, float alpha) {
  float top = 1.08 + 0.06 * alpha;
  return smoothstep(1.02, 1.045, radius) * (1.0 - smoothstep(1.055, top, radius));
}

float displayResponse(float value) {
  if (uLogResponse == 0.0) return value;
  float expanded = log(1.0 + 9.0 * value) / log(10.0);
  return mix(value, expanded, uLogResponse);
}

vec4 integrateVolume(vec2 uv) {
  vec3 origin = (uInverseEarth * uCameraWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 direction = normalize(localPosition(uv, 1.0) - origin);
  float b = dot(origin, direction);
  float outerRadius = mix(1.09, 1.145, uSeparated);
  float discriminant = b * b - dot(origin, origin) + outerRadius * outerRadius;
  if (discriminant <= 0.0) return vec4(0.0);
  float reach = sqrt(discriminant);
  float nearDistance = max(0.0, dot(localPosition(uv, 0.0) - origin, direction));
  float start = max(nearDistance, -b - reach);
  float end = -b + reach;
  end = min(end, surfaceDistance(uv, origin, direction, end));
  if (end <= start) return vec4(0.0);

  float stepLength = (end - start) / float(uSamples);
  vec3 accumulated = vec3(0.0);
  float opacity = 0.0;
  for (int i = 0; i < 48; i++) {
    if (i >= uSamples) break;
    vec3 point = origin + direction * (start + (float(i) + 0.5) * stepLength);
    float radius = length(point);
    vec2 uv = fieldUv(point / max(radius, 0.0001));
    float temperature = displayResponse(texture2D(uTemperature, uv).a);
    float co2 = displayResponse(texture2D(uCo2, uv).a);
    float temperatureShape = mix(envelope(radius, temperature),
      temperatureEnvelope(radius, temperature), uSeparated);
    float co2Shape = mix(envelope(radius, co2), co2Envelope(radius, co2), uSeparated);
    float strong = min(uOpacityTier, 1.0);
    float nearOpaque = max(0.0, uOpacityTier - 1.0);
    float temperatureDensity = mix(mix(0.7, 1.1, strong), 1.35, nearOpaque) *
      temperature * temperatureShape;
    float co2Density = mix(mix(0.4, 0.75, strong), 1.0, nearOpaque) * co2 * co2Shape;
    float density = temperatureDensity + co2Density;
    if (density <= 0.0) continue;
    vec3 color = (uTemperatureColor * temperatureDensity + uCo2Color * co2Density) / density;
    // Step-length correction keeps optical opacity independent of the chosen sample count.
    float absorption = mix(mix(12.0, 30.0, strong), 72.0, nearOpaque);
    float alpha = 1.0 - exp(-absorption * density * stepLength);
    accumulated += (1.0 - opacity) * alpha * color;
    opacity += (1.0 - opacity) * alpha;
    if (opacity >= 0.995) break;
  }
  // Keep color premultiplied while the reduced-resolution target is interpolated.
  return vec4(accumulated, opacity);
}
`;

const VOLUME_FRAGMENT = VOLUME_INTEGRATION + /* glsl */ `
void main() { gl_FragColor = integrateVolume(vUv); }
`;

const COMPOSITE_FRAGMENT = VOLUME_INTEGRATION + /* glsl */ `
uniform sampler2D uVolume;
uniform vec2 uVolumeSize;
uniform vec2 uOutputSize;
vec4 depthQuad(vec2 center, vec2 offset) {
  return vec4(texture2D(uDepth, center + offset).r, texture2D(uDepth, center - offset).r,
    texture2D(uDepth, center + vec2(offset.x, -offset.y)).r,
    texture2D(uDepth, center + vec2(-offset.x, offset.y)).r);
}
bool depthEdge(vec4 depths, float center) {
  // Reintegrate coverage changes at the silhouette, not every steep interior scar slope.
  // Interior depth still clips each reduced-resolution ray against the actual surface.
  bvec4 hits = lessThan(depths, vec4(1.0));
  return any(notEqual(hits, bvec4(center < 1.0)));
}
vec4 subpixelVolume(vec2 uv) {
  vec2 offset = 0.25 / uOutputSize;
  return 0.25 * (integrateVolume(uv + offset) + integrateVolume(uv - offset) +
    integrateVolume(uv + vec2(offset.x, -offset.y)) + integrateVolume(uv + vec2(-offset.x, offset.y)));
}
void main() {
  gl_FragColor = texture2D(uVolume, vUv);
  if (uSurfaceRadius > 0.0) {
    vec3 origin = (uInverseEarth * uCameraWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 direction = normalize(localPosition(vUv, 1.0) - origin);
    float b = dot(origin, direction);
    float edge = b * b - dot(origin, origin) + uSurfaceRadius * uSurfaceRadius;
    // Cover the complete bilinear source footprint, then evaluate those rays at output resolution.
    vec2 footprint = uOutputSize / uVolumeSize;
    float band = abs(dFdx(edge)) * footprint.x + abs(dFdy(edge)) * footprint.y;
    float pixelWidth = fwidth(edge);
    if (abs(edge) <= 0.5 * pixelWidth) {
      // Four spatial samples only where this output pixel intersects the globe silhouette.
      gl_FragColor = subpixelVolume(vUv);
    } else if (abs(edge) <= band + pixelWidth) gl_FragColor = integrateVolume(vUv);
  } else {
    float center = texture2D(uDepth, vUv).r;
    vec2 pixelSize = 1.0 / uOutputSize;
    if (depthEdge(depthQuad(vUv, 0.25 * pixelSize), center)) {
      gl_FragColor = subpixelVolume(vUv);
    } else {
      vec2 sourceCenter = (floor(vUv * uVolumeSize - 0.5) + 1.0) / uVolumeSize;
      if (depthEdge(depthQuad(sourceCenter, 0.5 / uVolumeSize), center)) {
        gl_FragColor = integrateVolume(vUv);
      }
    }
  }
  if (gl_FragColor.a > 0.0) gl_FragColor.rgb /= gl_FragColor.a;
  #include <colorspace_fragment>
}
`;

/**
 * Borrows the fields, surface depth, drawing size, and inverse-earth transform.
 * render() changes target/clear state: the caller must save and restore renderer state around
 * its depth prepass and this pass. The supplied depth must belong to another framebuffer.
 */
export function createAtmosphereVolume(options: {
  renderer: THREE.WebGLRenderer;
  depth: THREE.DepthTexture;
  drawingSize: THREE.Vector2;
  inverseEarth: THREE.Matrix4;
  surfaceRadius: { value: number };
  colors: { temperature: string; co2: string };
  smooth?: boolean;
  treatment: "volume" | "volume-strong" | "volume-separated" |
    "volume-strong-separated" | "volume-near-opaque-separated" |
    "volume-very-strong-separated" | "volume-log-separated" |
    "volume-log-near-opaque-separated";
}) {
  const { renderer, drawingSize } = options;
  const neutral = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  neutral.colorSpace = THREE.NoColorSpace;
  neutral.needsUpdate = true;
  const target = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, -1, 0, 3, -1, 0, -1, 3, 0,
  ], 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: VOLUME_FRAGMENT,
    uniforms: {
      uDepth: { value: options.depth },
      uTemperature: { value: neutral },
      uCo2: { value: neutral },
      uInverseProjection: { value: new THREE.Matrix4() },
      uCameraWorld: { value: new THREE.Matrix4() },
      uInverseEarth: { value: options.inverseEarth },
      uTemperatureColor: { value: new THREE.Color(options.colors.temperature) },
      uCo2Color: { value: new THREE.Color(options.colors.co2) },
      uSamples: { value: 16 },
      uSurfaceRadius: options.surfaceRadius,
      uOpacityTier: { value: options.treatment.includes("near-opaque") ? 2 :
        options.treatment.includes("very-strong") ? 1.5 :
        options.treatment.includes("strong") || options.treatment.includes("log") ? 1 : 0 },
      uSeparated: { value: options.treatment.includes("separated") ? 1 : 0 },
      uLogResponse: { value: options.treatment.includes("log") ? 1 : 0 },
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    uniforms: { ...material.uniforms, uVolume: { value: target.texture },
      uVolumeSize: { value: new THREE.Vector2(1, 1) }, uOutputSize: { value: drawingSize } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: false,
    toneMapped: false,
  });
  const object = new THREE.Mesh(geometry, compositeMaterial);
  object.frustumCulled = false;
  object.renderOrder = -1;
  object.visible = false;
  const pass = new THREE.Mesh(geometry, material);
  pass.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(pass);
  const screenCamera = new THREE.Camera();
  let fieldCount = 0;
  let disposed = false;

  return {
    object,
    setFields(temperature: THREE.DataTexture | null, co2: THREE.DataTexture | null): void {
      material.uniforms.uTemperature.value = temperature ?? neutral;
      material.uniforms.uCo2.value = co2 ?? neutral;
      fieldCount = Number(temperature !== null) + Number(co2 !== null);
      object.visible = false;
    },
    render(camera: THREE.PerspectiveCamera, samples: 16 | 32 | 48, fraction: number): void {
      object.visible = false;
      if (disposed || fieldCount === 0 || !Number.isFinite(fraction) || fraction <= 0 ||
          !Number.isFinite(drawingSize.x) || !Number.isFinite(drawingSize.y) ||
          drawingSize.x <= 0 || drawingSize.y <= 0) return;
      const scale = Math.min(fraction, 1,
        Math.sqrt((options.smooth ? 2 * MAX_PIXELS : MAX_PIXELS) / (drawingSize.x * drawingSize.y)),
        renderer.capabilities.maxTextureSize / drawingSize.x,
        renderer.capabilities.maxTextureSize / drawingSize.y);
      const width = Math.max(1, Math.floor(drawingSize.x * scale));
      const height = Math.max(1, Math.floor(drawingSize.y * scale));
      if (target.width !== width || target.height !== height) target.setSize(width, height);
      compositeMaterial.uniforms.uVolumeSize.value.set(width, height);
      material.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
      material.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
      material.uniforms.uSamples.value = samples;
      renderer.setRenderTarget(target);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(scene, screenCamera);
      object.visible = true;
    },
    stats() {
      return {
        width: target.width, height: target.height, fieldCount,
        samples: material.uniforms.uSamples.value as 16 | 32 | 48,
        treatment: options.treatment,
        // Attachment plus CPU/GPU copies of owned positions and the neutral pixel; driver
        // bookkeeping and compiled shader storage are not measurable from these allocations.
        additionalBytes: disposed ? 0 : target.width * target.height * 4 + 9 * 4 * 2 + 4 * 2,
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      object.visible = false;
      object.removeFromParent();
      scene.remove(pass);
      geometry.dispose();
      material.dispose();
      compositeMaterial.dispose();
      target.dispose();
      neutral.dispose();
    },
  };
}
