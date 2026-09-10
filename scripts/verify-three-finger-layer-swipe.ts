/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// node --import tsx scripts/verify-three-finger-layer-swipe.ts
import assert from "node:assert/strict";
import { installThreeFingerLayerSwipe } from "../src/ui/three-finger-layer-swipe";

const surface = new EventTarget();
const browser = new EventTarget();
globalThis.window = browser as unknown as Window & typeof globalThis;
const controls = { enabled: true };
let layer = 4;
const changes: number[] = [];
const dispose = installThreeFingerLayerSwipe(surface as HTMLCanvasElement, controls, direction => {
  layer = (layer + direction + 5) % 5;
  changes.push(layer);
});
function pointer(type: string, id: number, x: number, y: number) {
  const event = new Event(type, {cancelable:true});
  Object.assign(event, {pointerId:id,pointerType:"touch",clientX:x,clientY:y});
  browser.dispatchEvent(event);
  if (type === "pointerdown") surface.dispatchEvent(event);
  return event;
}
function begin(count = 3) { for (let id=0;id<count;id++) pointer("pointerdown",id,100+id*20,100); }
function move(y: number, x = 100, count = 3) { for (let id=0;id<count;id++) pointer("pointermove",id,x+id*20,y); }
function end(y: number, x = 100, count = 3) { for (let id=0;id<count;id++) pointer("pointerup",id,x+id*20,y); }
function click(detail: number) {
  const event = new Event("click", {cancelable:true}); Object.assign(event,{detail});
  browser.dispatchEvent(event); return event;
}

begin(); assert.equal(controls.enabled,false);
move(170); assert.deepEqual(changes,[0],"Down from socioeconomic must wrap to all-pain");
move(250); assert.deepEqual(changes,[0],"One gesture must advance only once");
pointer("pointerup",0,100,250); assert.equal(controls.enabled,false);
pointer("pointerup",1,120,250); pointer("pointerup",2,140,250);
assert.equal(controls.enabled,true);
assert(click(1).defaultPrevented,"Gesture must not generate an accidental country click");
assert(!click(0).defaultPrevented,"Keyboard activation must remain available");
browser.dispatchEvent(new Event("pointerdown"));
assert(!click(1).defaultPrevented,"A fresh pointer sequence must restore button clicks");

begin(); move(20); end(20);
assert.deepEqual(changes,[0,4],"Up from all-pain must wrap to socioeconomic");
begin(2); move(200,100,2); end(200,100,2);
assert.equal(controls.enabled,true); assert.equal(changes.length,2,"Two-finger zoom stays unchanged");
begin(); pointer("pointermove",0,100,300);
assert.equal(changes.length,2,"One moving finger with two resting contacts is not a three-finger swipe");
pointer("pointercancel",0,100,300); pointer("pointercancel",1,120,100); pointer("pointercancel",2,140,100);
begin(); move(110,200); end(110,200);
assert.equal(changes.length,2,"Horizontal motion is not a layer swipe");
begin(4); move(200,100,4); end(200,100,4);
assert.equal(changes.length,2,"Four fingers must not accidentally change a layer");
begin(); pointer("pointercancel",0,100,100); move(200); end(200);
assert.equal(controls.enabled,true); assert.equal(changes.length,2);
begin(); browser.dispatchEvent(new Event("blur"));
assert.equal(controls.enabled,true,"Losing focus must restore OrbitControls");
controls.enabled=false; begin(); move(200); end(200);
assert.equal(controls.enabled,false,"An already disabled control must stay disabled");
controls.enabled=true; begin(); dispose();
assert.equal(controls.enabled,true);
begin(); move(200); end(200); assert.equal(changes.length,2,"Disposal removes the gesture listeners");
console.log("Three-finger wrap, reverse, cancellation, click guard and normal touch behavior PASS");
