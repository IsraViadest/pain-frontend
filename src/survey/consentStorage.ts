/**
 * Device-local survey consent flag.
 *
 * NOTE: consent is currently stored in localStorage (device-specific).
 * To switch to server-side storage, replace these three functions with API calls
 * without changing any other file.
 */
const CONSENT_STORAGE_KEY = "pain-consent-given";
const CONSENT_GIVEN_VALUE = "true";
const CONSENT_DECLINED_VALUE = "false";

/** True when this device has already recorded survey consent. */
export async function hasUserConsented(): Promise<boolean> {
  return localStorage.getItem(CONSENT_STORAGE_KEY) === CONSENT_GIVEN_VALUE;
}

/** Synchronous consent check for metrics calls that fire immediately. */
export function isConsentGiven(): boolean {
  return localStorage.getItem(CONSENT_STORAGE_KEY) === CONSENT_GIVEN_VALUE;
}

/** Persist consent on this device so the modal is skipped next time. */
export async function recordConsent(): Promise<void> {
  localStorage.setItem(CONSENT_STORAGE_KEY, CONSENT_GIVEN_VALUE);
}

/**
 * Record a decline so the modal is not shown again on this device.
 */
export async function recordDecline(): Promise<void> {
  localStorage.setItem(CONSENT_STORAGE_KEY, CONSENT_DECLINED_VALUE);
}
