---
name: asciara
description: |
  asciara. Soulful, middle-ground ASCII art in two forms: living web BACKGROUNDS
  (self-contained animated HTML — lit surfaces, contour glyphs, depth layers, and a
  sub-glyph dither matte) and static/animated ASSETS (PNG, GIF, MP4, WebM) converted
  from images by a dual-channel engine — a luminance ramp PLUS Sobel edge glyphs, so
  the characters and the image read together. Not a glyph-per-pixel photo, not crude
  stick-figure ASCII. Greyscale, deliberate glyph size, slow organic motion.
  NOT for pixel/emoji art, terminal-only image preview (use chafa), or editing a
  real photo.
  Triggers on: "/asciara", "/ascii", "asciara", "ascii art", "make this ascii",
  "ascii animation", "ascii hero", "convert image to ascii", "looping ascii",
  "ascii loop", "ascii from this image", "ascii background", "ascii hero for my site",
  "dithered background", "textmode background".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(uv run*), Bash(ffmpeg*), Bash(node tools/measure.js*), Bash(python3 -m http.server*), Bash(mkdir *), Bash(ls *), Bash(open *)
---
## Purpose
Produce ASCII art that has soul: the middle ground where glyph size, structural edges, and restrained colour make the characters and the subject read as one image. The engine is a self-contained Python tool (`scripts/ascii_tool.py`, Pillow + numpy, run via `uv` so nothing is installed); its signature is the **dual-channel** conversion — a luminance ramp for fills plus a Sobel edge pass that lays directional glyphs (`| / - \`) along contours. Animation is calm, organic, and seamlessly looping. The full taste layer (presets, ramps, density, colour, motion) is in `references/aesthetic.md`; output/encode/embed is in `references/pipeline.md`; the animated web heroes and every tunable lever are in `references/backgrounds.md`.

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
- **Live web hero (no video file):** ship a background. Serve the repo root and open `/`:
  ```
  python3 -m http.server 8412     # then http://localhost:8412/
  ```
  `/` is a full-screen landing composition with a control bar across the top — mode, block size,
  strength, a switcher listing every piece, and **copy config** to paste a setting you like back
  into the source. `/gallery.html` is the grid of all 19, in sections.
  - **next** (`assets/next/`) — ridge, glint, strata, phosphor, mark. Contour glyphs with tile
    voting, occluding depth layers, persistence, material lighting.
  - **current** (`assets/`, `assets/concepts/`) — billow, mist, contours, swell, dunes, tide,
    plume, caustics, aurora, wind, current, plus the logo pieces monolith and gyre.
  - **lab** (`assets/lab/`) — GPU experiments, three.js, UNVERIFIED.
  All are self-contained single files; every knob is in the `NX({...})` block at the top.
  Every lever and the technique behind it is in `references/backgrounds.md`.

- **`<video>` embed:** see `references/pipeline.md`.

### Step 2: Set the three levers (read `references/aesthetic.md` first)
1. **Glyph size vs subject** — `--width` (60-110 cols) and `--cell` (12-20px). Coarser = more soul. This is the most important choice.
2. **Edges on** — keep the Sobel channel (default); tune `--edge-threshold` (0.12 busy → 0.28 sparse). This is what naive generators miss.
3. **Restrained colour** — output is greyscale on near-black. Avoid full per-character colour.
Choose a ramp (`--ramp mono10|fine|calm|drift|soft|blocks|web` or a literal string) and, for animation, a preset (`calm|drift|soft|mono`).

### Step 3: Generate
Run the relevant subcommand. For animation, pick `--frames` for the loop length (frames ÷ fps = seconds; aim 6-18s of calm motion).

### Step 4: Encode / package (animation)
Encode the frame sequence with the ffmpeg recipes in `references/pipeline.md` (two-pass palette GIF for a clean loop; MP4 `yuv420p` for compatibility; WebM `yuva420p` for alpha overlays). The loop is already seam-free.

### Step 4b: Check a background without screenshotting it
`node tools/measure.js <piece.html> [seconds]` renders one frame headlessly and reports ink
coverage, glyph mix, tonal spread and macro structure, with reference values to calibrate against.
Use it before reaching for a browser — it answers "is this too dense / too bright / too flat" in a
second rather than minutes, and it does not hallucinate.

### Step 5: Deliver
Report the output path(s). For a site hero, hand over `mist.html` or the `<video>` snippet from `references/pipeline.md`. Offer a couple of preset variations rather than one take.

## Principles
- **Middle ground, always** — coarse enough to read glyphs, structured enough to read the image; never glyph-per-pixel.
- **Edges are the soul** — keep the dual-channel on; it is the differentiator.
- **Restraint in colour** — monochrome-on-dark by default; one accent or duotone at most.
- **Calm, seamless motion** — noise/flow, slow, eased, looped around a circle in time; never per-frame randomness.
- **Self-contained and license-clean** — Pillow/numpy via uv, ffmpeg, OFL fonts, Apache/MIT only; safe for public release.
- **Sharpness is device pixels:** any canvas must be sized to `innerWidth * devicePixelRatio` and the context scaled by dpr, or it blurs on Retina. Biggest crispness factor.
- **Coverage-order custom ramps:** order glyphs by measured ink coverage in the font, not by eye, or the gradient reads wrong.
- **For animation, lit surface beats flat field:** shade a domain-warped fBm height-field by its normals; map the shaded value smoothly through the full ramp (no thresholding).
- **Continuity IS the aesthetic.** No hard thresholds anywhere in an animated field — a `cutoff`,
  a binary edge test or an occlusion rectangle makes cells pop in and out between frames, and that
  flicker is what reads as "messy". Use a gamma curve to thin a layer, hysteresis and temporal
  smoothing to stabilise a discrete choice, and a neighbourhood vote to keep contour glyphs
  agreeing with each other.
- **Continuous flow and seamless loop are mutually exclusive:** directional drift for live heroes; in-place circular-time motion for looping GIF/MP4 exports.
