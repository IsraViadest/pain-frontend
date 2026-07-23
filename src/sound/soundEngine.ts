/**
 * Soft bell tones for globe pain-point clicks (Web Audio API).
 */

/** Base Hz for Emotional Pain (`emopain`) — warm, low. */
const LAYER_BASE_HZ_EMOPAIN = 220;
/** Base Hz for Environmental Pain (`envpain`) — deep, grounding. */
const LAYER_BASE_HZ_ENVPAIN = 180;
/** Base Hz for Physical Pain (`physpain`) — mid, clear. */
const LAYER_BASE_HZ_PHYSPAIN = 260;
/** Base Hz for Socio-economical Pain (`socioecopain`) — mid-low. */
const LAYER_BASE_HZ_SOCIOECOPAIN = 200;
/** Base Hz when `layerId` is not in {@link LAYER_BASE_HZ_BY_ID}. */
const LAYER_BASE_HZ_FALLBACK = 220;

/**
 * API layer id → oscillator base frequency (Hz).
 * Keys match pain-server GET `/init` `id` values; unknown ids use {@link LAYER_BASE_HZ_FALLBACK}.
 */
const LAYER_BASE_HZ_BY_ID: Readonly<Record<string, number>> = {
  emopain: LAYER_BASE_HZ_EMOPAIN,
  envpain: LAYER_BASE_HZ_ENVPAIN,
  physpain: LAYER_BASE_HZ_PHYSPAIN,
  socioecopain: LAYER_BASE_HZ_SOCIOECOPAIN,
};

/** Minimum gain (intensity 0) before intensity scale. */
const SOUND_GAIN_FLOOR = 0.1;
/** Extra gain added per unit intensity (0–1). */
const SOUND_GAIN_INTENSITY_SCALE = 0.6;

/** Pitch multiplier span: `baseHz * (1 + intensity * this)`. */
const SOUND_PITCH_INTENSITY_SCALE = 0.3;

/** Tone length at intensity 0 (seconds). */
const SOUND_DURATION_FLOOR_SEC = 0.4;
/** Extra duration added per unit intensity (seconds). */
const SOUND_DURATION_INTENSITY_SCALE_SEC = 0.8;

/** Linear attack to peak gain (seconds). */
const SOUND_ATTACK_SEC = 0.02;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function resolveBaseHz(layerId: string): number {
  return LAYER_BASE_HZ_BY_ID[layerId] ?? LAYER_BASE_HZ_FALLBACK;
}

/**
 * Play a soft sine bell for a pain-point click.
 *
 * Lazy-inits {@link AudioContext} on first call (user-gesture safe). Never throws.
 *
 * @param intensity — pain intensity (treated as ~0–1; not clamped so callers control range).
 * @param layerId — layer id from GET `/init` (e.g. `emopain`).
 */
export function playPainSound(intensity: number, layerId: string): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[soundEngine] AudioContext.resume failed: ${msg}`);
      });
    }

    const baseHz = resolveBaseHz(layerId);
    const freq = baseHz * (1 + intensity * SOUND_PITCH_INTENSITY_SCALE);
    const gainPeak = SOUND_GAIN_FLOOR + intensity * SOUND_GAIN_INTENSITY_SCALE;
    const durationSec =
      SOUND_DURATION_FLOOR_SEC + intensity * SOUND_DURATION_INTENSITY_SCALE_SEC;
    console.log("[soundEngine] playing", {
      layerId,
      intensity,
      baseHz,
      freq,
      gainPeak,
      durationSec,
    });
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + SOUND_ATTACK_SEC);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[soundEngine] playPainSound failed: ${msg}`);
  }
}
