#!/usr/bin/env python3
"""ascii_tool.py — soulful middle-ground ASCII art: image conversion, rendering, calm looping animation.

Run zero-install:  uv run --with pillow --with numpy python ascii_tool.py <cmd> ...

Subcommands
  image   IN  [--out OUT.png | --txt]  conversion (dual-channel: luminance ramp + Sobel edges)
  render  IN.txt OUT.png               render an existing ascii text grid to PNG
  animate OUTDIR                       seamless looping flow-field frame sequence (PNGs)

Greyscale only: glyphs are drawn in graded shades of grey (denser glyph = brighter) on near-black,
which gives tonal depth without colour. The signature is the dual-channel image converter: a
luminance ramp for fills PLUS a Sobel edge pass that lays directional glyphs ( | / - \\ ) along
contours, so the characters and the image read together.
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# --- curated ramps (light -> dense) -----------------------------------------------------------
RAMPS = {
    "mono10": " .:-=+*#%@",
    "fine":   " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@",
    "calm":   " .·:-=",
    "drift":  " .·:*+",
    "soft":   " .:-=+*#",
    "blocks": " ░▒▓█",
    "web":    " .:;/<>=?*T%&#@N",   # web/code symbols + N T, coverage-ordered
}
# animation presets (greyscale): ramp, density 0..1, warp radius in noise units
PRESETS = {
    "calm":  ("calm",  0.45, 0.50),
    "drift": ("drift", 0.55, 0.60),
    "soft":  ("soft",  0.50, 0.45),
    "mono":  ("mono10", 0.60, 0.40),
}
BG = "#0a0a0a"
SHADE_FLOOR = 0.32   # dimmest grey so sparse glyphs never vanish


def hexrgb(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def grey(intensity):
    g = int(round(255 * (SHADE_FLOOR + (1 - SHADE_FLOOR) * max(0.0, min(1.0, intensity)))))
    return (g, g, g)


def load_font(path, size):
    candidates = [path] if path else []
    candidates += [
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/Library/Fonts/JetBrainsMono-Regular.ttf",
        "/Library/Fonts/Iosevka-Regular.ttf",
        "DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ]
    for c in candidates:
        if not c:
            continue
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()


# --- core conversion --------------------------------------------------------------------------
def _conv2(a, k):
    p = np.pad(a, 1, mode="edge")
    out = np.zeros_like(a)
    for dy in range(3):
        for dx in range(3):
            out += k[dy, dx] * p[dy:dy + a.shape[0], dx:dx + a.shape[1]]
    return out


def image_to_grid(img, cols, ramp, edges=True, edge_threshold=0.18, invert=False,
                  aspect=0.5, contrast=1.1):
    """Return (char grid, intensity grid). Intensity 0..1 drives the grey shade."""
    img = img.convert("RGB")
    w, h = img.size
    rows = max(1, int(round(cols * (h / w) * aspect)))
    small = img.resize((cols, rows), Image.LANCZOS)
    arr = np.asarray(small).astype(np.float32) / 255.0
    lum = 0.3 * arr[..., 0] + 0.59 * arr[..., 1] + 0.11 * arr[..., 2]
    lum = np.clip((lum - 0.5) * contrast + 0.5, 0, 1)
    lum = 0.06 + 0.94 * lum
    v = lum if invert else (1.0 - lum)          # high => dark image => dense glyph
    ramp_s = RAMPS.get(ramp, ramp)
    n = len(ramp_s) - 1
    idx = np.clip((v * n).astype(int), 0, n)
    grid = [[ramp_s[idx[y, x]] for x in range(cols)] for y in range(rows)]
    intens = (idx.astype(np.float32) / max(n, 1))

    if edges:
        gx = _conv2(lum, np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], np.float32))
        gy = _conv2(lum, np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], np.float32))
        mag = np.sqrt(gx * gx + gy * gy)
        m = mag.max()
        if m > 0:
            mag /= m
        for y in range(rows):
            for x in range(cols):
                if mag[y, x] >= edge_threshold:
                    deg = (math.degrees(math.atan2(gy[y, x], gx[y, x])) + 90) % 180
                    grid[y][x] = "-" if (deg < 22.5 or deg >= 157.5) else \
                                 "/" if deg < 67.5 else "|" if deg < 112.5 else "\\"
                    intens[y, x] = max(intens[y, x], 0.85)   # edges read crisp
    return grid, intens


# --- rendering --------------------------------------------------------------------------------
def render_grid(grid, font, cell, bg=BG, intens=None, fg=None, pad=24):
    rows, cols = len(grid), max(len(r) for r in grid)
    cw, ch = cell, int(round(cell * 2.0))
    img = Image.new("RGB", (cols * cw + pad * 2, rows * ch + pad * 2), hexrgb(bg))
    d = ImageDraw.Draw(img)
    flat = hexrgb(fg) if fg else (220, 220, 220)
    for y, row in enumerate(grid):
        for x, ch_ in enumerate(row):
            if ch_ == " ":
                continue
            col = grey(float(intens[y][x])) if intens is not None else flat
            d.text((pad + x * cw, pad + y * ch), ch_, fill=col, font=font, anchor="lt")
    return img


def grid_to_text(grid):
    return "\n".join("".join(r) for r in grid)


# --- animation: calm seamless looping flow field ----------------------------------------------
def _value_noise(seed=7, n=64):
    rng = np.random.default_rng(seed)
    lat = rng.random((n, n)).astype(np.float32)

    def sample(X, Y):
        xi, yi = np.floor(X).astype(int), np.floor(Y).astype(int)
        xf, yf = X - xi, Y - yi
        s = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
        u, vv = s(xf), s(yf)
        x0, x1, y0, y1 = xi % n, (xi + 1) % n, yi % n, (yi + 1) % n
        c00, c10, c01, c11 = lat[y0, x0], lat[y0, x1], lat[y1, x0], lat[y1, x1]
        return (c00 * (1 - u) + c10 * u) * (1 - vv) + (c01 * (1 - u) + c11 * u) * vv
    return sample


def animate_field(cols, rows, frames, preset="calm", seed=7):
    """Calm, seamless loop: the sample point traces a SMALL circle in noise space (radius=warp),
    so motion is a gentle drift and the loop closes without a seam. Smoothness scales with frames."""
    ramp, density, warp = PRESETS.get(preset, PRESETS["calm"])
    ramp_s = RAMPS[ramp]
    n = len(ramp_s) - 1
    sample = _value_noise(seed=seed)
    xs = np.linspace(0, 6, cols)[None, :].repeat(rows, 0)
    ys = np.linspace(0, 6 * rows / cols * 2, rows)[:, None].repeat(cols, 1)
    out = []
    for f in range(frames):
        t = 2 * math.pi * f / frames
        ox, oy = warp * math.cos(t), warp * math.sin(t)                 # gentle drift
        ox2, oy2 = warp * math.cos(t + 2.0), warp * math.sin(t + 2.0)   # 2nd octave, phase-shifted
        a = sample(xs + ox, ys + oy)
        b = sample(xs * 2.0 + ox2, ys * 2.0 + oy2)
        field = np.clip(0.65 * a + 0.35 * b, 0, 1)
        field = np.clip((field - (1 - density)) / max(density, 1e-3), 0, 1)
        idx = np.clip((field * n).astype(int), 0, n)
        grid = [[ramp_s[idx[y, x]] for x in range(cols)] for y in range(rows)]
        out.append((grid, field.astype(np.float32)))
    return out


# --- CLI --------------------------------------------------------------------------------------
def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    im = sub.add_parser("image")
    im.add_argument("input")
    im.add_argument("--out")
    im.add_argument("--txt", action="store_true")
    im.add_argument("--width", type=int, default=100)
    im.add_argument("--ramp", default="mono10")
    im.add_argument("--no-edges", action="store_true")
    im.add_argument("--edge-threshold", type=float, default=0.18)
    im.add_argument("--invert", action="store_true")
    im.add_argument("--contrast", type=float, default=1.1)
    im.add_argument("--flat", action="store_true", help="flat grey instead of graded shades")
    im.add_argument("--font", default="")
    im.add_argument("--cell", type=int, default=12)

    rd = sub.add_parser("render")
    rd.add_argument("input")
    rd.add_argument("output")
    rd.add_argument("--fg", default="#dcdcdc")
    rd.add_argument("--font", default="")
    rd.add_argument("--cell", type=int, default=12)

    an = sub.add_parser("animate")
    an.add_argument("outdir")
    an.add_argument("--cols", type=int, default=120)
    an.add_argument("--rows", type=int, default=48)
    an.add_argument("--frames", type=int, default=150)
    an.add_argument("--preset", default="calm")
    an.add_argument("--seed", type=int, default=7)
    an.add_argument("--flat", action="store_true")
    an.add_argument("--font", default="")
    an.add_argument("--cell", type=int, default=12)

    a = p.parse_args()

    if a.cmd == "image":
        grid, intens = image_to_grid(Image.open(a.input), a.width, a.ramp,
                                     edges=not a.no_edges, edge_threshold=a.edge_threshold,
                                     invert=a.invert, contrast=a.contrast)
        if a.txt:
            print(grid_to_text(grid))
            return
        out = a.out or (os.path.splitext(a.input)[0] + "-ascii.png")
        font = load_font(a.font, a.cell * 2)
        render_grid(grid, font, a.cell, intens=None if a.flat else intens).save(out)
        print(out)

    elif a.cmd == "render":
        grid = [list(line) for line in open(a.input).read().splitlines()]
        font = load_font(a.font, a.cell * 2)
        render_grid(grid, font, a.cell, fg=a.fg).save(a.output)
        print(a.output)

    elif a.cmd == "animate":
        os.makedirs(a.outdir, exist_ok=True)
        frames = animate_field(a.cols, a.rows, a.frames, a.preset, a.seed)
        font = load_font(a.font, a.cell * 2)
        for i, (grid, field) in enumerate(frames):
            render_grid(grid, font, a.cell, intens=None if a.flat else field).save(
                os.path.join(a.outdir, f"frame_{i:04d}.png"))
        print(f"{len(frames)} frames -> {a.outdir}")
        print("Encode at frames/seconds fps for a smooth loop — see references/pipeline.md")


if __name__ == "__main__":
    main()
