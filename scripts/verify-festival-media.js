/* Existing eval.mjs runner; test actual progressive playback and responsive hit areas. */
(async()=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(p,m)=>{for(let i=0;i<300;i++){if(p())return;await sleep(50)}throw Error('Timed out: '+m)};
 try{
  await until(()=>document.querySelector('.festival-media__play') && document.querySelector('.pain-video'),
    'media controls ready');
  const button=document.querySelector('.festival-media__play');
  const link=document.querySelector('.festival-media__link');
  const dialog=document.querySelector('.pain-video');
  const video=dialog?.querySelector('video');
  check(button&&link&&dialog&&video,'Media chrome missing');
  await document.fonts.ready;
  const rect=button.getBoundingClientRect(),lr=link.getBoundingClientRect();
  for(const r of [rect,lr])check(r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,'Media chrome outside viewport');
  check(!button.contains(document.elementFromPoint(rect.left+1,rect.top+1)),'Square corner intercepts clicks');
  check(document.elementFromPoint(rect.left+1,rect.top+1)===document.querySelector('#globe'),
    'Transparent poster corner blocks globe gestures');
  check(button.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)),'Poster center covered');
  check(rect.width>=Math.min(250,innerWidth-48),'First invitation is not large');
  check(Math.abs(rect.left+rect.width/2-innerWidth/2)<2,'First invitation not centered');
  check(!video.getAttribute('src'),'Video source assigned before opening');
  check(!performance.getEntriesByType('resource').some(r=>/pain-(480|720|1080)\.mp4/.test(r.name)),'Video eagerly requested');
  check(link.target==='_blank' && link.rel.includes('noopener'),'Festival link leaves the site');
  const dismiss=new URL(location.href).searchParams.get('testDismiss');
  if(dismiss==='skip' || dismiss==='outside') {
    if(dismiss==='skip') document.querySelector('.video-invitation__skip').focus();
    document.querySelector(dismiss==='skip'?'.video-invitation__skip':'#theme-toggle').click();
    await sleep(450);
    check(document.querySelector('#video-invitation').parentElement.id==='ui-share-pain','Invitation did not dock');
    check(localStorage.getItem('pain-video-intro-dismissed-v1')==='true','Dismissal not remembered');
    check(!video.getAttribute('src'),'Dismissing invitation fetched a video');
    if(dismiss==='skip') check(document.activeElement===button,'Skip lost keyboard focus');
    return {passed:true,dismiss,viewport:[innerWidth,innerHeight]};
  }
  const preference=localStorage.getItem('pain-sound-enabled');
  button.click();
  check(dialog.open&&!document.fullscreenElement&&video.playsInline,'Wrong fullscreen behavior');
  await until(()=>video.currentTime>0,'first decoded playback');
  const bufferedAtStart=video.buffered.length?video.buffered.end(video.buffered.length-1):0;
  const viewport=dialog.getBoundingClientRect();
  check(viewport.width<=innerWidth&&viewport.height<=innerHeight,'Dialog outside screen');
  video.pause();video.currentTime=12;
  await until(()=>!video.seeking,'seek');
  const quality=q=>dialog.querySelector(`[data-quality="${q}"]`).click();
  for(const q of ['1080','480'])quality(q);
  await until(()=>video.currentSrc.includes('pain-480')&&video.readyState>=2&&Math.abs(video.currentTime-12)<.3,'rapid quality switch preserved time');
  check(video.paused,'Paused playback unexpectedly restarted');
  await video.play();await until(()=>video.currentTime>12.2,'resume');
  quality('720');
  await until(()=>video.currentSrc.includes('pain-720')&&!video.paused&&video.currentTime>12.3,'playing quality switch');
  quality('1080');
  await until(()=>video.videoHeight===1080&&!video.paused&&video.currentTime>12.5,'1080p playback');
  if(dismiss==='watched') {
    video.currentTime=video.duration-.1;
    await until(()=>!dialog.open,'finish and return to globe');
  } else dialog.querySelector('.pain-video__close').click();
  await sleep(450);
  const entry=document.querySelector('#video-invitation');
  check(entry.classList.contains('video-invitation--docked') &&
    entry.parentElement.id==='ui-share-pain','Video invitation did not dock');
  check(localStorage.getItem('pain-video-intro-dismissed-v1')==='true','Dismissal not remembered');
  const dock=button.getBoundingClientRect();
  const share=document.querySelector('#ui-share-pain > .blob-button').getBoundingClientRect();
  check(dock.bottom<share.top && dock.width<=112,'Dock not above share button');
  check(getComputedStyle(dialog).borderTopWidth==='0px','Player still has a frame');
  const picker=document.querySelector('#ui-layer-stack');
  if(getComputedStyle(picker).visibility==='visible') check(picker.getBoundingClientRect().bottom <=
    document.querySelector('#ui-share-pain').getBoundingClientRect().top-10,'Dock overlaps layer buttons');
  for(const b of document.querySelectorAll('.blob-button--lower-label')) {
    const br=b.getBoundingClientRect(),lr=b.querySelector('.blob-button__label').getBoundingClientRect();
    check((lr.top+lr.height/2-br.top)/br.height>.53,'Action label did not move down');
  }
  check(!dialog.open&&video.paused&&!video.getAttribute('src'),'Close failed to release playback');
  check(localStorage.getItem('pain-sound-enabled')===preference,'Music preference changed');
  check(document.activeElement===button,'Focus not restored');
  const r=await fetch('/media/pain-480.mp4',{headers:{Range:'bytes=0-1023'}});
  check(r.status===206&&(await r.arrayBuffer()).byteLength===1024,'Server does not serve video byte ranges');
  return{passed:true,viewport:[innerWidth,innerHeight],button:[rect.x,rect.y,rect.width,rect.height],bufferedAtStart,duration:117.05,rangeStatus:r.status,festival:link.href};
 }catch(error){return{passed:false,error:String(error.stack??error),url:location.href,status:document.querySelector('#status')?.textContent}}
})()
