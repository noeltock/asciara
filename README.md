<div align="center">

# ░▒▓ asciara ▓▒░

### Images remembered as text. Light, poured through a grid of characters.

<br>

*Every picture is a field of light.*
*asciara reads that field and answers it in glyphs, where a character is not a pixel but a measure of how much light fell there.*
*The image surfaces in the middle distance: close enough to read the letters, far enough to see the form.*
*A still becomes a portrait. Motion becomes a slow tide of* `@ # % / < >` *drifting across the dark, lit from one side like weather.*

*Not the brittle ASCII of old. Not the soulless pixel-perfect generator. Something between, with a pulse.*

<br>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-8A63D2)
![Python](https://img.shields.io/badge/engine-Pillow%20%2B%20numpy-3776AB?logo=python&logoColor=white)
![ffmpeg](https://img.shields.io/badge/encode-ffmpeg-007808?logo=ffmpeg)
![zero install](https://img.shields.io/badge/run-via%20uv,%20zero%20install-DE5FA7)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

<br>

<img src="demos/calm-loop.gif" width="760" alt="A calm, seamlessly looping ASCII field — a lit surface flowing under a fixed light">

</div>

---

**Contents:** [Why](#why) · [What you get](#-what-you-get) · [Backgrounds](#-living-backgrounds) · [Quick start](#-quick-start) · [The look](#-the-look) · [Levers](#%EF%B8%8F-the-levers) · [How it works](#%EF%B8%8F-how-it-works) · [Requirements](#-requirements) · [Troubleshooting](#-troubleshooting) · [License](#-license)

---

> [!NOTE]
> **Talk to it in plain English.** Once installed, you just say *"turn this photo into ascii"* or *"build me a calm looping ascii hero for my site"*, and Claude drives the engine. The commands below are what it runs under the hood (and what you can run yourself).

## Why

Most ASCII art falls into one of two traps. The old school is all skeleton, a few slashes pretending to be a face. The new school is all skin, a generator that maps one glyph per pixel until the characters vanish and you may as well have used a photo. Both miss the thing that made ASCII art worth looking at: the **tension** between reading a letter and seeing an image at the same time.

asciara lives in that tension. It treats the character grid as a medium with its own grain, sizes the glyphs so the eye holds both readings at once, and uses **structure** (not just brightness) to draw the form. The output is a real asset, a PNG, a seamless GIF or MP4, or a self-contained web hero you drop into a page, not a screenful of terminal text.

## ✨ What you get

- 🖼️ **Dual-channel image conversion.** A luminance ramp paints the tones; a **Sobel edge pass** lays directional glyphs (`| / - \`) along the contours. That structural layer is the soul, the part naive generators skip.
- 🌫️ **Calm, seamless looping animation.** A flow field that drifts and breathes, sampled around a circle in time so the loop closes with no seam. Encoded to GIF / MP4 / WebM with clean palettes.
- 🌑 **Living backgrounds, dark or light.** `billow` (a lit, flowing surface), `monolith` (a logo as a static isometric 3D prism), `gyre` (that prism rotating 360°), and `contours` (slow ridge lines). Each self-contained, each with a `?light` mode, no build step, no dependencies.
- 🧊 **Software 3D, no WebGL.** A logo extruded into a real prism, miter-sharp corners, two-shade isometric faces, and a full turntable rotation — done with a point cloud rotated each frame and a z-buffer. No three.js, no GSAP.
- 🎚️ **Shades of grey or monochrome.** Graded greyscale for depth, or flat monochrome where the form reads purely through *which glyph* sits in each cell.
- 📺 **Old-terminal mode.** Throttle the refresh to a slow, stepped cadence that feels like a CRT waking up.
- 🔤 **Honest ramps.** Character sets are **coverage-ordered** (measured ink per glyph), including a `web` ramp of code symbols (`@ / : ; < > # %`). Bring your own alphabet and it gets ordered correctly.
- 🔒 **Local, license-clean, public-ready.** Pillow + numpy via `uv`, ffmpeg, OFL fonts (Geist Mono, Iosevka), Apache/MIT only. No API keys, no cloud, no per-image fees.

## 🌑 Living backgrounds

The heart of asciara is a set of **living backgrounds** — subtle, organic, slow. Each renders to a
single full-bleed canvas (sharp on Retina), in Geist Mono Light, greyscale, with a **dark and a
light** mode (add `?light`). The subtlety is one dial: the **`ink`** value-band, a `[faint, dense]`
pair the glyph greys interpolate within. Narrow and near the background is a whisper; widen it for
presence.

<img src="demos/hero-billow.png" width="760" alt="A still frame: a lit ASCII surface with folds and depth, drawn in graded greys on near-black">

They are collected in one gallery. Serve the repo root and browse every piece side by side:

```bash
python3 -m http.server 8412     # then open http://localhost:8412/
```

`/` greets you with a full-screen composition and a control bar — switch pieces, change the matte,
and hit **copy config** to paste a setting you like straight back into the source.
`/gallery.html` shows all nineteen at once.

**current** — `assets/` and `assets/concepts/`, on the original zero-dependency engine.

| Piece | What it is |
|---|---|
| **billow** | a lit, flowing surface — domain-warped fBm shaded by its normals. The signature |
| **mist** | a simple drifting noise field in a `<pre>`, one grey. Quiet, minimal |
| **contours** · **swell** · **dunes** · **tide** | topographic ridges, ocean swell, migrating dunes, a surface breathing |
| **plume** · **caustics** · **aurora** · **wind** · **current** | rising smoke, pool-floor light, curtains, gusts, river eddies |
| **monolith** · **gyre** | a logo as a static isometric 3D prism, and the same prism rotating 360° — software 3D, no WebGL |

**next** — `assets/next/`, on the `nx.js` engine. Same zero-dependency rule, more capability:

| Piece | What it is |
|---|---|
| **ridge** | drifting vortices, with contour glyphs tracing where the flow turns |
| **glint** | rain rings from wandering sources, with a broad specular sheen on the crests |
| **strata** | three depth planes, each with its own motion, occluding one another |
| **phosphor** | sheared gusting filaments that leave a decaying wake |
| **mark** | a logo that is not drawn — it is the patch of water that has stopped moving |

**lab** — `assets/lab/`, the one place three.js is allowed, to test what a GPU actually buys.

### The matte
The `next` pieces add a **matte**: a lattice of 2-3 *pixel* blocks, each at a slightly different
value, that the finished frame is resolved onto. It is what gives a dark image a produced,
photographed quality instead of glyphs printed on flat black. Two modes — `field` follows the
picture and reinforces the form; `noise` owes nothing to it and reads as the surface the image sits
on. It is **not film grain**: grain is per-pixel, random and changes every frame, so it sits *on* a
picture; this is block-aligned, blue-noise derived and *fixed*, so the picture resolves *onto* it.

Open any `next` piece directly and a control bar appears — mode, block size, strength, and a
**copy config** button that hands you the line to paste back into the file. It is gated on not being
in an iframe, so the gallery tiles stay clean.

Backgrounds share a small engine that owns the DPR-sharp canvas, the font, the fps throttle and the
render. Full lever tables and the technique notes live in
[`references/backgrounds.md`](references/backgrounds.md).

## 🚀 Quick start

```bash
# 1. Install as a Claude Code skill
git clone git@github.com:noeltock/asciara.git ~/.claude/skills/asciara

# 2. In Claude Code, just ask:
#    "turn portrait.jpg into ascii"
#    "make a calm looping ascii background, then export an mp4"
#    "give me a lit ascii hero for my landing page, geist mono, flowing left"
```

Claude reads `SKILL.md` and runs the engine. Nothing to set up beyond `uv` and `ffmpeg`.

<details>
<summary><b>Prefer to drive it yourself? The raw commands ↓</b></summary>

```bash
S=~/.claude/skills/asciara/scripts/ascii_tool.py

# Image -> ASCII PNG (dual-channel, graded grey on dark)
uv run --with pillow --with numpy python $S image photo.jpg --out art.png --width 100

# Just the text grid
uv run --with pillow --with numpy python $S image photo.jpg --txt --width 90

# Calm looping animation -> PNG frames, then encode a clean loop
uv run --with pillow --with numpy python $S animate frames/ --preset calm --frames 150
ffmpeg -y -framerate 30 -i frames/frame_%04d.png -vf "palettegen=stats_mode=diff" /tmp/pal.png
ffmpeg -y -framerate 30 -i frames/frame_%04d.png -i /tmp/pal.png -loop 0 \
  -filter_complex "[0:v][1:v]paletteuse=dither=sierra2_4a" loop.gif

# Render an existing ascii text file
uv run --with pillow --with numpy python $S render art.txt art.png

# Backgrounds: serve the repo root, then browse the gallery
python3 -m http.server 8412   # http://localhost:8412/gallery.html

# Check a background without screenshotting it — one frame, headless, in about a second
node tools/measure.js assets/next/ridge.html 12
```
</details>

## 🎨 The look

The whole craft layer lives in [`references/aesthetic.md`](references/aesthetic.md). The short version, the three levers that make or break it:

1. **Glyph size vs subject.** Coarse enough to read characters, fine enough to read the image. 60–110 columns, 12–20px cells. This is the most important choice.
2. **Structure over brightness.** Keep the edge channel on. Contours in directional glyphs are what fuse the type and the picture.
3. **Restraint in colour.** Monochrome-on-dark by default, black point lifted so the glyphs glow rather than sit in hard contrast.

Built-in ramps: `mono10`, `fine`, `calm`, `drift`, `soft`, `blocks`, `web`. Built-in animation presets: `calm`, `drift`, `soft`, `mono`.

## 🎛️ The levers

Each background is tunable from a single `CONFIG` block at the top of its file. The most important dial is **`ink`** — the value-band that sets how loud or subtle it is. Full table and the technique behind each in [`references/backgrounds.md`](references/backgrounds.md).

| Lever | Does |
|---|---|
| `ink` | the `[faint, dense]` value-band — the subtlety dial; narrow + dark = a whisper |
| `shading` | graded shades of grey (depth) **vs** monochrome (form through glyphs only) |
| `pad` | px gap around each glyph (breathing room / finer mesh) |
| `fps` | `60` smooth **vs** `8–12` stepped, old-terminal cadence |
| `span` | macro scale, smaller = bigger forms |
| `flow` / `flowSpeed` | the direction and speed the surface drifts |
| `bump` / `contrast` | relief strength and tonal punch |
| `ramp` | the alphabet (coverage-ordered light → dense) |
| `fontFamily` / `fontWeight` | typeface, defaults to **Geist Mono Light** |

## ⚙️ How it works

**Static image, the dual channel:**

```
   image ──┬─▶ luminance ramp  ─────────▶ tone per cell  (@ % # … : . space)
           │                                     │
           └─▶ Sobel edges (∇ magnitude+angle) ──┘
                          │
                  where an edge is strong, the cell
                  becomes a directional glyph:  | / - \
                          ▼
                  shaded grid ──▶ rendered to PNG (monospace, dark ground)
```

**Animation / web hero, the lit surface:**

```
   domain-warped fBm  ──▶  height field h(x,y,t)
                              │
                  surface normal = ∇h  ──▶  dot(normal, light)  (volumetric shading)
                              │
                  shaded value ──▶ smoothly mapped through the full ramp
                              │
                  ┌───────────┴────────────┐
            live web hero              frame sequence
        (continuous directional      (in-place loop) ─▶ ffmpeg ─▶ GIF/MP4/WebM
         flow, never seams)
```

Two ideas do the heavy lifting: characters carry **light**, not just density (a height field shaded by its normals), and the value is mapped **smoothly** through the ramp rather than thresholded into lines. A live hero flows in a direction forever; a finite export loops in place. You can have either, not both at once.

## 📦 Requirements

| Dependency | For | Install |
|---|---|---|
| **uv** | runs the Python engine with Pillow + numpy, zero install | [astral.sh/uv](https://docs.astral.sh/uv/) |
| **ffmpeg** | encoding animation frames to GIF / MP4 / WebM | `brew install ffmpeg` |
| **A monospace font** | rendering | system fonts auto-detected; backgrounds load **Geist Mono** + **Geist Pixel** (OFL) |
| **python3** | serving the backgrounds locally (`python3 -m http.server`) | preinstalled on macOS |
| **node** | `tools/measure.js`, the headless one-frame check | optional; only for tuning |

> [!IMPORTANT]
> No API key, no account, no build step, no npm. Everything runs locally.
>
> **Serve the backgrounds over `http://`, don't open them with `file://`.** Each page is still a
> single self-contained file, but the navigation links are absolute (`/`, `/gallery.html`), so on
> `file://` the piece renders while the nav points at your filesystem root. `python3 -m http.server`
> is all it needs. Dropping one into your own site works normally.

## 🔧 Troubleshooting

<details>
<summary><b>Common questions & gotchas</b></summary>

- **The web hero looks soft / blurry.** That is a canvas-on-Retina bug, not the art. asciara's heroes size the canvas backing store to `innerWidth × devicePixelRatio` and scale the context, so glyphs land on real pixels. If you fork the render, keep that, it is the single biggest sharpness factor.
- **The animation jumps / stutters.** Too few frames or too large a drift per step. Render more frames (120–180) and encode at a matching fps. The loop is seamless by construction; jank is a frame-count problem.
- **A photo comes out too busy or too flat.** Tune `--contrast` and `--edge-threshold` (0.12 busy → 0.28 sparse), and `--width` for the glyph-size lever. Defaults are a starting point, not a finished look per image.
- **The hero feels too noisy / not macro enough.** Lower `span` (bigger forms) and `bump` (gentler relief); raise `flowSpeed` only a little, calm wants slow.
- **My custom characters look wrong as a ramp.** They need to be ordered by ink coverage, light → dense. Measure each glyph in the target font and sort, the `web` ramp was built this way.
- **Is anything uploaded?** No. Everything runs locally; the only network call is the Google Fonts link in the web hero (swap it for a self-hosted woff2 if you prefer).

</details>

## 🤝 Contributing

PRs and issues welcome. The engine is one small, dependency-light Python file (`scripts/ascii_tool.py`) plus two self-contained HTML heroes; `SKILL.md` is the entry point Claude reads, and the craft lives in `references/`. Keep changes surgical and the docs in sync.

## 🙏 Credits

Stands on the shoulders of [Pillow](https://python-pillow.org), [NumPy](https://numpy.org), [ffmpeg](https://ffmpeg.org), [Geist Mono](https://vercel.com/font) and [Iosevka](https://typeof.net/Iosevka/), and the long lineage of textmode artists who proved a grid of characters can hold a picture.

## 📄 License

[MIT](LICENSE) © 2026 Noel Tock

<div align="center">
<sub>A Claude Code skill. Speak to it in plain English; it pours the light into characters for you.</sub>
</div>
