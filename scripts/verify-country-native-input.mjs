/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// Connect to an owned eval.mjs page with nativeInput=1. Uses the same Chrome DevTools transport.
// The caller keeps that page alive with window.finishNativeInput; no browser is launched here.
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("Provide the owned Chrome debug port");
const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const page = pages.find((p) => p.type === "page" &&
  p.url.startsWith("http://127.0.0.1:3000/") && p.url.includes("nativeInput=1"));
if (!page) throw Error("Owned native-input page unavailable");
const socket = new WebSocket(page.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data), resolve = pending.get(message.id);
  if (resolve) { pending.delete(message.id); resolve(message); }
};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
async function send(method, params = {}) {
  const id = ++sequence, reply = new Promise((resolve) => pending.set(id, resolve));
  socket.send(JSON.stringify({ id, method, params }));
  const message = await reply;
  if (message.error) throw Error(message.error.message);
  return message.result;
}
async function evaluate(expression) {
  const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? "Page expression failed");
  return reply.result?.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => { if (!condition) throw Error(message); };
const center = (selector) => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(getComputedStyle(e).visibility==='hidden'||!r.width)throw Error('Target hidden');return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const click = async (point) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
};
const key = async (key, code, windowsVirtualKeyCode, modifiers = 0, commands) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, modifiers, commands });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode, modifiers });
};
const positions = () => evaluate(`Object.fromEntries([...document.querySelectorAll('.emo-label')].map(e=>{const r=e.getBoundingClientRect();return [e.dataset.iso3,[r.x,r.y]]}))`);
const movement = (a, b) => Math.max(...Object.keys(a).map((id) => Math.hypot(b[id][0] - a[id][0], b[id][1] - a[id][1])));
let result;
try {
  await evaluate(`(() => {
    window.nativeInputEvidence={events:[],errors:[]};
    for(const type of ['pointerdown','wheel','keydown','touchstart']) document.addEventListener(type,e=>{
      setTimeout(()=>{if(nativeInputEvidence.events.length<50)nativeInputEvidence.events.push({type,trusted:e.isTrusted,prevented:e.defaultPrevented,target:e.target.tagName})},0);
    },true);
    window.addEventListener('error',e=>nativeInputEvidence.errors.push(e.message));
    window.addEventListener('unhandledrejection',e=>nativeInputEvidence.errors.push(String(e.reason)));
  })()`);
  let point = await center('.emo-label[data-iso3="IND"]');
  await click(point); await sleep(1600);
  check(await evaluate("!document.querySelector('#country-profile').hidden && document.querySelector('.country-profile__country').textContent==='India'"),
    "Native click did not select India");
  await click(await center('.emo-label[data-iso3="IND"]')); await sleep(900);
  check(await evaluate("document.querySelector('#country-profile').hidden"), "Native repeat click did not clear India");
  let before = await positions(); point = await center('.emo-label[data-iso3="IND"]');
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", ...point, deltaX: 0, deltaY: -180 });
  await sleep(800);
  const wheelMovement = movement(before, await positions());
  check(wheelMovement > 2, "Wheel over a label did not change the globe view");

  before = await positions(); point = await center('.emo-label[data-iso3="IND"]');
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 5; step++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + step * 15,
      y: point.y + step * 6, button: "left", buttons: 1 });
    await sleep(30);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + 75,
    y: point.y + 30, button: "left", buttons: 0, clickCount: 1 });
  await sleep(800);
  const dragMovement = movement(before, await positions());
  check(dragMovement > 5 && await evaluate("document.querySelector('#country-profile').hidden"),
    "Drag from a label failed or selected a country");
  await evaluate("document.activeElement?.blur()");
  await key("a", "KeyA", 65, 4, ["selectAll"]);
  await sleep(100);
  check(await evaluate("getSelection().rangeCount===0 && getSelection().toString()===''"), "Cmd+A selected artwork text");

  await evaluate("document.querySelector('#country-presentation-toggle').focus()");
  await key(" ", "Space", 32);
  await sleep(200);
  check(await evaluate("document.querySelector('#country-presentation-toggle').getAttribute('aria-pressed')==='true'"),
    "Keyboard did not start the cycle");
  await key(" ", "Space", 32);
  await sleep(1000);
  check(await evaluate("document.querySelector('#country-presentation-toggle').getAttribute('aria-pressed')==='false' && document.querySelector('#country-profile').hidden"),
    "Keyboard did not stop the cycle cleanly");

  before = await positions();
  const viewport = await evaluate("({x:innerWidth/2,y:innerHeight/2})");
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const fingers = (gap) => [{ id: 1, x: viewport.x - gap, y: viewport.y }, { id: 2, x: viewport.x + gap, y: viewport.y }];
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(35) });
  for (const gap of [45, 55, 65, 75]) {
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(gap) });
    await sleep(40);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(800);
  const pinchMovement = movement(before, await positions());
  check(pinchMovement > 2 && await evaluate("document.querySelector('#country-profile').hidden"),
    "Pinch did not zoom cleanly");
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });

  const evidence = await evaluate("({...nativeInputEvidence,scrollY,scrollTop:document.scrollingElement.scrollTop,viewportOffset:visualViewport.offsetTop})");
  check(evidence.errors.length === 0, "Browser errors: " + evidence.errors.join("; "));
  check(evidence.events.length > 0 && evidence.events.every((e) => e.trusted), "Input was not trusted browser input");
  check(evidence.events.some((e) => e.type === "wheel" && e.prevented && e.target === "CANVAS"), "Canvas wheel did not prevent page scrolling");
  check(evidence.scrollY === 0 && evidence.scrollTop === 0 && evidence.viewportOffset === 0, "The page moved during navigation");
  result = { passed: true, wheelMovement, dragMovement, pinchMovement, cmdA: "empty",
    keyboardCycle: true, repeatClear: true, evidence };
} catch (error) {
  result = { passed: false, error: error.stack, evidence: await evaluate("window.nativeInputEvidence") };
  process.exitCode = 1;
} finally {
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  console.log(JSON.stringify(result, null, 2));
  socket.send(JSON.stringify({ id: ++sequence, method: "Runtime.evaluate", params: { expression: "window.finishNativeInput?.()" } }));
  setTimeout(() => socket.close(), 100);
}
