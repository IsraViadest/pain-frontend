"""Extract the moving film silhouette without changing any video pixels.

Requires the existing OpenCV and NumPy Python packages and ffprobe.
Run: /opt/homebrew/bin/python3.11 scripts/build-video-matte.py '/path/to/PAIN Animation.mp4'
After gzip decompression, each frame is a little-endian uint16 vertex count, then uint16 x,y
pixel pairs. Zero vertices means no signal above the black threshold. Coordinates use the
original video rectangle. Interior black areas are never removed.
"""
import argparse
from fractions import Fraction
import gzip
import json
from pathlib import Path
import struct
import subprocess
import tempfile

import cv2
import numpy as np


def build(source, target, tolerance=1.75):
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_frames',
        '-show_entries', 'stream=width,height,avg_frame_rate:frame=best_effort_timestamp_time',
        '-of', 'json', str(source),
    ]))
    stream = info['streams'][0]
    width, height = stream['width'], stream['height']
    fps = Fraction(stream['avg_frame_rate'])
    times = [float(frame['best_effort_timestamp_time']) for frame in info['frames']]
    start = times[0]
    if max(abs(time - start - i / float(fps)) for i, time in enumerate(times)) > 0.000002:
        raise ValueError('Frame-indexed mattes require constant frame rate and contiguous timestamps.')
    if max(width, height) > 65535:
        raise ValueError('The pixel-coordinate binary format supports dimensions below 65536.')

    cv2.setNumThreads(2)
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise ValueError('OpenCV cannot decode the source video.')
    exact = np.zeros((height, width), dtype=np.uint8)
    simplified = np.zeros_like(exact)
    counts, empty, worst_difference = [], [], 0.0
    component_frames, maximum_components, discarded_pixels = 0, 1, 0
    target.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pain-matte-') as scratch:
        temporary = Path(scratch) / 'pain-matte.bin'
        with temporary.open('wb') as output:
            while True:
                okay, frame = capture.read()
                if not okay:
                    break
                index = len(counts)
                foreground = cv2.bitwise_not(cv2.inRange(frame, (0, 0, 0), (4, 4, 4)))
                contours, _ = cv2.findContours(
                    foreground, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if not contours:
                    vertices = np.empty((0, 2), dtype='<u2')
                    empty.append(index)
                else:
                    contour = max(contours, key=cv2.contourArea)
                    kept = [contour]
                    for item in contours:
                        if item is contour:
                            continue
                        area = cv2.contourArea(item)
                        x, y, w, h = cv2.boundingRect(item)
                        # Only one/two-pixel near-black codec flecks may be dropped.
                        if area == 0 and w * h <= 2 and frame[y:y+h, x:x+w].max() <= 16:
                            discarded_pixels += w * h
                        else:
                            kept.append(item)
                    vertices = cv2.approxPolyDP(contour, tolerance, True).reshape(-1, 2)
                    for item in kept[1:]:
                        child = cv2.approxPolyDP(item, 0.35, True).reshape(-1, 2)
                        if len(child) < 3:
                            x, y, w, h = cv2.boundingRect(item)
                            child = np.array([[x, y], [x+w, y], [x+w, y+h], [x, y+h]])
                        nearest = np.argmin(np.sum((vertices - child[0]) ** 2, axis=1))
                        # The connector is traversed twice in opposite directions: zero filled area.
                        vertices = np.concatenate((vertices[:nearest+1], child, child[:1],
                                                   vertices[nearest:nearest+1], vertices[nearest+1:]))
                    if len(kept) > 1:
                        component_frames += 1
                    maximum_components = max(maximum_components, len(kept))
                    if len(vertices) < 3 or len(vertices) > 65535:
                        raise ValueError(f'Frame {index} has an unsupported outline.')
                    # RETR_EXTERNAL fills all interior holes. Black details remain inside the clip.
                    exact.fill(0)
                    simplified.fill(0)
                    for item in kept:
                        cv2.fillPoly(exact, [item], 255)
                    cv2.fillPoly(simplified, [vertices], 255)
                    difference = cv2.countNonZero(cv2.bitwise_xor(exact, simplified))
                    disagreement = difference / cv2.countNonZero(exact)
                    if disagreement > 0.006:
                        raise ValueError(f'Frame {index} exceeds 0.6% silhouette disagreement.')
                    worst_difference = max(worst_difference, disagreement)
                    vertices = vertices.astype('<u2')
                counts.append(len(vertices))
                output.write(struct.pack('<H', len(vertices)))
                output.write(vertices.tobytes())
                if len(counts) % 300 == 0:
                    print(f'{len(counts)}/{len(times)} frames, {output.tell():,} bytes', flush=True)
        capture.release()
        if len(counts) != len(times):
            raise ValueError(f'Decoded {len(counts)} frames but expected {len(times)}.')
        header = {
            'version': 1, 'width': width, 'height': height,
            'fpsNumerator': fps.numerator, 'fpsDenominator': fps.denominator,
            'startTime': start, 'frameCount': len(counts), 'binary': 'pain-matte.bin.gz',
            'compression': 'gzip',
            'format': 'uint16-le-count-then-xy', 'threshold': 4,
            'toleranceSourcePixels': tolerance,
            'verification': {
                'worstSilhouetteDisagreement': round(worst_difference, 8),
                'framesWithMultipleComponents': component_frames,
                'maximumComponents': maximum_components,
                'discardedNearBlackPixels': discarded_pixels,
                'maxVertices': max(counts), 'emptyFrames': empty,
            },
        }
        (target / 'pain-matte.bin.gz').write_bytes(gzip.compress(temporary.read_bytes(), mtime=0))
        (target / 'pain-matte.json').write_text(json.dumps(header, separators=(',', ':')) + '\n')
    print(json.dumps(header, indent=2))
    print(f"Compressed size: {(target / 'pain-matte.bin.gz').stat().st_size:,} bytes")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    build(args.source.resolve(strict=True), Path(__file__).resolve().parent.parent / 'public/media')
