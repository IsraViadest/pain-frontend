/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
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
    const projection = new URL(location.href).searchParams.get('cpProjection') === '1';
    const share = document.querySelector('#ui-share-pain');
    check(share?.querySelector('button'), 'Survey button implementation removed');
    check((share.getBoundingClientRect().width === 0) === projection, 'Wrong projection visibility');
    const moduleUrl = performance.getEntriesByType('resource').map(r => r.name)
      .find(name => /\/src\/globe\/GlobeView(?:\.ts)?(?:\?|$)/.test(name));
    check(moduleUrl, 'No loaded globe module');
    const { GlobeView } = await import(moduleUrl);
    prototype = GlobeView.prototype;
    original = prototype.setScarContourStyle;
    let globe;
    prototype.setScarContourStyle = function (style) { globe = this; return original.call(this, style); };
    const results = [];
    let socioeconomicBarHeight;
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
        const svg = document.querySelector('#ui-legend svg');
        const height = svg.getBoundingClientRect().height;
        const mobile = innerWidth <= 768 || innerHeight <= 500;
        const unit = Math.min(272, mobile ? innerHeight * .3 : (innerHeight - 300) * 136 / 192);
        const ratio = name === 'Environmental Pain' ? 208 / 136 : name === 'Physical Pain' ? 170 / 136 : 1;
        const stackSpace = Math.max(0, innerHeight - 2 * (document.querySelector('#ui-title').getBoundingClientRect().bottom + 12));
        const expectedHeight = Math.min(unit * ratio,
          innerHeight * (mobile ? .3 : .64) * (name === 'Environmental Pain' ? ratio : 1),
          name === 'Environmental Pain' && !mobile ? stackSpace : Infinity);
        check(Math.abs(height - expectedHeight) < 2, `Legend height ${height}, expected ${expectedHeight}`);
        if (name === 'Physical Pain') {
          const endpoint = svg.querySelector('circle[data-depth="1"]').getAttribute('fill');
          check(endpoint === '#320611', 'Physical legend does not use the approved dark v46 palette');
          const title = svg.querySelector('text').getBoundingClientRect();
          const diagram = svg.querySelector('g[transform]').getBoundingClientRect();
          check(diagram.left - title.right > 3 &&
            Math.abs((title.top + title.bottom - diagram.top - diagram.bottom) / 2) < 4,
            'Physical title lacks spacing or vertical centering');
          const first = Number(svg.querySelector('circle[data-depth="0"]').getAttribute('r'));
          const last = Number(svg.querySelector('circle[data-depth="1"]').getAttribute('r'));
          const mode = globe.pointsMaterial.uniforms.uScarDepthSize.value;
          check(Math.abs(first / last - (mode < 0 ? 2 : mode > 0 ? .5 : 1)) < .001,
            'Legend dot diameter ratio does not match the map');
          check(first <= 2.25 && svg.querySelectorAll('[data-physical-caps] circle').length === 4,
            'Smaller legend dots or dotted upper ends missing');
          check(svg.querySelectorAll('circle[cy="32"]').length === 6 &&
            svg.querySelectorAll('circle').length >= 34, 'Dense dotted V missing');
        }
        if (name === 'Socio-economic Pain') {
          const bar = svg.querySelector(':scope > rect').getBoundingClientRect();
          socioeconomicBarHeight = bar.height;
          check(svg.querySelector('text').getBoundingClientRect().right < bar.left,
            'Socioeconomic title is not left of scale');
        }
        if (name === 'Environmental Pain') {
          check(text.includes('Temperature Change') && text.includes('Emissions (CO2)'), 'Wrong environmental names');
          const bars = [...svg.querySelectorAll('rect')].map(e => e.getBoundingClientRect());
          check(Math.abs(bars[0].left - bars[1].left) < 1 && bars[0].bottom < bars[1].top,
            'Environmental scales not stacked');
          check(Math.abs(bars[0].height - bars[1].height) < 1 &&
            bars[0].height <= socioeconomicBarHeight + 1, 'Inconsistent environmental scale size');
          if (!mobile) check(Math.abs((bars[0].bottom + bars[1].top) / 2 - innerHeight / 2) < 1,
            'Environmental gap is not vertically centered');
          check(Math.abs((bars[1].top - bars[0].bottom) / bars[0].height - 32 / 80) < .01,
            'Environmental groups are not separated by the intended larger gap');
          for (const [i, title] of [...svg.querySelectorAll('text')].slice(0, 2).entries()) {
            const gap = bars[i].left - title.getBoundingClientRect().right;
            check(gap > 0 && gap < bars[i].height * .18, 'Environmental title not close to scale');
          }
          const bounds = svg.getBoundingClientRect();
          for (const label of svg.querySelectorAll('text')) {
            if (getComputedStyle(label).display === 'none') continue;
            const r = label.getBoundingClientRect();
            check(r.left >= bounds.left - 1 && r.right <= bounds.right + 1 &&
              r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1, 'Clipped environmental caption');
          }
        }
      }
      const storage = name === 'all the pain' ? globe.getRenderDetailStorage() : undefined;
      if (storage && new URL(location.href).searchParams.get('cpQuality') === 'light') {
        check(storage.total <= 64 * 1024 ** 2, 'Light storage exceeded: ' + JSON.stringify(storage));
      }
      results.push({ layer: name, contours: expected, text, storage,
        atmosphere: storage ? globe.getAtmosphereStats() : undefined });
    }
    const picker = document.querySelector('#ui-layer-stack');
    if (projection && picker.hasAttribute('data-height-constrained')) {
      check(parseFloat(picker.style.maxHeight) > 0, 'Hidden share button collapsed the picker');
      check(!document.querySelector('#ui-bottom-left').style.maxWidth, 'Hidden share button narrowed About');
    }
    return { passed: true, projection, viewport: [innerWidth, innerHeight], results };
  } catch (error) { return { passed: false, error: String(error.stack ?? error) }; }
  finally { if (prototype && original) prototype.setScarContourStyle = original; }
})()
