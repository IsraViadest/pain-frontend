// Run: node --import tsx scripts/verify-interaction-metrics.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MetricsQueue, VisibleDuration, textMetrics } from '../src/api/metricsQueue.ts';

const canary = 'PRIVATE answer 🫀 لا تحفظ';
let userId = '';
let consent = false;
let now = 0;
let succeeds = false;
const batches = [];
const beacons = [];
const queue = new MetricsQueue({
  tabId: 'd202e9bb-df5e-4393-a614-7d267a03057e', userId: () => userId,
  consent: () => consent, now: () => now,
  send: async batch => { batches.push(structuredClone(batch)); return succeeds; },
  beacon: batch => { beacons.push(structuredClone(batch)); return true; },
});
queue.push({ type: 'survey', target: 'survey-text', action: 'input', ...textMetrics(canary) });
queue.push({ type: 'window', target: 'result', action: 'open' });
assert.equal(queue.size, 0, 'Survey and result events require consent');
queue.push({ type: 'control', target: 'about', action: 'click', text: canary, value: canary, href: canary });
await queue.flush();
assert.equal(queue.size, 1, 'An interaction waits for registration');
assert.equal(batches.length, 0);
userId = 'AbCdEfGh01234567';
await queue.flush();
assert.equal(queue.size, 1, 'Failed requests retain events');
await queue.flush();
assert.equal(batches.length, 1, 'Failed requests back off');
now = 5000;
succeeds = true;
await queue.flush();
assert.deepEqual(batches[1], batches[0], 'Retry preserves tab id, sequence and body');
assert.equal(queue.size, 0);
assert.ok(!JSON.stringify(batches).includes(canary));

consent = true;
queue.push({ type: 'survey', target: 'survey-text', action: 'input', step: 5,
  ...textMetrics(canary), country: 'IND', emotion: '06_anger', layer: 'emopain',
  selectedWords: [canary], text: canary });
queue.flushOnHide();
assert.equal(queue.size, 1, 'Beacons retain unacknowledged events for a bfcache return');
const event = beacons[0].events[0];
assert.equal(event.characters, Array.from(canary).length);
assert.ok(event.hasText);
for (const field of ['country', 'emotion', 'layer', 'selectedWords', 'text']) assert.ok(!(field in event));
await queue.flush();
assert.deepEqual(batches.at(-1), beacons[0], 'Beacon and later acknowledged retry share dedup ids');
assert.equal(queue.size, 0);
assert.deepEqual(textMetrics('A🫀é'), { hasText: true, characters: 4 }, 'Count Unicode code points');

queue.push({ type: 'survey', target: 'survey', action: 'next', step: 1 });
consent = false;
await queue.flush();
assert.equal(queue.size, 0, 'Revocation removes queued survey events before transport');
queue.push({ type: 'control', target: canary, action: 'click' });
queue.push({ type: canary, target: 'about', action: 'click' });
assert.equal(queue.size, 0, 'Reject unrecognized event and target names');
for (let i = 0; i < 300; i++) queue.push({ type: 'country', target: 'country', action: 'open',
  country: 'IND', emotion: '06_anger', enabled: true, layer: 'all-layers',
  durationMs: 86400000, count: 10000, characters: 99999, selectedCount: 9999, hasText: true });
assert.equal(queue.size, 256);
assert.equal(queue.dropped, 44, 'Memory is bounded even when offline');
await queue.flush();
assert.equal(batches.at(-1).events.length, 32);
assert.ok(Buffer.byteLength(JSON.stringify(batches.at(-1))) < 16384, 'Largest batch fits server byte limit');
assert.ok(!('characters' in batches.at(-1).events[0]), 'Survey fields stay out of artwork events');

let clock = 0;
const visible = new VisibleDuration(() => clock);
visible.setVisible(true);
clock = 100;
visible.setVisible(false);
clock = 10000;
assert.equal(visible.read(), 100, 'Hidden-tab time is excluded');
visible.setVisible(true);
clock = 10150;
assert.equal(visible.read(), 250);
visible.setVisible(false);
visible.setVisible(false);
assert.equal(visible.read(), 250, 'Repeated lifecycle events do not count time twice');

