type Matte = {
  width: number; height: number; frameCount: number;
  fpsNumerator: number; fpsDenominator: number; startTime: number;
  view: DataView; offsets: Uint32Array;
};
let cached: Promise<Matte> | undefined;

async function loadMatte(): Promise<Matte> {
  const response = await fetch('/media/pain-matte.json');
  if (!response.ok) throw new Error(`Video outline: ${response.status}`);
  const header = await response.json();
  if (header.binary !== 'pain-matte.bin.gz' || header.compression !== 'gzip' ||
      !Number.isInteger(header.frameCount) || header.frameCount < 1 || header.frameCount > 100_000 ||
      !Number.isFinite(header.startTime) ||
      !(header.width > 0 && header.height > 0 && header.fpsNumerator > 0 && header.fpsDenominator > 0)) {
    throw new Error('Invalid video outline metadata');
  }
  const binary = await fetch('/media/pain-matte.bin.gz');
  if (!binary.ok || !binary.body) throw new Error(`Video outline data: ${binary.status}`);
  let bytes = await binary.arrayBuffer();
  // Some static servers declare gzip over HTTP, so Fetch has already decoded the file.
  const signature = new Uint8Array(bytes);
  if (signature[0] === 0x1f && signature[1] === 0x8b) {
    bytes = await new Response(new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const view = new DataView(bytes), offsets = new Uint32Array(header.frameCount);
  let cursor = 0;
  for (let frame = 0; frame < header.frameCount; frame++) {
    offsets[frame] = cursor;
    const count = view.getUint16(cursor, true);
    if (count > 4096) throw new Error('Video outline exceeds vertex budget');
    cursor += 2 + count * 4;
    if (cursor > bytes.byteLength) throw new Error('Truncated video outline');
  }
  if (cursor !== bytes.byteLength) throw new Error('Video outline frame count mismatch');
  return { ...header, view, offsets };
}

/** Clip only the outer matte. The browser decodes and paints the original RGB video unchanged. */
export async function createVideoMatte(video: HTMLVideoElement) {
  const data = await (cached ??= loadMatte().catch(error => { cached = undefined; throw error; }));
  let callback: number | null = null;
  let active = false;
  let mediaTime = 0;
  const paint = () => {
    if (!active || !video.clientWidth || !video.clientHeight) return;
    const frame = Math.max(0, Math.min(data.frameCount - 1,
      Math.round((mediaTime - data.startTime) * data.fpsNumerator / data.fpsDenominator)));
    const offset = data.offsets[frame];
    const count = data.view.getUint16(offset, true);
    const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : data.width / data.height;
    const width = Math.min(video.clientWidth, video.clientHeight * aspect);
    const height = width / aspect;
    const left = (video.clientWidth - width) / 2, top = (video.clientHeight - height) / 2;
    const points: string[] = [];
    for (let i = 0; i < count; i++) {
      const x = data.view.getUint16(offset + 2 + i * 4, true);
      const y = data.view.getUint16(offset + 4 + i * 4, true);
      points.push(`${(left + x / data.width * width).toFixed(2)}px ${(top + y / data.height * height).toFixed(2)}px`);
    }
    video.style.clipPath = count ? `polygon(${points.join(',')})` : 'inset(100%)';
    video.dataset.matteFrame = String(frame);
  };
  const resize = new ResizeObserver(paint);
  const stop = () => {
    active = false;
    if (callback !== null) video.cancelVideoFrameCallback(callback);
    callback = null;
    resize.disconnect();
    video.style.clipPath = '';
    delete video.dataset.matteFrame;
  };
  return {
    start() {
      stop(); active = true; mediaTime = video.currentTime;
      paint(); resize.observe(video);
      const frame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        if (!active) return;
        mediaTime = metadata.mediaTime; paint();
        callback = video.requestVideoFrameCallback(frame);
      };
      callback = video.requestVideoFrameCallback(frame);
    },
    stop,
  };
}
