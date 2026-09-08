/* Run in the existing eval.mjs browser helper against Vite with v46-dots_water-depth. */
(async () => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let prototype, original;
  try {
    check(!document.querySelector('#video-invitation, .pain-video, .country-presentation'),
      'Hidden feature still mounted');
    check(![...document.querySelectorAll('button')].some(b => /country cycle|start video/i.test(b.textContent)),
      'Hidden feature control visible');
    check(!performance.getEntriesByType('resource').some(r => /pain-(480|720|1080|matte)|video-poster/.test(r.name)),
      'Hidden video downloaded assets');
    const festival = document.querySelector('.festival-media__link');
    check(festival?.target === '_blank', 'Festival invitation missing');
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name)
      .find(name => /\/src\/globe\/GlobeView(?:\.ts)?(?:\?|$)/.test(name));
    check(moduleUrl, 'No loaded globe module');
    const { GlobeView } = await import(moduleUrl);
    prototype = GlobeView.prototype;
    original = prototype.setScarContourStyle;
    let globe;
    prototype.setScarContourStyle = function (style) { globe = this; return original.call(this, style); };
    const results = [];
    for (const [name, expected, heading] of [
      ['Physical Pain', true, 'Global health conditions'],
      ['Socio-economic Pain', false, 'Country basedwealth (GDP)'],
      ['Environmental Pain', false, 'Temperature'],
      ['Emotional Pain', false, 'Strongest emotion by country'],
      ['all the pain', true, ''],
      ['Socio-economic Pain', false, 'Country basedwealth (GDP)'],
    ]) {
      const button = [...document.querySelectorAll('#ui-layer-stack button')]
        .find(b => b.textContent.trim() === name);
      check(button, `Missing button ${name}`);
      button.click();
      await wait(2200);
      check(globe, 'Layer update did not reach contour setter');
      check(Boolean(globe.scarContourStyle) === expected, `Contour state leaked into ${name}`);
      if (expected) check(globe.scarContourLayer?.object.visible, `Contours absent in ${name}`);
      else check(!globe.scarContourLayer, `Contour object survived in ${name}`);
      const text = (name === 'Emotional Pain' ? document.querySelector('#emo-legend') :
        document.querySelector('#ui-legend'))?.textContent ?? '';
      check(text.includes(heading), `Wrong legend in ${name}: ${text}`);
      if (/Physical|Environmental|Socio-economic/.test(name)) {
        check(text.includes('min') && text.includes('max'), `No endpoints for ${name}`);
      }
      results.push({ layer: name, contours: expected, text });
    }
    return { passed: true, viewport: [innerWidth, innerHeight], results };
  } catch (error) { return { passed: false, error: String(error.stack ?? error) }; }
  finally { if (prototype && original) prototype.setScarContourStyle = original; }
})()
