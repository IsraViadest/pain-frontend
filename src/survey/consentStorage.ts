/*
 * File attribution
 * edited by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
/**
 * Device-local survey consent flag.
 *
 * Persist only the choice, never survey answers. Optional browser storage must not
 * prevent the artwork from starting or the user from making an explicit choice.
 */
const CONSENT_STORAGE_KEY = "pain-consent-given";
const CONSENT_GIVEN_VALUE = "true";
const CONSENT_DECLINED_VALUE = "false";
let pageChoice: boolean | undefined;
let memoryOnly = false;

/** True when this device has already recorded survey consent. */
export async function hasUserConsented(): Promise<boolean> {
  return isConsentGiven();
}

/** Synchronous consent check for metrics calls that fire immediately. */
export function isConsentGiven(): boolean {
  if (memoryOnly) return pageChoice ?? false;
  try {
    const given = localStorage.getItem(CONSENT_STORAGE_KEY) === CONSENT_GIVEN_VALUE;
    // Fresh reads observe another tab's revocation instead of retaining a stale approval.
    if (pageChoice !== undefined) pageChoice = given;
    return given;
  } catch {
    return pageChoice ?? false;
  }
}

function recordChoice(given: boolean): void {
  pageChoice = given;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, given ? CONSENT_GIVEN_VALUE : CONSENT_DECLINED_VALUE);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
}

if (typeof window !== "undefined") window.addEventListener("storage", (event) => {
  if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return;
  try { if (event.storageArea !== localStorage) return; } catch { return; }
  // A real cross-tab change supersedes a page-only choice after a failed storage write.
  pageChoice = undefined;
  memoryOnly = false;
});

/** Persist consent on this device so the modal is skipped next time. */
export async function recordConsent(): Promise<void> {
  recordChoice(true);
}

/**
 * Record a decline; the survey remains available without survey analytics.
 */
export async function recordDecline(): Promise<void> {
  recordChoice(false);
}
