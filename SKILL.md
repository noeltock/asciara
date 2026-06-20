---
name: asciara
description: |
  asciara. Generate soulful, middle-ground ASCII art — static images and calm, seamlessly
  looping animations — as shareable assets (PNG, GIF, MP4, WebM, embeddable
  HTML hero). Converts photos with a dual-channel engine (luminance ramp PLUS
  Sobel edge glyphs) so the characters and the image read together, not a
  glyph-per-pixel photo and not crude stick-figure ASCII. Restrained colour,
  deliberate glyph size, organic looping motion.
  NOT for pixel/emoji art, terminal-only image preview (use chafa), or editing a
  real photo.
  Triggers on: "/asciara", "/ascii", "asciara", "ascii art", "make this ascii",
  "ascii animation", "ascii hero", "convert image to ascii", "looping ascii",
  "ascii loop", "ascii from this image", "ascii background".
allowed-tools: Read, Write, Glob, Bash(uv run*), Bash(ffmpeg*), Bash(mkdir *), Bash(ls *)
---
## Purpose
Produce ASCII art that has soul: the middle ground where glyph size, structural edges, and restrained colour make the characters and the subject read as one image. The engine is a self-contained Python tool (`scripts/ascii_tool.py`, Pillow + numpy, run via `uv` so nothing is installed); its signature is the **dual-channel** conversion — a luminance ramp for fills plus a Sobel edge pass that lays directional glyphs (`| / - \`) along contours. Animation is calm, organic, and seamlessly looping. The full taste layer (presets, ramps, density, colour, motion) is in `references/aesthetic.md`; output/encode/embed is in `references/pipeline.md`; the animated web heroes and every tunable lever are in `references/hero-levers.md`.

## Usage
Run the tool via uv (zero-install). `<dir>` is this skill's directory.
```
# static image -> ascii PNG (dual-channel, mono on dark)
uv run --with pillow --with numpy python <dir>/scripts/ascii_tool.py image photo.jpg --out art.png --width 100

# just the text grid
uv run --with pillow --with numpy python <dir>/scripts/ascii_tool.py image photo.jpg --txt --width 90

# calm looping animation -> PNG frames, then encode
uv run --with pillow --with numpy python <dir>/scripts/ascii_tool.py animate frames/ --preset calm --frames 120
# then: ffmpeg 2-pass palette (see references/pipeline.md) -> loop.gif / .mp4 / .webm

# render an existing ascii text file
uv run --with pillow --with numpy python <dir>/scripts/ascii_tool.py render art.txt art.png
```

## Procedure

### Step 1: Decide the output
- **Static image (photo/logo → ASCII):** `image` subcommand.
- **Animated loop (hero, background, social):** `animate` → frames → ffmpeg.
- **Live web hero (no video file):** ship `assets/hero2.html` (lit volumetric surface, the rich flowing look) or `assets/hero.html` (simple calm field). Self-contained, no deps. Every knob lives in the `CONFIG` block; `references/hero-levers.md` documents them and the technique: `shading` (graded greys vs monochrome), `fps` (smooth vs old-terminal cadence), `flow`/`flowSpeed` (drift direction), `span` (macro scale), `ramp`, fonts.
- **`<video>` embed:** see `references/pipeline.md`.

### Step 2: Set the three levers (read `references/aesthetic.md` first)
1. **Glyph size vs subject** — `--width` (60-110 cols) and `--cell` (12-20px). Coarser = more soul. This is the most important choice.
2. **Edges on** — keep the Sobel channel (default); tune `--edge-threshold` (0.12 busy → 0.28 sparse). This is what naive generators miss.
3. **Restrained colour** — default monochrome-on-dark; pick a preset or `--fg`/`--bg`. Avoid full per-character colour.
Choose a ramp (`--ramp mono10|fine|calm|drift|blocks` or a literal string) and, for animation, a preset (`calm|drift|amber|mono`).

### Step 3: Generate
Run the relevant subcommand. For animation, pick `--frames` for the loop length (frames ÷ fps = seconds; aim 6-18s of calm motion).

### Step 4: Encode / package (animation)
Encode the frame sequence with the ffmpeg recipes in `references/pipeline.md` (two-pass palette GIF for a clean loop; MP4 `yuv420p` for compatibility; WebM `yuva420p` for alpha overlays). The loop is already seam-free.

### Step 5: Deliver
Report the output path(s). For a site hero, hand over `hero.html` or the `<video>` snippet from `references/pipeline.md`. Offer a couple of preset variations rather than one take.

## Principles
- **Middle ground, always** — coarse enough to read glyphs, structured enough to read the image; never glyph-per-pixel.
- **Edges are the soul** — keep the dual-channel on; it is the differentiator.
- **Restraint in colour** — monochrome-on-dark by default; one accent or duotone at most.
- **Calm, seamless motion** — noise/flow, slow, eased, looped around a circle in time; never per-frame randomness.
- **Self-contained and license-clean** — Pillow/numpy via uv, ffmpeg, OFL fonts, Apache/MIT only; safe for public release.
- **Sharpness is device pixels:** any canvas must be sized to `innerWidth * devicePixelRatio` and the context scaled by dpr, or it blurs on Retina. Biggest crispness factor.
- **Coverage-order custom ramps:** order glyphs by measured ink coverage in the font, not by eye, or the gradient reads wrong.
- **For animation, lit surface beats flat field:** shade a domain-warped fBm height-field by its normals; map the shaded value smoothly through the full ramp (no thresholding).
- **Continuous flow and seamless loop are mutually exclusive:** directional drift for live heroes; in-place circular-time motion for looping GIF/MP4 exports.