// Test the actual compatibility adapter without Vite's import.meta.env or a browser.
const emitted = [];
const metricsSource = readFileSync(new URL('../src/api/metricsApi.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(metricsSource.replace(/^import .*;$/gm, '').replace(/^export .* from .*;$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = {
  exports: {}, useMockApi: false, crypto: { getRandomValues: bytes => bytes.fill(43) },
  getPainServerUserId: () => userId, isConsentGiven: () => true, setInterval: () => 1,
  MetricsQueue: class { size = 0; push(event) { emitted.push(event); } },
};
vm.runInNewContext(compiled, scope);
for (const kind of ['word', 'temporality', 'relation']) scope.exports.trackToggle(kind, canary, true);
scope.exports.trackToggle('category', `GRL:${canary}`, true);
scope.exports.trackToggle('category', 'emotion-filter:06_anger', false);
assert.ok(!JSON.stringify(emitted).includes(canary), 'Legacy hooks never serialize private labels or country names');
assert.equal(emitted.at(-2).country, 'GRL');
assert.equal(emitted.at(-1).emotion, '06_anger');

const surveyScreen = readFileSync(new URL('../src/survey/SurveyScreen5.ts', import.meta.url), 'utf8');
const surveyApi = readFileSync(new URL('../src/survey/surveyApi.ts', import.meta.url), 'utf8');
assert.doesNotMatch(surveyScreen, /console\.log|JSON\.stringify\(payload/);
assert.doesNotMatch(surveyApi, /res\.text\(|console\.[^(]+\([^;]*,\s*body/s);
assert.match(surveyApi, /body: JSON\.stringify\(\{/);
assert.match(surveyApi, /\.\.\.payload/);
assert.match(surveyApi, /consent: isConsentGiven\(\)/, 'Functional survey processing and consent are retained');

// Exercise lifecycle and delegated click/gesture handlers with DOM-shaped event targets.
class ElementNode extends EventTarget {
  constructor(tag = 'div', classes = []) {
    super(); this.tag = tag; this.classes = new Set(classes); this.dataset = {}; this.attributes = {};
    this.classList = { contains: value => this.classes.has(value) };
  }
  matches(selectors) {
    return selectors.split(',').some(selector => selector.startsWith('.') ? this.classes.has(selector.slice(1)) :
      selector.startsWith('[') || selector.startsWith(':') ? false : selector === this.tag);
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const documentStub = new EventTarget();
documentStub.body = new ElementNode(); documentStub.hidden = false;
const openModals = new Map();
documentStub.querySelector = selector => openModals.get(selector) ?? null;
const windowStub = new EventTarget();
const canvas = new ElementNode('canvas');
const activity = [];
const flushes = [];
let observe;
clock = 0;
let timerId = 0;
const timers = new Map();
const listenerSource = readFileSync(new URL('../src/api/interactionMetrics.ts', import.meta.url), 'utf8');
const listenerCompiled = ts.transpileModule(listenerSource.replace(/^import .*;$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const listenerScope = {
  exports: {}, AbortController, Element: ElementNode, document: documentStub, window: windowStub,
  performance: { now: () => clock }, queueMicrotask: fn => fn(),
  VisibleDuration: class extends VisibleDuration { constructor() { super(() => clock); } },
  trackInteraction: event => activity.push(event),
  flushInteractionMetrics: hiding => flushes.push(hiding), stopInteractionMetrics() {},
  MutationObserver: class { constructor(fn) { observe = fn; } observe() {} disconnect() {} },
  setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
  clearTimeout: id => timers.delete(id),
};
vm.runInNewContext(listenerCompiled, listenerScope);
const dispose = listenerScope.exports.installInteractionMetrics(canvas);
function dispatch(host, type, properties = {}) {
  const event = new Event(type);
  for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
  host.dispatchEvent(event);
}
const sourcesButton = new ElementNode('button'); sourcesButton.dataset.metricTarget = 'sources';
dispatch(documentStub, 'click', { target: sourcesButton });
const info = new ElementNode('div', ['info-modal', 'info-modal--visible']);
openModals.set('.info-modal--visible', info);
observe([{ type: 'childList', addedNodes: [info], removedNodes: [] }]);
clock = 1000; documentStub.hidden = true; dispatch(documentStub, 'visibilitychange');
clock = 10000; documentStub.hidden = false; dispatch(documentStub, 'visibilitychange');
clock = 11000; openModals.clear();
observe([{ type: 'childList', addedNodes: [], removedNodes: [info] }]);
assert.ok(activity.some(event => event.type === 'window' && event.action === 'close'), JSON.stringify(activity));
assert.equal(activity.find(event => event.type === 'window' && event.action === 'close').durationMs, 2000);
assert.equal(activity.find(event => event.type === 'window' && event.action === 'open').target, 'sources');
const screen = new ElementNode('div', ['survey-screen', 'survey-screen--1']);
const answer = new ElementNode('button'); answer.parent = screen; answer.dataset.word = canary;
answer.textContent = canary;
dispatch(documentStub, 'click', { target: answer });
assert.equal(activity.at(-1).step, 1);
assert.equal(activity.at(-1).count, 1);
assert.ok(!JSON.stringify(activity).includes(canary));
dispatch(canvas, 'pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
for (let i = 0; i < 100; i++) dispatch(windowStub, 'pointermove', { pointerId: 1, clientX: i, clientY: 0 });
clock += 1000;
dispatch(windowStub, 'pointerup', { pointerId: 1 });
assert.equal(activity.filter(event => event.target === 'globe-rotate').length, 1, 'A drag emits one aggregate, not 100 moves');
for (let i = 0; i < 100; i++) dispatch(canvas, 'wheel');
for (const fn of [...timers.values()]) fn();
assert.equal(activity.filter(event => event.target === 'globe-zoom').length, 1);
assert.equal(activity.at(-1).count, 100);
dispatch(windowStub, 'pagehide');
assert.equal(flushes.at(-1), true);
assert.equal(activity.at(-1).action, 'close');
dispose();

const modalSource = readFileSync(new URL('../src/survey/SurveyModal.ts', import.meta.url), 'utf8');
const modalCompiled = ts.transpileModule(modalSource.replace(/^import[\s\S]*?;\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const navigationEvents = [];
const modalScope = {
  exports: {}, VisibleDuration, SURVEY_FADE_MS: 240, document: { hidden: false },
  requestAnimationFrame: fn => fn(),
  trackSurveyStep: step => navigationEvents.push({ step, action: 'next' }),
  trackInteraction: event => navigationEvents.push(event),
};
vm.runInNewContext(modalCompiled, modalScope);
const modal = Object.create(modalScope.exports.SurveyModal.prototype);
let finishFade;
let mounts = 0;
Object.assign(modal, {
  isOpen: true, pendingScreen: null, navigationVersion: 1, currentScreen: 1,
  activeScreen: {}, screenDuration: new VisibleDuration(), metricDetails: () => ({ selectedCount: 2 }),
  screenHost: { classList: { add() {}, remove() {} } },
  wait: () => new Promise(resolve => { finishFade = resolve; }),
  unmountActiveScreen() {}, mountScreen2() { mounts++; },
});
const firstNavigation = modal.goToScreen(2);
await modal.goToScreen(2);
finishFade(); await firstNavigation;
assert.equal(mounts, 1, 'Repeated next clicks produce one screen transition');
assert.equal(navigationEvents.length, 1, 'Repeated next clicks do not falsely count extra completed steps');
modal.currentScreen = 1;
const canceledNavigation = modal.goToScreen(2);
modal.navigationVersion++; // The close/reopen invalidates the fade that was in progress.
modal.pendingScreen = null;
finishFade(); await canceledNavigation;
assert.equal(mounts, 1, 'An old transition cannot mount into a reopened survey');
if (process.argv[2]) {
  const { parseInteractionBatch } = await import(pathToFileURL(resolve(process.argv[2])).href);
  for (const batch of [...batches, ...beacons]) assert.ok(parseInteractionBatch(batch), 'Frontend batch must pass the actual server validator');
  console.log('Actual server interaction schema: PASS');
}
console.log('Interaction metrics: privacy, consent, retry/dedup, bounded batches, timers, gestures and survey transition races PASS');
