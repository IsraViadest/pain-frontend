/* Existing eval.mjs browser expression. Run v43-a, frozen India camera, desktop or mobile. */
(async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const sleep = (ms) => new Promise((r) => setTimeout(r,ms));
  const until = async (test, label) => {
    for (let i=0;i<200;i++) { if(test()) return; await sleep(50); }
    throw Error('Timed out: '+label);
  };
  const originalFetch = window.fetch;
  const events=[];
  try {
    window.fetch=(input,init)=> {
      if(String(input).includes('/toggle') && init?.body) events.push(JSON.parse(init.body));
      return originalFetch(input,init);
    };
    const layer=(name)=>[...document.querySelectorAll('#ui-layer-stack button')]
      .find((b)=>b.textContent.trim()===name).click();
    layer('Emotional Pain'); await sleep(400);
    const legend=document.querySelector('#emo-legend');
    const profile=document.querySelector('#country-profile');
    const cross=(cat)=>legend.querySelector(`.emo-legend__exclude[data-cat="${cat}"]`);
    const countryCount=document.querySelectorAll('.emo-label').length;
    check(legend.querySelectorAll('.emo-legend__exclude').length===14,'Missing category toggles');
    const pill=document.querySelector('#ui-share-pain').getBoundingClientRect();
    for (const button of legend.querySelectorAll('.emo-legend__exclude')) {
      const r=button.getBoundingClientRect();
      check(r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight,
        'Exclusion button clipped by viewport');
      check(r.right<=pill.left || r.left>=pill.right || r.bottom<=pill.top || r.top>=pill.bottom,
        'Exclusion button overlaps share button');
    }
    const india=document.querySelector('.emo-label[data-iso3="IND"]');
    const rect=india.getBoundingClientRect();
    const xy={bubbles:true,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2};
    document.dispatchEvent(new PointerEvent('pointerdown',xy));
    document.querySelector('canvas').dispatchEvent(new MouseEvent('click',xy));
    await until(()=>!profile.hidden,'selected profile');
    const name=profile.querySelector('h2').textContent;
    const born=performance.timeOrigin;
    const countryEvents=()=>events.filter((e)=>e.kind==='category'&&!e.element.startsWith('emotion-filter:')).length;
    const before=countryEvents();
    const toggle=async(cat)=> {
      const rev=Number(legend.dataset.filterRevision??0);
      cross(cat).click();
      await until(()=>Number(legend.dataset.filterRevision??0)>rev,'filter rebuild');
    };
    await toggle('06_anger');
    check(performance.timeOrigin===born,'Filter reloaded the page');
    check(cross('06_anger').getAttribute('aria-pressed')==='true','Exclude state not pressed');
    check(!document.querySelector('.emo-label[data-cat="06_anger"]'),'Anger survived exclusion');
    check(profile.querySelector('h2').textContent===name&&!profile.hidden,'Selected country lost');
    check(countryEvents()===before,'Filtering manufactured country open/close metrics');
    check(new URL(location.href).searchParams.get('cpExclude')==='06_anger','URL did not save exclusion');
    // A burst must resolve to the latest requested set, not a stale async response.
    const keys=[...legend.querySelectorAll('.emo-legend__exclude')].map((e)=>e.dataset.cat);
    const rev=Number(legend.dataset.filterRevision);
    const remaining=keys.filter((key)=>key!=='06_anger');
    remaining.forEach((key)=>cross(key).click());
    await until(()=>Number(legend.dataset.filterRevision)===rev+remaining.length,'all excluded burst');
    check(document.querySelectorAll('.emo-label').length===0,'All excluded still has labels');
    check(profile.textContent.includes('filtered out'),'Filtered-out data mislabeled as missing');
    await toggle('02_hurt');
    check(document.querySelectorAll('.emo-label').length===countryCount,'Single category lost countries');
    check([...document.querySelectorAll('.emo-label')].every((e)=>e.dataset.cat==='02_hurt'),
      'Single category did not rerank every country');
    await toggle('14_shame');
    check([...document.querySelectorAll('.emo-label')].every((e)=>['02_hurt','14_shame'].includes(e.dataset.cat)),
      'Subset contains an excluded category');
    for(let i=0;i<6;i++) await toggle('06_anger');
    check(legend.querySelectorAll('.emo-legend__exclude').length===14 &&
      document.querySelectorAll('#country-profile').length===1 &&
      document.querySelectorAll('.emo-label').length===countryCount,'Rebuild leaked UI nodes');
    await sleep(1800);
    check(!profile.hidden && profile.querySelector('h2').textContent===name,'Completed network lost profile');
    layer('Physical Pain'); await sleep(400);
    check(legend.hidden,'Filter legend leaked to other layer');
    layer('Emotional Pain'); await sleep(400);
    check(cross('06_anger').getAttribute('aria-pressed')==='true','Layer change lost filters');
    return {passed:true,country:name,categories:14,labels:countryCount,filterEvents:events.filter(e=>e.element.startsWith('emotion-filter:')).length,
      countryEventsBefore:before,countryEventsAfter:countryEvents(),url:location.href};
  } catch(error) { return {passed:false,error:String(error.stack??error)}; }
  finally {window.fetch=originalFetch;}
})()
