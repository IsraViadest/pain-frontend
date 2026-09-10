/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
// Run: node --import tsx scripts/verify-workshop-countdown.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/ui/workshop-countdown.ts', import.meta.url), 'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const { workshopStatus, mountWorkshopCountdown } = new Function('exports', compiled +
  '; return {workshopStatus, mountWorkshopCountdown};')({});
const start = Date.parse('2026-09-11T14:00:00+02:00');
assert.equal(workshopStatus(start - 49 * 3600000), 'Starting in 2 days, 1 hour');
assert.equal(workshopStatus(start - 90 * 60000), 'Starting in 1 hour, 30 minutes');
assert.equal(workshopStatus(start - 61000), 'Starting in 1 minute, 1 second');
assert.equal(workshopStatus(start), 'Workshop in Progress');
assert.equal(workshopStatus(start + 2 * 3600000), null);
let ticks = 0, interval, requests = 0, removed = false;
globalThis.performance = { now: () => ticks };
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.window = { setInterval: fn => { interval = fn; return 1; } };
globalThis.fetch = async (_url, options) => {
  requests++;
  assert.equal(options.method, 'HEAD');
  assert.equal(options.cache, 'no-store');
  return { ok: true, headers: { get: () => new Date(start + ticks - 60000).toUTCString() } };
};
const label = { textContent: '' };
const link = { hidden: false, remove: () => { removed = true; } };
mountWorkshopCountdown(link, label);
assert(link.hidden, 'Do not briefly advertise an expired workshop before clock correction');
await new Promise(resolve => setImmediate(resolve));
assert(!link.hidden);
assert.equal(label.textContent, 'Starting in 1 minute, 0 seconds');
ticks = 1000; interval();
assert.equal(label.textContent, 'Starting in 0 minutes, 59 seconds');
assert.equal(requests, 1);
ticks = 30 * 60000; interval();
await new Promise(resolve => setImmediate(resolve));
assert.equal(requests, 2);
document.hidden = true; ticks += 30 * 60000; interval();
assert.equal(requests, 2);
document.hidden = false; ticks = 3 * 3600000; interval();
assert(removed);
console.log('Countdown boundaries, clock correction, request bounds PASS');
