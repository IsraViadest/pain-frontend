"""Build the video qualities and its first-frame silhouette. Requires ffmpeg and Pillow.

Run: python3 scripts/build-pain-video.py '/path/to/PAIN Animation.mp4'
"""
import argparse
import io
import json
from pathlib import Path
import struct
import subprocess
import tempfile

from PIL import Image, ImageChops, ImageDraw


def probe(source):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source),
    ]))


def simplify(points, tolerance=1.5):
    """Keep the actual concave silhouette while reducing the CSS polygon size."""
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    distances = []
    for x, y in points[1:-1]:
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / length)) if length else 0
        distances.append((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
    largest = max(distances)
    if largest <= tolerance * tolerance:
        return [points[0], points[-1]]
    split = distances.index(largest) + 1
    return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)


def poster(source, destination, outline):
    frame = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-threads', '2', '-i', str(source),
        '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-',
    ])
    image = Image.open(io.BytesIO(frame)).convert('RGB')
    red, green, blue = image.split()
    mask = ImageChops.lighter(ImageChops.lighter(red, green), blue).point(
        lambda value: 0 if value <= 8 else 255)
    # Flood only connected outer black. Dark islands inside the artwork remain opaque.
    ImageDraw.floodfill(mask, (0, 0), 128)
    mask = mask.point(lambda value: 0 if value == 128 else 255)
    bounds = mask.getbbox()
    if not bounds or bounds == (0, 0, image.width, image.height):
        raise ValueError('The first frame needs an isolated silhouette against a black background.')
    image = image.crop(bounds).convert('RGBA')
    mask = mask.crop(bounds)
    width, height = image.size
    pixels = mask.load()
    top, bottom = [], []
    for x in range(width):
        occupied = [y for y in range(height) if pixels[x, y]]
        if not occupied:
            raise ValueError('The silhouette is disconnected.')
        first, last = occupied[0], occupied[-1]
        if len(occupied) != last - first + 1:
            raise ValueError('The silhouette must have a single solid span in every column.')
        top.append((x, first))
        bottom.append((x, last))
    points = simplify(top) + simplify(bottom[::-1])
    # At the rendered button size the error is far below one CSS pixel.
    polygon = Image.new('L', image.size)
    ImageDraw.Draw(polygon).polygon(points, fill=255)
    disagreement = sum(value > 0 for value in ImageChops.difference(mask, polygon).tobytes())
    if disagreement / (width * height) > 0.006:
        raise ValueError('The simplified outline no longer follows the first frame.')
    image.putalpha(polygon)
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    image.save(destination, 'WEBP', quality=88, method=6)
    css = ', '.join(f'{100 * x / (width - 1):.3f}% {100 * y / (height - 1):.3f}%'
                    for x, y in points)
    outline.write_text(
        '// Generated from the first video frame by scripts/build-pain-video.py.\n'
        f"export const VIDEO_POSTER_CLIP = 'polygon({css})';\n"
        f'export const VIDEO_POSTER_ASPECT = {width / height:.8f};\n')
    print(f'poster: crop={bounds}, size={image.size}, outline={len(points)} points, '
          f'mask disagreement={disagreement / (width * height):.4%}', flush=True)


def validate_video(source, duration, height):
    info = probe(source)
    video = next(stream for stream in info['streams'] if stream['codec_type'] == 'video')
    assert video['codec_name'] == 'h264' and video['pix_fmt'] == 'yuv420p'
    assert video['height'] == height and video['width'] % 2 == 0
    assert abs(float(info['format']['duration']) - duration) < 0.15
    assert source.stat().st_size < 100_000_000
    atoms = []
    with source.open('rb') as media:
        while header := media.read(8):
            size, kind = struct.unpack('>I4s', header)
            consumed = 8
            if size == 1:
                size = struct.unpack('>Q', media.read(8))[0]
                consumed = 16
            atoms.append(kind)
            if size == 0:
                break
            media.seek(size - consumed, 1)
    assert atoms.index(b'moov') < atoms.index(b'mdat'), 'Metadata must precede media for fast startup.'
    return info['format']['duration'], source.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    root = Path(__file__).resolve().parent.parent
    target = root / 'public/media'
    target.mkdir(exist_ok=True)
    duration = float(probe(source)['format']['duration'])
    with tempfile.TemporaryDirectory(prefix='pain-video-') as scratch:
        temporary = Path(scratch)
        poster(source, target / 'pain-poster.webp', root / 'src/ui/video-outline.generated.ts')
        for height, bitrate in [(480, 900), (720, 2000), (1080, 4000)]:
            encoded = temporary / f'pain-{height}.mp4'
            subprocess.run([
                'ffmpeg', '-v', 'warning', '-nostdin', '-threads', '2', '-i', str(source),
                '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1',
                '-vf', f'scale=-2:{height}:flags=lanczos', '-filter_threads', '2',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-threads', '2',
                '-pix_fmt', 'yuv420p', '-maxrate', f'{bitrate}k', '-bufsize', f'{2 * bitrate}k',
                '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
                '-force_key_frames', 'expr:gte(t,n_forced*2)',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(encoded),
            ], check=True)
            actual_duration, size = validate_video(encoded, duration, height)
            encoded.replace(target / encoded.name)
            print(f'{height}p: {size / 1_000_000:.2f} MB, {actual_duration}s, moov first: PASS', flush=True)


if __name__ == '__main__':
    main()
