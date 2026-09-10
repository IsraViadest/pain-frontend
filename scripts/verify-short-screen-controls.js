/* Existing eval.mjs runner, v45-a_fit-short-screen, pass actual viewport dimensions. */
(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const app = document.querySelector('#app');
    check(app.hasAttribute('data-cp-fit-controls'), 'Wrong comparison preset');
    if (new URL(location.href).searchParams.has('selected')) {
      const label = document.querySelector('.emo-label[data-iso3="IND"]');
      const r = label.getBoundingClientRect();
      const coordinates = {bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
      document.dispatchEvent(new PointerEvent('pointerdown',coordinates));
      document.querySelector('canvas').dispatchEvent(new MouseEvent('click',coordinates));
      await sleep(1500);
      check(!document.querySelector('#country-profile').hidden, 'Profile selection did not appear');
    }
    const hamburger = document.querySelector('.ui-hamburger');
    if (getComputedStyle(hamburger).display !== 'none') hamburger.click();
    window.dispatchEvent(new Event('resize'));
    await sleep(700);
    const picker = document.querySelector('#ui-layer-stack');
    const measure = () => ({
      viewport: [innerWidth,innerHeight],
      scale: Number(picker.style.getPropertyValue('--picker-fit-scale')),
      scrolling: picker.scrollHeight > picker.clientHeight + 1,
      rect: picker.getBoundingClientRect().toJSON(),
      buttons: [...picker.querySelectorAll('button')].map((b) => b.getBoundingClientRect().toJSON()),
    });
    const first = measure();
    check(getComputedStyle(picker).visibility === 'visible', 'Menu did not open');
    check(first.rect.left >= 0 && first.rect.right <= innerWidth + 1 && first.rect.top >= 0 &&
      first.rect.bottom <= document.querySelector('#ui-share-pain').getBoundingClientRect().top - 10,
    'Picker outside available viewport');
    check(first.buttons.every((b) => b.height >= 23.5 && b.width >= 23.5), 'Unusable tap target');
    if (!first.scrolling) [...picker.querySelectorAll('button')].forEach((button) => {
      const r = button.getBoundingClientRect();
      check(button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),
        'Scaled button is covered by other chrome');
    });
    if (innerHeight >= 320) check(!first.scrolling, 'Expected ordinary phone height to fit without scrolling');
    await sleep(500);
    const settled = measure();
    check(Math.abs(first.rect.height - settled.rect.height) < 1, 'Resize layout oscillation');
    const buttons = [...picker.querySelectorAll('button')];
    const physical = buttons.find((b) => b.textContent.trim() === 'Physical Pain');
    physical.click(); await sleep(700);
    check(physical.classList.contains('blob-button--active'), 'Scaled button did not select its layer');
    return {passed:true,...settled};
  } catch (error) {return {passed:false,error:String(error.stack ?? error)};}
})()
