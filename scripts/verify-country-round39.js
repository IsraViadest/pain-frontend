/* GPU-backed expression for artifacts/emo-views/eval.mjs. Synthetic rendering + real data. */
(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const owned = [];
  let renderer, contours, dots;
  try {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { createScarContourLayer } = await import('/src/globe/scarContourLayer.ts');
    const { createEarthStippleGlobe } = await import('/src/globe/earthStippleGlobe.ts');
    const { loadGdpPerCapita } = await import('/src/countryProfile/gdpPerCapita.ts');
    const { loadEmoData } = await import('/src/emo/emoData.ts');
    const { buildCountryPainProfiles } = await import('/src/countryProfile/data.ts');
    const { ensureCountryGeometriesLoaded, getCountryGeometries } = await import('/src/globe/countryGeometry.ts');
    const gdp = await loadGdpPerCapita();
    check(gdp.length === 187, 'GDP coverage');
    const ordered = [...gdp].sort((a,b) => a.metadata.rawValue-b.metadata.rawValue);
    check(ordered[0].intensity === 1 && Math.abs(ordered.at(-1).intensity) < 1e-12,
      'GDP endpoints not inverted');
    check(ordered.every((p,i) => i === 0 || p.intensity <= ordered[i-1].intensity), 'GDP ordering');
    const data = await loadEmoData('combined-v2');
    check(Object.keys(data.countries).length === 192, 'Emotion coverage');
    await ensureCountryGeometriesLoaded();
    const profiles = buildCountryPainProfiles(data,
      { environmental: [], physical: [], socioeconomic: gdp }, getCountryGeometries());
    check(profiles.size === 195, 'Missing emotions removed profile identities');
    for (const iso of ['COM','FSM','GNB']) check(profiles.get(iso).emotional.value === null &&
      !profiles.get(iso).emotional.categoryKey, 'Missing emotion acquired category');

    renderer = new THREE.WebGLRenderer({alpha:true,antialias:false});
    renderer.setSize(256,256,false); renderer.setClearColor(0,0);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45,1,.01,10);
    camera.position.z=2.35; camera.lookAt(0,0,0); camera.updateMatrixWorld();
    const pixels = new Uint8Array(256*256*4);
    const read = () => {
      renderer.render(scene,camera);
      const gl=renderer.getContext(); gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      check(gl.getError()===gl.NO_ERROR,'GL error');
      return pixels.reduce((sum,v,i)=>sum+(i%4===3?v:0),0);
    };
    const field = (center) => {
      const w=256,h=128,bytes=new Uint8Array(w*h).fill(128);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const distance=((x/w-center)/.07)**2+((y/h-.5)/.12)**2;
        if(distance<1) bytes[y*w+x]=Math.round(128-110*(1-distance));
      }
      const map=new THREE.DataTexture(bytes,w,h,THREE.RedFormat);
      map.wrapS=THREE.RepeatWrapping; map.minFilter=map.magFilter=THREE.LinearFilter;
      map.needsUpdate=true; owned.push(map); return map;
    };
    contours=createScarContourLayer(1,[]); scene.add(contours.object);
    contours.setStyle('water-blue'); contours.setField(field(.25),.4,-.2);
    const front=read(); check(front>0,'Water contours invisible');
    const depthColors = {};
    for (const color of ['blue', 'coral', 'dots']) {
      contours.setStyle(`water-${color}-depth`);
      contours.object.material.uniforms.uLevels.value = 255 / 16;
      depthColors[color] = [96, 32].map((height) => {
        const map = new THREE.DataTexture(new Uint8Array([height]),1,1,THREE.RedFormat);
        map.needsUpdate = true; owned.push(map);
        contours.setField(map,0,0);
        check(read() > 0, 'Depth-colored contour absent');
        const i = (128 * 256 + 128) * 4;
        return [...pixels.slice(i,i+3)].reduce((sum,v)=>sum+v,0) / pixels[i+3];
      });
      check(depthColors[color][1] < depthColors[color][0], 'Deeper contour is not darker');
    }
    contours.setStyle('water-blue'); contours.setLevels(24);
    contours.setField(field(.75),.4,-.2);
    const back=read(); check(back===0,'Far-side contours bleed through');
    contours.setField(field(.25),.4,-.2);
    const land=contours.object.material.uniforms.uLandMap.value;
    land.image.data.fill(255); land.needsUpdate=true;
    check(read()===0,'Water contours paint land');
    contours.dispose(); contours=null;

    dots=await createEarthStippleGlobe(1,2,'/borders/ne_110m_admin_0_countries.geojson?v=4',
      new THREE.Vector3(1,0,0),new THREE.Vector3(1,1,1),new THREE.Vector3(1,0,0),1,1);
    const geo=dots.points.geometry;
    geo.attributes.position.setXYZ(0,0,0,1); geo.attributes.position.needsUpdate=true;
    geo.attributes.normal.setXYZ(0,0,0,1); geo.attributes.normal.needsUpdate=true;
    geo.attributes.aLand.setX(0,1); geo.attributes.aLand.needsUpdate=true; geo.setDrawRange(0,1);
    scene.add(dots.points);
    const zero=new THREE.DataTexture(new Uint8Array([0]),1,1,THREE.RedFormat);
    zero.needsUpdate=true; owned.push(zero);
    const u=dots.material.uniforms;
    u.uScarMap.value=zero; u.uScarActive.value=1; u.uScarDispScale.value=0;
    u.uScarMaxDepth.value=128/255; u.uPointScale.value=10;
    const dotWidth=()=>{read(); let min=256,max=-1; for(let y=0;y<256;y++) for(let x=0;x<256;x++)
      if(pixels[(y*256+x)*4+3]>4){min=Math.min(min,x);max=Math.max(max,x);}return max-min+1;};
    u.uScarDepthSize.value=0; const baseWidth=dotWidth();
    u.uScarDepthSize.value=1; const deepWidth=dotWidth();
    check(Math.abs(deepWidth/baseWidth-2)<.12,'Deepest dot is not 2x diameter');
    u.uScarDepthSize.value=-1; const reversedDeepWidth=dotWidth();
    zero.image.data[0]=128; zero.needsUpdate=true;
    const reversedSurfaceWidth=dotWidth();
    check(Math.abs(reversedDeepWidth/baseWidth-.75)<.1 &&
      Math.abs(reversedSurfaceWidth/baseWidth-1.5)<.1,'Reversed dot ramp is not 150% to 75%');
    return {passed:true,gdpCountries:gdp.length,emotionalCountries:192,profiles:profiles.size,
      waterContourAlpha:front,backContourAlpha:back,dotWidths:[baseWidth,deepWidth],depthColors,
      reversedDotWidths:[reversedSurfaceWidth,reversedDeepWidth]};
  } catch(error){ return {passed:false,error:String(error.stack??error)}; }
  finally {contours?.dispose();dots?.dispose();owned.forEach(x=>x.dispose());
    renderer?.dispose(); renderer?.forceContextLoss();}
})()
