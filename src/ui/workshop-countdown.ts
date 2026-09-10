/*
 * File attribution
 * created by Christian Stelmach (chrisp.stel@gmail.com), GitHub: @cstelmach
 */
const START = Date.parse("2026-09-11T12:00:00Z"); // Friday 14:00, Europe/Vienna.
const END = Date.parse("2026-09-11T14:00:00Z");

function workshopStatus(now: number): string | null {
  if (now >= END) return null;
  if (now >= START) return "Workshop in Progress";
  const seconds = Math.ceil((START - now) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
  if (hours >= 24) return `Starting in ${unit(Math.floor(hours / 24), "day")}, ${unit(hours % 24, "hour")}`;
  if (hours >= 1) return `Starting in ${unit(hours, "hour")}, ${unit(minutes % 60, "minute")}`;
  return `Starting in ${unit(minutes, "minute")}, ${unit(seconds % 60, "second")}`;
}

/** One body-free request every 30 minutes while visible; no new server endpoint or database work. */
export function mountWorkshopCountdown(link: HTMLElement, label: HTMLElement): void {
  link.hidden = true;
  let referenceTime = Date.now();
  let referenceTick = performance.now();
  let lastSync = -Infinity;
  let syncing = false;
  let finished = false;
  let initialized = false;
  const render = () => {
    if (!initialized) return;
    const text = workshopStatus(referenceTime + performance.now() - referenceTick);
    if (text === null) {
      finished = true;
      link.remove();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    } else {
      link.hidden = false;
      if (label.textContent !== text) label.textContent = text;
    }
  };
  const sync = async () => {
    if (syncing || finished || document.hidden || performance.now() - lastSync < 30 * 60_000) return;
    syncing = true;
    lastSync = performance.now();
    try {
      const response = await fetch("/", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000) });
      const date = Date.parse(response.headers.get("Date") ?? "");
      if (response.ok && Number.isFinite(date)) {
        referenceTime = date + (performance.now() - lastSync) / 2;
        referenceTick = performance.now();
      }
    } catch { /* Retain the current clock estimate when the network is unavailable. */ }
    finally { syncing = false; initialized = true; render(); }
  };
  const visible = () => { if (!document.hidden) { render(); void sync(); } };
  const timer = window.setInterval(visible, 1000);
  document.addEventListener("visibilitychange", visible);
  // Correct a wrong device date before deciding that the workshop has already ended.
  void sync();
}
