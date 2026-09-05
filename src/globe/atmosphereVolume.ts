import * as THREE from "three";

const MAX_PIXELS = 1_048_576;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const VOLUME_FRAGMENT = /* glsl */ `
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

vec3 localPosition(float depth) {
  vec4 view = uInverseProjection * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return (uInverseEarth * uCameraWorld * vec4(view.xyz / view.w, 1.0)).xyz;
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

void main() {
  vec3 origin = (uInverseEarth * uCameraWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 direction = normalize(localPosition(1.0) - origin);
  float b = dot(origin, direction);
  float discriminant = b * b - dot(origin, origin) + 1.09 * 1.09;
  if (discriminant <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float reach = sqrt(discriminant);
  float nearDistance = max(0.0, dot(localPosition(0.0) - origin, direction));
  float start = max(nearDistance, -b - reach);
  float end = -b + reach;
  float depth = texture2D(uDepth, vUv).r;
  if (depth < 1.0) end = min(end, dot(localPosition(depth) - origin, direction));
  if (end <= start) { gl_FragColor = vec4(0.0); return; }

  float stepLength = (end - start) / float(uSamples);
  vec3 accumulated = vec3(0.0);
  float opacity = 0.0;
  for (int i = 0; i < 48; i++) {
    if (i >= uSamples) break;
    vec3 point = origin + direction * (start + (float(i) + 0.5) * stepLength);
    float radius = length(point);
    vec2 uv = fieldUv(point / max(radius, 0.0001));
    float temperature = texture2D(uTemperature, uv).a;
    float co2 = texture2D(uCo2, uv).a;
    float temperatureDensity = 0.7 * temperature * envelope(radius, temperature);
    float co2Density = 0.4 * co2 * envelope(radius, co2);
    float density = temperatureDensity + co2Density;
    if (density <= 0.0) continue;
    vec3 color = (uTemperatureColor * temperatureDensity + uCo2Color * co2Density) / density;
    // Step-length correction keeps optical opacity independent of the chosen sample count.
    float alpha = 1.0 - exp(-12.0 * density * stepLength);
    accumulated += (1.0 - opacity) * alpha * color;
    opacity += (1.0 - opacity) * alpha;
    if (opacity >= 0.995) break;
  }
  // The target stores straight linear RGB, not premultiplied color or display-encoded RGB.
  gl_FragColor = vec4(opacity > 0.0 ? accumulated / opacity : vec3(0.0), opacity);
}
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uVolume;
void main() {
  gl_FragColor = texture2D(uVolume, vUv);
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
  colors: { temperature: string; co2: string };
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
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    uniforms: { uVolume: { value: target.texture } },
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
      const scale = Math.min(fraction, 1, Math.sqrt(MAX_PIXELS / (drawingSize.x * drawingSize.y)),
        renderer.capabilities.maxTextureSize / drawingSize.x,
        renderer.capabilities.maxTextureSize / drawingSize.y);
      const width = Math.max(1, Math.floor(drawingSize.x * scale));
      const height = Math.max(1, Math.floor(drawingSize.y * scale));
      if (target.width !== width || target.height !== height) target.setSize(width, height);
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
