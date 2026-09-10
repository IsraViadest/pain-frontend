/* Existing eval.mjs expression. Requires loaded Vite, all-pain selected, no country cycle.
 * created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 * Isolates the actual atmospheric composite, then repeats with a deterministic deformed mesh.
 * No screenshot or source-field attribution: far-only fixtures diagnose occlusion independently.
 */
(async () => {
  const rows = [], failures = [];
  const check = (value, message) => { if (!value) throw Error(message); };
  let fixtureRenderer, fixtureGeometry, fixtureAtmosphere;
  try {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createEnvironmentalAtmosphere } = await import("/src/globe/environmentalAtmosphere.ts");
    check(document.visibilityState === "visible", "Keep the Vite page visible");
    check(document.querySelector('button[data-layer="all-pain"].blob-button--active'),
      "Select all-pain and wait for its fields to load before running");
    check(!document.querySelector('.country-presentation-toggle[aria-pressed="true"]'),
      "Stop the country cycle before running");
    const moduleUrl = performance.getEntriesByType("resource").map(entry => entry.name)
      .find(name => /\/src\/globe\/GlobeView(?:\.ts)?(?:\?|$)/.test(name));
    check(moduleUrl, "Loaded Vite GlobeView module was not found");
    const { GlobeView } = await import(moduleUrl);
    const originalTick = GlobeView.prototype.tick;
    const globe = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        GlobeView.prototype.tick = originalTick;
        reject(Error("No application frame within 3000 ms"));
      }, 3000);
      GlobeView.prototype.tick = function (...args) {
        GlobeView.prototype.tick = originalTick;
        clearTimeout(timer);
        try { originalTick.apply(this, args); resolve(this); } catch (error) { reject(error); }
      };
    });
    check(globe.showAllLayersMode && globe.atmosphere && globe.temperatureShellMap && globe.co2HazeMap,
      "All-pain volume and both original fields must be loaded");
    check(!globe.temperatureShell.visible && !globe.co2Haze.visible, "Legacy atmospheric shell is visible");

    function field(center, degrees = 12, width = 256) {
      const height = width / 2, bytes = new Uint8Array(width * height * 4);
      let texels = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const latitude = Math.PI * (0.5 - (y + 0.5) / height);
        const longitude = 2 * Math.PI * (x + 0.5) / width;
        const cosine = Math.cos(latitude);
        const dot = -cosine * Math.cos(longitude) * center.x + Math.sin(latitude) * center.y +
          cosine * Math.sin(longitude) * center.z;
        if (dot < Math.cos(degrees * Math.PI / 180)) continue;
        const offset = (y * width + x) * 4;
        bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = bytes[offset + 3] = 255;
        texels++;
      }
      check(texels > 0, "Compact field has no texels");
      const texture = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat);
      texture.flipY = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      return texture;
    }

    function exercise(name, renderer, camera, earth, surface, atmosphere, originals, deform,
      cameraRadius = 2.6) {
      const saved = {
        target: renderer.getRenderTarget(), autoClear: renderer.autoClear,
        color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
        viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()),
        scissorTest: renderer.getScissorTest(), position: camera.position.clone(),
        quaternion: camera.quaternion.clone(), earthQuaternion: earth.quaternion.clone(),
        render: renderer.render,
      };
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      check(size.x > 0 && size.y > 0 && size.x * size.y <= 8_388_608,
        name + ": drawing buffer exceeds the 8M-pixel readback bound");
      const composites = earth.children.filter(child => child.material?.uniforms?.uVolume);
      check(composites.length === 1, name + ": expected exactly one volume composite");
      const output = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: false, stencilBuffer: false });
      const pixels = new Uint8Array(size.x * size.y * 4), masks = new Uint8Array(size.x * size.y);
      const isolated = new THREE.Scene();
      const clone = composites[0].clone(false);
      clone.visible = true;
      isolated.add(clone); // clone(false) shares the actual geometry, material and uniforms.
      const uniforms = clone.material.uniforms;
      let depthDraws = 0;
      renderer.render = function (scene, ...args) {
        if (scene.children.length === 1 && scene.children[0].material?.colorWrite === false) {
          check(scene.children[0].geometry === surface, name + ": atmospheric depth uses another surface");
          depthDraws++;
        }
        return saved.render.call(this, scene, ...args);
      };
      try {
        renderer.setScissorTest(false);
        renderer.setClearColor(0, 0);
        renderer.autoClear = true;
        const phi = 30 * Math.PI / 180; // Longitude -150 degrees in the globe's field frame.
        const pacific = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        earth.updateWorldMatrix(true, false);
        camera.position.copy(pacific).multiplyScalar(cameraRadius).applyMatrix4(earth.matrixWorld);
        camera.lookAt(new THREE.Vector3().setFromMatrixPosition(earth.matrixWorld));
        camera.updateMatrixWorld();
        const view = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() };
        for (let frame = 0; frame < 3; frame++) {
          earth.quaternion.copy(saved.earthQuaternion).multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame * 0.57));
          deform?.(frame);
          earth.updateWorldMatrix(true, false);
          const inverse = earth.matrixWorld.clone().invert();
          const origin = camera.position.clone().applyMatrix4(inverse);
          const front = origin.clone().normalize();
          const positions = surface.getAttribute("position");
          let minRadius = Infinity, maxRadius = 0;
          for (let i = 0; i < positions.count; i++) {
            const radius = Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i));
            minRadius = Math.min(minRadius, radius); maxRadius = Math.max(maxRadius, radius);
          }
          check(minRadius > 0 && maxRadius > minRadius + 0.001,
            name + ": fixture must exercise a genuinely deformed surface");
          // Conservative spheres classify guaranteed covered interior and guaranteed clear exterior.
          const unproject = inverse.clone().multiply(camera.matrixWorld).multiply(camera.projectionMatrixInverse);
          const direction = new THREE.Vector3(), originSquared = origin.lengthSq();
          for (let y = 0; y < size.y; y++) for (let x = 0; x < size.x; x++) {
            direction.set(2 * (x + 0.5) / size.x - 1, 2 * (y + 0.5) / size.y - 1, 1)
              .applyMatrix4(unproject).sub(origin).normalize();
            const b = origin.dot(direction), impactSquared = originSquared - b * b;
            masks[y * size.x + x] = b < 0 && impactSquared < minRadius ** 2 * 0.98 ? 1 :
              b >= 0 || impactSquared > maxRadius ** 2 * 1.02 ? 2 : 0;
          }
          function read(label, temperature, co2) {
            atmosphere.setFields(temperature, co2);
            const before = depthDraws;
            atmosphere.prepare(16, 0.25);
            const stats = atmosphere.stats();
            const row = { name, frame, label, view, minRadius, maxRadius,
              surfaceRadius: uniforms.uSurfaceRadius.value,
              depthWidth: stats.depthWidth, depthHeight: stats.depthHeight,
              samples: stats.samples, volumeWidth: stats.width, volumeHeight: stats.height,
              depthDraws: depthDraws - before, geometryVersion: positions.version,
              alpha: 0, insideDiscAlpha: 0, outsideRimAlpha: 0, boundaryAlpha: 0,
              insidePixels: 0, outsidePixels: 0, red: 0, green: 0, blue: 0, maxAlpha: 0 };
            rows.push(row);
            renderer.setRenderTarget(output);
            renderer.render(isolated, camera);
            renderer.readRenderTargetPixels(output, 0, 0, size.x, size.y, pixels);
            for (let i = 0; i < masks.length; i++) {
              const offset = i * 4, alpha = pixels[offset + 3];
              row.alpha += alpha;
              row.red += pixels[offset]; row.green += pixels[offset + 1]; row.blue += pixels[offset + 2];
              row.maxAlpha = Math.max(row.maxAlpha, alpha);
              if (masks[i] === 1) { row.insideDiscAlpha += alpha; row.insidePixels++; }
              else if (masks[i] === 2) { row.outsideRimAlpha += alpha; row.outsidePixels++; }
              else row.boundaryAlpha += alpha;
            }
            check(row.insidePixels > 100 && row.outsidePixels > 100, name + ": invalid pixel masks");
            check(row.surfaceRadius === 0 && row.depthDraws === 1,
              name + ": deformed fixture bypassed private depth");
            check(renderer.getContext().getError() === renderer.getContext().NO_ERROR, name + ": WebGL error");
            return row;
          }
          if (frame === 0 && originals[0] && originals[1]) read("original-Pacific", ...originals);
          const rear = field(front.clone().negate()), near = field(front);
          // A compact patch beyond the ground horizon, diagonally placed inside the viewport.
          const tangent = front.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
            .add(new THREE.Vector3(0, 1, 0)).normalize();
          const angle = 76 * Math.PI / 180;
          const pastHorizon = field(front.clone().multiplyScalar(Math.cos(angle))
            .addScaledVector(tangent, Math.sin(angle)), 3);
          const visibleAngle = Math.acos(1 / origin.length()) - 0.65 * Math.PI / 180;
          const justVisible = cameraRadius < 1.5 ? field(front.clone().multiplyScalar(Math.cos(visibleAngle))
            .addScaledVector(tangent, Math.sin(visibleAngle)), 0.25, 1536) : null;
          try {
            for (const channel of ["temperature", "co2"]) {
              const rearFields = channel === "temperature" ? [rear, null] : [null, rear];
              const frontFields = channel === "temperature" ? [near, null] : [null, near];
              const hidden = read(channel + "-far-only", ...rearFields);
              const visible = read(channel + "-front-only", ...frontFields);
              const horizon = read(channel + "-past-horizon",
                ...(channel === "temperature" ? [pastHorizon, null] : [null, pastHorizon]));
              if (hidden.alpha !== 0) failures.push(name + "/" + frame + "/" + channel +
                ": compact far-only field contributed alpha " + hidden.alpha);
              if (visible.insideDiscAlpha <= 0) failures.push(name + "/" + frame + "/" + channel +
                ": front-only positive control disappeared");
              if (horizon.alpha !== 0) failures.push(name + "/" + frame + "/" + channel +
                ": field beyond the ground horizon remained visible " + horizon.alpha);
              if (justVisible) {
                const rim = read(channel + "-just-visible-source",
                  ...(channel === "temperature" ? [justVisible, null] : [null, justVisible]));
                if (rim.alpha === 0) failures.push(name + "/" + frame + "/" + channel +
                  ": raised air above a still-visible ground source disappeared");
              }
            }
          } finally { rear.dispose(); near.dispose(); pastHorizon.dispose(); justVisible?.dispose(); }
        }
      } finally {
        renderer.render = saved.render;
        camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); camera.updateMatrixWorld();
        earth.quaternion.copy(saved.earthQuaternion); earth.updateWorldMatrix(true, false);
        try {
          atmosphere.setFields(...originals);
          atmosphere.prepare(name === "live-all-pain" ? globe.atmosphereSamples : 16,
            name === "live-all-pain" ? globe.atmosphereFraction : 0.25);
        } finally {
          renderer.setRenderTarget(saved.target); renderer.setViewport(saved.viewport);
          renderer.setScissor(saved.scissor); renderer.setScissorTest(saved.scissorTest);
          renderer.setClearColor(saved.color, saved.alpha); renderer.autoClear = saved.autoClear;
          output.dispose(); isolated.remove(clone);
        }
      }
    }

    exercise("live-all-pain", globe.renderer, globe.camera, globe.earthContent, globe.getCountrySurfaceGeometry(),
      globe.atmosphere, [globe.temperatureShellMap, globe.co2HazeMap]);
    fixtureRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    fixtureRenderer.setPixelRatio(1); fixtureRenderer.setSize(320, 320, false);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50), earth = new THREE.Group();
    camera.position.z = 2.6;
    fixtureGeometry = new THREE.SphereGeometry(1, 96, 64);
    const originalPositions = fixtureGeometry.attributes.position.array.slice();
    fixtureAtmosphere = createEnvironmentalAtmosphere({ mode: "volume-very-strong-separated",
      renderer: fixtureRenderer, camera, earthContent: earth, surfaceGeometry: fixtureGeometry });
    exercise("deformed-fixture", fixtureRenderer, camera, earth, fixtureGeometry, fixtureAtmosphere,
      [null, null], frame => {
        const positions = fixtureGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const offset = 3 * i, x = originalPositions[offset], y = originalPositions[offset + 1];
          const z = originalPositions[offset + 2];
          const radius = 0.9 + 0.065 * Math.sin(4 * x + frame * 0.7) * Math.cos(3 * y);
          positions.setXYZ(i, x * radius, y * radius, z * radius);
        }
        positions.needsUpdate = true; fixtureGeometry.computeBoundingSphere();
      });
    // A wide test lens exposes the horizon at minimum zoom instead of cropping it offscreen.
    camera.fov = 120; camera.updateProjectionMatrix();
    exercise("close-horizon-fixture", fixtureRenderer, camera, earth, fixtureGeometry,
      fixtureAtmosphere, [null, null], undefined, 1.35);
    return { passed: failures.length === 0, failures, rows,
      limits: "Consecutive synchronous renders; separate 12-degree far and 3-degree horizon patches. " +
        "Original Pacific pixels are measured but not attributed to source locations." };
  } catch (error) {
    return { passed: false, error: String(error.stack ?? error), failures, rows };
  } finally {
    fixtureAtmosphere?.dispose(); fixtureGeometry?.dispose(); fixtureRenderer?.dispose();
  }
})()
