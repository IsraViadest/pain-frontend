import { isSoundEnabled } from "./backgroundMusic";

export const SOUND_BUTTON_BLOB = "/sounds/Button1.mp3";
export const SOUND_BUTTON_SURVEY_ARROW = "/sounds/Button2.mp3";
export const SOUND_BUTTON_SUBMIT = "/sounds/Button4.mp3";
export const SOUND_BUTTON_INFO = "/sounds/Button5.mp3";
export const SOUND_BUTTON_SHARE = "/sounds/Button6.mp3";

/**
 * Play a short UI button click sound when background music is unmuted.
 *
 * No-op when {@link isSoundEnabled} is false. Never throws.
 *
 * @param file — Public URL of the sound file (e.g. {@link SOUND_BUTTON_BLOB}).
 */
export function playButtonSound(file: string): void {
  if (!isSoundEnabled()) return;
  new Audio(file).play().catch((err) => {
    console.warn("[buttonSound] Failed to play sound:", err);
  });
}
