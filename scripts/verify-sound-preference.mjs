/** created by: Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach */
// node --import tsx scripts/verify-sound-preference.mjs
import assert from 'node:assert/strict';
import { initBackgroundMusic, isSoundEnabled, setSoundEnabled, setBackgroundMusicSuppressed } from '../src/sound/backgroundMusic.ts';
globalThis.Audio = class { muted = false; play() { return Promise.resolve(); } };
globalThis.document = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
globalThis.localStorage = { getItem: () => 'true', setItem: () => { throw new Error('Storage denied'); } };
initBackgroundMusic();
assert(isSoundEnabled());
setSoundEnabled(false);
setBackgroundMusicSuppressed(true);
setBackgroundMusicSuppressed(false);
assert(!isSoundEnabled(), 'A stale stored value must not override the current mute choice');
setSoundEnabled(true);
assert(isSoundEnabled());
setBackgroundMusicSuppressed(true);
assert(!isSoundEnabled());
setBackgroundMusicSuppressed(false);
assert(isSoundEnabled());
console.log('Sound preference, suppression and denied storage PASS');
