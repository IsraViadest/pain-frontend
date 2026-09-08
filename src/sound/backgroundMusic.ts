const SOUND_ENABLED_KEY = "pain-sound-enabled";
const BACKGROUND_MUSIC_SRC = "/sounds/BackgroundPPP.mp3";

let audio: HTMLAudioElement | null = null;
let unlockListenersAttached = false;
let suppressed = false;

function readPreference(): boolean {
  const value = localStorage.getItem(SOUND_ENABLED_KEY);
  if (value === null) return true;
  return value === "true";
}

function writePreference(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "true" : "false");
}

function removeUnlockListeners(): void {
  if (!unlockListenersAttached) return;
  unlockListenersAttached = false;
  document.removeEventListener("click", onUserGestureUnlock);
  document.removeEventListener("touchstart", onUserGestureUnlock);
}

function onUserGestureUnlock(): void {
  if (!audio || suppressed || !readPreference() || !audio.muted) return;
  audio.muted = false;
  void audio.play().then(() => {
    removeUnlockListeners();
    document.dispatchEvent(new CustomEvent("backgroundMusicStateChanged"));
  }).catch(() => {
    if (audio) audio.muted = true;
  });
}

function attachUnlockListeners(): void {
  if (unlockListenersAttached) return;
  unlockListenersAttached = true;
  document.addEventListener("click", onUserGestureUnlock);
  document.addEventListener("touchstart", onUserGestureUnlock);
}

/** Create looping background audio and attempt autoplay per saved preference. */
export function initBackgroundMusic(): void {
  if (audio) return;

  audio = new Audio(BACKGROUND_MUSIC_SRC);
  audio.loop = true;
  audio.preload = "auto";
  const wantEnabled = readPreference();
  audio.muted = suppressed || !wantEnabled;
  attachUnlockListeners();
  void audio.play().catch(() => {
    if (!audio) return;
    audio.muted = true;
    void audio.play().catch(() => {});
  });
}

/** True when background music is currently unmuted. */
export function isSoundEnabled(): boolean {
  return audio !== null && !audio.muted;
}

/** Mute or unmute background music and persist the user preference. */
export function setSoundEnabled(enabled: boolean): void {
  if (!audio) {
    initBackgroundMusic();
  }
  if (!audio) return;

  audio.muted = suppressed || !enabled;
  writePreference(enabled);

  if (enabled) {
    void audio.play().catch(() => {});
  }
}

/** Video temporarily owns audio without changing the visitor's saved music preference. */
export function setBackgroundMusicSuppressed(value: boolean): void {
  suppressed = value;
  if (audio) audio.muted = suppressed || !readPreference();
  document.dispatchEvent(new CustomEvent("backgroundMusicStateChanged"));
}
