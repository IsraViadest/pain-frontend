import "./festival-media.css";
import { VIDEO_POSTER_CLIP, VIDEO_POSTER_ASPECT } from "./video-outline.generated";
import { setBackgroundMusicSuppressed } from "../sound/backgroundMusic";
import { METRICS_KIND_CATEGORY, trackToggle } from "../api/metricsApi";

const FESTIVAL_URL = "https://ars.electronica.art/negotiatinghumanity/en/view/p-a-i-n-personal-and-interconnected-with-nature-38e38ddb450c813fb61cf19ba69e41af/";
const INTRO_KEY = "pain-video-intro-dismissed-v1";

/** First-visit invitation, persistent replay button and a native, on-demand video stage. */
export function mountFestivalMedia(host: HTMLElement): HTMLButtonElement {
  const app = document.getElementById("app")!;
  const share = document.getElementById("ui-share-pain")!;
  const query = new URLSearchParams(location.search);
  const row = document.createElement("div");
  row.className = "festival-media";
  row.id = "festival-media";
  const link = document.createElement("a");
  link.className = "festival-media__link";
  link.href = FESTIVAL_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const logo = document.createElement("img");
  logo.src = "/logos/ars-electronica.png";
  logo.alt = "";
  logo.width = logo.height = 28;
  const invitation = document.createElement("span");
  invitation.textContent = "Visit us at the Ars Electronica Festival ↗";
  link.append(logo, invitation);
  link.addEventListener("click", () => trackToggle(METRICS_KIND_CATEGORY, "festival:visit", true));
  row.append(link);
  host.append(row);

  const entry = document.createElement("div");
  entry.id = "video-invitation";
  entry.className = "video-invitation";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "festival-media__play";
  trigger.style.clipPath = VIDEO_POSTER_CLIP;
  trigger.style.aspectRatio = String(VIDEO_POSTER_ASPECT);
  trigger.textContent = "▶ Start video";
  trigger.setAttribute("aria-label", "Start P.A.I.N. video");
  const silhouette = document.createElement("span");
  silhouette.className = "festival-media__silhouette";
  silhouette.append(trigger);
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "video-invitation__skip";
  skip.textContent = "Skip video";
  entry.append(silhouette, skip);
  app.append(entry);

  const dialog = document.createElement("dialog");
  dialog.className = "pain-video";
  dialog.dataset.surface = query.get("cpVideo") === "black" ? "black" : "theme";
  dialog.setAttribute("aria-label", "P.A.I.N. video player");
  const video = document.createElement("video");
  video.controls = false;
  video.playsInline = true;
  video.preload = "none";
  video.width = 1920;
  video.height = 1080;
  video.setAttribute("aria-label", "P.A.I.N. animation");
  const toolbar = document.createElement("div");
  toolbar.className = "pain-video__toolbar";
  const qualities = document.createElement("div");
  qualities.className = "pain-video__qualities";
  qualities.setAttribute("role", "group");
  qualities.setAttribute("aria-label", "Video quality");
  let quality = matchMedia("(max-width: 600px)").matches ? 480 : 720;
  const qualityButtons = new Map<number, HTMLButtonElement>();
  for (const size of [480, 720, 1080]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${size}p`;
    button.dataset.quality = String(size);
    button.setAttribute("aria-label", `${size}p video quality`);
    button.setAttribute("aria-pressed", String(size === quality));
    button.style.clipPath = VIDEO_POSTER_CLIP;
    button.addEventListener("click", () => changeQuality(size));
    qualities.append(button);
    qualityButtons.set(size, button);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Back to globe";
  close.className = "pain-video__close";
  close.setAttribute("aria-label", "Close video");
  close.style.clipPath = VIDEO_POSTER_CLIP;
  toolbar.append(qualities, close);
  const status = document.createElement("p");
  status.className = "pain-video__status";
  status.setAttribute("role", "status");
  const transport = document.createElement("div");
  transport.className = "pain-video__transport";
  const playback = document.createElement("button");
  playback.type = "button";
  playback.style.clipPath = VIDEO_POSTER_CLIP;
  const mute = document.createElement("button");
  mute.type = "button";
  mute.style.clipPath = VIDEO_POSTER_CLIP;
  const seek = document.createElement("input");
  seek.type = "range"; seek.min = "0"; seek.max = "0"; seek.step = "0.1"; seek.disabled = true;
  seek.setAttribute("aria-label", "Video position");
  const elapsed = document.createElement("output");
  const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const syncTransport = () => {
    playback.textContent = video.paused ? "Play" : "Pause";
    playback.setAttribute("aria-label", `${playback.textContent} video`);
    mute.textContent = video.muted ? "Unmute" : "Mute";
    mute.setAttribute("aria-label", `${mute.textContent} video`);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.disabled = duration === 0; seek.max = String(duration); seek.value = String(video.currentTime);
    seek.setAttribute("aria-valuetext", `${time(video.currentTime)} of ${time(duration)}`);
    elapsed.textContent = `${time(video.currentTime)} / ${time(duration)}`;
  };
  playback.addEventListener("click", () => { if (video.paused) play(); else video.pause(); });
  mute.addEventListener("click", () => { video.muted = !video.muted; });
  seek.addEventListener("input", () => { video.currentTime = Number(seek.value); });
  for (const event of ["play", "pause", "timeupdate", "loadedmetadata", "volumechange", "emptied"]) {
    video.addEventListener(event, syncTransport);
  }
  syncTransport();
  transport.append(playback, seek, elapsed, mute);
  dialog.append(video, toolbar, status, transport);
  document.body.append(dialog);

  const forceIntro = query.get("cpVideoIntro") === "1";
  let docked = false;
  const placeIntro = () => {
    if (!docked) entry.style.bottom = `${innerHeight - share.getBoundingClientRect().top + 16}px`;
  };
  const bounds = new ResizeObserver(placeIntro);
  bounds.observe(share);
  window.addEventListener("resize", placeIntro);
  const dock = (reason: string, persist = true) => {
    if (docked) return;
    const before = silhouette.getBoundingClientRect();
    docked = true;
    bounds.disconnect();
    window.removeEventListener("resize", placeIntro);
    document.removeEventListener("click", outside);
    entry.classList.add("video-invitation--docked");
    entry.style.bottom = "";
    skip.hidden = true;
    share.classList.add("ui-share-pain--with-video");
    app.classList.add("has-docked-video");
    share.append(entry);
    if (persist) {
      localStorage.setItem(INTRO_KEY, "true");
      trackToggle(METRICS_KIND_CATEGORY, `media:intro:${reason}`, false);
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const after = entry.getBoundingClientRect();
        entry.animate([
          { transform: `translate(${before.left-after.left}px, ${before.top-after.top}px) scale(${before.width/after.width}, ${before.height/after.height})` },
          { transform: "none" },
        ], { duration: 350, easing: "cubic-bezier(.22,.61,.36,1)" });
      }
    }
  };
  const outside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!entry.contains(target) && !dialog.contains(target)) dock("outside");
  };
  document.addEventListener("click", outside);
  skip.addEventListener("click", () => {
    dock("skipped");
    trigger.focus({ preventScroll: true });
  });
  window.addEventListener("storage", (event) => {
    if (!forceIntro && event.key === INTRO_KEY && event.newValue === "true") dock("other-tab", false);
  });
  placeIntro();
  if (!forceIntro && localStorage.getItem(INTRO_KEY) === "true") dock("return-visit", false);

  let restorePosition: (() => void) | null = null;
  let pendingQuality: { time: number; paused: boolean; rate: number } | null = null;
  const cancelRestore = () => {
    if (restorePosition) video.removeEventListener("loadedmetadata", restorePosition);
    restorePosition = null;
  };
  const play = () => { void video.play().catch((error: DOMException) => {
    if (dialog.open && error.name !== "AbortError") status.textContent = "Press play to start the video.";
  }); };
  type VideoMatte = Awaited<ReturnType<typeof import("./video-matte")["createVideoMatte"]>>;
  let matte: VideoMatte | null = null;
  let matteReady: Promise<VideoMatte> | null = null;
  let opening = 0;
  let matteError = "";
  trigger.addEventListener("click", () => {
    if (dialog.open) return;
    const revision = ++opening;
    matteError = "";
    dialog.dataset.matte = "loading";
    dialog.showModal();
    if (dialog.dataset.surface === "theme") {
      matteReady ??= import("./video-matte").then(({ createVideoMatte }) => createVideoMatte(video));
      void matteReady.then((mask) => {
        matte = mask;
        if (dialog.open && revision === opening) {
          mask.start(); dialog.dataset.matte = "ready";
        }
      }).catch((error) => {
        matteReady = null;
        if (dialog.open && revision === opening) {
          video.pause();
          matteError = "Could not load the video outline. Please close and retry.";
          status.textContent = matteError;
          console.error(error);
        }
      });
    }
    setBackgroundMusicSuppressed(true);
    status.textContent = "Loading video…";
    video.src = `/media/pain-${quality}.mp4`;
    video.preload = "auto";
    play();
    trackToggle(METRICS_KIND_CATEGORY, "media:video", true);
  });
  function changeQuality(size: number): void {
    if (size === quality) return;
    quality = size;
    for (const [value, button] of qualityButtons) button.setAttribute("aria-pressed", String(value === quality));
    const state = pendingQuality ?? { time: video.currentTime, paused: video.paused, rate: video.playbackRate };
    cancelRestore();
    pendingQuality = state;
    restorePosition = () => {
      cancelRestore();
      pendingQuality = null;
      video.currentTime = Math.min(state.time, video.duration);
      video.playbackRate = state.rate;
      if (!state.paused) play();
    };
    video.addEventListener("loadedmetadata", restorePosition);
    status.textContent = "Changing quality…";
    video.src = `/media/pain-${quality}.mp4`;
    video.load();
    trackToggle(METRICS_KIND_CATEGORY, `media:quality:${quality}`, true);
  }
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    opening++;
    matte?.stop();
    cancelRestore();
    pendingQuality = null;
    video.pause();
    video.removeAttribute("src");
    video.preload = "none";
    video.load();
    setBackgroundMusicSuppressed(false);
    dock("skipped");
    trigger.focus({ preventScroll: true });
    trackToggle(METRICS_KIND_CATEGORY, "media:video", false);
  });
  video.addEventListener("ended", () => { dock("watched"); dialog.close(); });
  video.addEventListener("waiting", () => { status.textContent = "Buffering…"; });
  video.addEventListener("playing", () => { status.textContent = matteError; });
  video.addEventListener("canplay", () => { status.textContent = matteError; });
  video.addEventListener("error", () => {
    if (dialog.open) status.textContent = "Could not load this video. Please choose another quality or reopen it.";
  });
  return trigger;
}
