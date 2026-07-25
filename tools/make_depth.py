#!/usr/bin/env python3
"""
Generate a heuristic depth map for the 3D-photo shader.

Heuristic (no ML model required, fully offline):
  depth = center-bias  +  luminance  (with bright sun/yellow masked to "far")
then normalised and blurred. White = near, black = far.

For higher fidelity, replace assets/depth.png with the output of a monocular
depth estimator (MiDaS, Depth-Anything, ...); the shader only needs white=near.

Usage:
  python3 tools/make_depth.py assets/photo.jpg [assets/depth.png]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def make_depth(src: str, dst: str) -> None:
    img = Image.open(src).convert("RGB")
    W, H = img.size
    a = np.asarray(img, dtype=np.float32) / 255.0
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.299 * R + 0.587 * G + 0.114 * B

    # bright-yellow (sun) mask -> forced far
    sun = ((R > 0.78) & (G > 0.55) & (B < 0.6)).astype(np.float32)
    sun = np.asarray(
        Image.fromarray((sun * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(25)
        ),
        dtype=np.float32,
    ) / 255.0

    # center gaussian: the subject sits near the middle (slightly high)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = 0.5 * W, 0.47 * H
    sx, sy = 0.30 * W, 0.34 * H
    center = np.exp(-(((xs - cx) ** 2) / (2 * sx * sx)
                      + ((ys - cy) ** 2) / (2 * sy * sy)))

    lum_masked = np.clip(lum - sun, 0.0, 1.0)
    depth = np.clip(0.60 * center + 0.62 * lum_masked, 0.0, 1.0)
    depth = depth * (1.0 - 0.85 * sun)  # push the sun far

    depth_img = Image.fromarray((depth * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(14)
    )
    d = np.asarray(depth_img, dtype=np.float32) / 255.0
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)  # normalise
    Image.fromarray((d * 255).astype(np.uint8)).save(dst)
    print(f"wrote {dst}  ({W}x{H})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else "assets/depth.png"
    make_depth(src, dst)
