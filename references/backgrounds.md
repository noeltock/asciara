# Animated ASCII backgrounds: architecture, levers, technique
Reference for the embeddable web backgrounds in `assets/` and `assets/concepts/`. Load this when building, tuning, or explaining an animated ASCII background, a logo treatment, or the rotating 3D mark.

## The pieces
| File | What it is | Modes |
|---|---|---|
| `assets/mist.html` | simple drifting noise field in a `<pre>`, one grey. Quiet, minimal. | dark / `?light` |
| `assets/billow.html` | the signature: a LIT VOLUMETRIC SURFACE on canvas, graded greys, flowing. Default choice. | dark / `?light` |
| `assets/concepts/monolith.html` | the Accelerate logo as a STATIC isometric 3D prism, sitting in the billow field. | dark / `?light` |
| `assets/concepts/gyre.html` | the same prism ROTATING 360° about its vertical axis (software 3D). | dark / `?light` |
| `assets/concepts/contours.html` | slow topographic ridge lines. | dark / `?light` |
| `gallery.html` | the gallery — every piece rendered live, dark + light. | — |

### The three loadouts
Backgrounds now sit in three groups, browsable side by side from `gallery.html`
(serve the repo root: `python3 -m http.server 8412`).

| Loadout | Where | Engine | Dependencies |
|---|---|---|---|
| **landing** | `index.html` (repo root) | `next/nx.js` | none |
| **next** | `assets/next/*.html` | `next/nx.js` | none |
| **current** | `assets/billow.html`, `assets/mist.html`, 9 pieces in `assets/concepts/` | `next/nx.js` (concepts via `concepts/compat.js`) | none |
| **current** | `concepts/monolith.html`, `concepts/gyre.html` | `concepts/engine.js` + `field.js` | none |
| **lab** | `assets/lab/*.html` | `assets/lab/gpuascii.js` | three.js via CDN importmap |

Two pages, not seven. `/` is a full-screen landing composition with the control bar; `/gallery.html`
is the single grid of everything, in sections by loadout. Serve the repo root and open `/`.

`billow` and `mist` were the last holdouts — `billow` carried its own private copy of the engine and
`mist` rendered into a `<pre>`, which is why neither had a matte, a control bar, light mode or
adaptive fill. Both now run on `nx.js` with their fields unchanged; `billow` keeps `srgbBand: true`
so its tone is exactly as authored.


### The older concepts run on the newer engine
`concepts/compat.js` is a shim, not a rewrite. The old contract is
`ASCIARA({ compute(buf, cols, rows, t) })`, where the piece fills `buf` with FINAL BRIGHTNESS —
it does its own lighting via `litShade`. `nx.js` accepts exactly that as a `shadedGrid` layer, so
every concept keeps its own motion and its own lighting while inheriting the matte, the control bar
and switcher, adaptive fill, blue-noise dithering and linear-light greys.

Two pieces stay on `engine.js`: **monolith** and **gyre** use its second OVERLAY layer, which has
its own colour band and per-cell `{c, b}` shaded glyphs for the logo. There is no equivalent in
`nx.js` and faking one is not worth it. They therefore have no control bar.

**Ported pieces set `srgbBand: true`.** Linear-light interpolation is the correct maths and
everything new uses it, but switching an already-tuned piece to it lifts its midtones by ~16 levels
— that is a restyle, not a bug fix, on work someone art-directed by eye. The flag keeps them
looking exactly as authored. Verified: contours 48, caustics 52, dunes 69, plume 74, swell 78,
tide 79 — identical mean grey before and after the port.

The lab is the one sanctioned exception to the zero-dependency rule, and it exists to answer a
specific question rather than to ship: what does a GPU buy that canvas-2D cannot. The answer so
far is "less than you would think" — see `## The lab` at the bottom.

## The shared engine — `assets/concepts/engine.js`
**Only `monolith.html` and `gyre.html` still run on this** — the other concepts moved to `nx.js` via
`compat.js` (see above). A concept supplies a `compute(buf, cols, rows, t, ov)` callback; the engine owns the canvas, DPR scaling, font, fps throttle, and the two-layer render. Helpers exposed: `ASCIARA.noise(x,y)`, `ASCIARA.fbm(x,y)`, `ASCIARA.hash(ix,iy)`.

Two render layers, drawn back-to-front:
- **Field layer** — `buf[i]` is a 0..1 value per cell, mapped through `ramp` and coloured within the `ink` band.
- **Overlay layer** — `ov[i]` is an overlay glyph drawn ON TOP in its own `overlay` band, independent of the field. Either a string (flat, brightest) or `{c, b}` (glyph + brightness 0..1, shaded within the overlay band). This is how a logo can be bright/3D without touching the field. **Always keep layers independent** — the single worst bug this session was sharing one colour band between field and logo, so brightening the logo dragged the whole field up.

### engine CONFIG defaults (override per concept)
| Key | Does | Default |
|---|---|---|
| `ramp` | field alphabet, light→dense (coverage-ordered) | `" .:;/<>=?*T%&#@N"` |
| `fontSize` / `fontWeight` / `fontFamily` | type | `15` / `300` / Geist Mono |
| `pad` | px gap around each glyph cell (finer/airier mesh) | `2` |
| `fps` | redraw cadence (60 smooth; 8–12 = old-terminal) | `30` |
| `bg` | background colour | `#080808` |
| `ink` | FIELD band `[faint, dense]` — the field subtlety dial | `["#4d4d4d","#ffffff"]` |
| `overlay` | OVERLAY band `[shadow, lit]` — shades the logo layer | `["#3a3a3a","#ffffff"]` |
| `shading` | graded greys vs flat `mono` | `true` |
| `mono` | glyph colour when `shading:false` | `#cfcfcf` |
| `levels` | grey buckets (fillStyle set once per bucket) | `12` |
| `maxCells` | work budget; past it the glyphs GROW rather than the field being clipped | `20000` |
| `maxFontSize` | ...but never grow past this, or it stops reading as a character grid | `34` |

## billow.html — the lit surface
`billow` used to carry its own private copy of the engine, with its own CONFIG block (`shading`,
`mono`, `flow`, `flowSpeed`, and so on). It now runs on `nx.js` like everything else, so its levers
are the standard layer levers documented under **The next engine** below — `span`, `bump`, `light`,
`contrast`, `amb`/`hgt`/`dif`, `drift`/`driftSpeed`/`evolve`, `ink`.

It keeps `srgbBand: true`, which preserves the exact tone it was originally art-directed to.


## Logo layer levers (monolith.html — static isometric prism)
The Accelerate triangle, extruded into a 2-shade isometric solid, on the billow field, with a faded moat around it.
| Lever | Does | Typical |
|---|---|---|
| `TRI` | the triangle vertices (real Accelerate brand: apex leans right) | `[[184,80],[235,242],[29,242]]` |
| `ACC` | the glyph set the mark is composed from | `["Δ","%","A","C",">","<","="]` |
| `STROKE` | bar thickness (SVG units) | `24` |
| `DEPTH` | isometric extrude direction `[dx,dy]` (down-right) | `[0.5,0.85]` |
| `FRONT_TONE` / `SIDE_TONE` | the TWO flat isometric shades (front light, side dark) | `0.92` / `0.30` |
| `D` (in `buildMask`) | extrude length in cells = visible thickness | `cols*0.022` |
| `RING` (in `buildMask`) | cells of guaranteed empty space between logo and field | `2` |
| `overlay` | the logo's `[shadow, lit]` band | `["#343434","#ffffff"]` dark; `["#c8c8c8","#101010"]` light |

## Logo layer levers (gyre.html — rotating prism)
| Lever | Does | Typical |
|---|---|---|
| `SPIN_SECONDS` | seconds for one full 360° turn | `20` |
| `STROKE` | bar thickness (SVG units) | `26` |
| `DEPTH` | prism HALF-depth in object units (Z thickness) | `0.16` |
| `L3` | light direction in object space (y-up) | `[-0.45,0.5,0.80]` |
| `ACC` | glyph set | as above |
| `step` (in geometry) | object-space sample spacing (smaller = denser/solid edges) | `0.016` |

## Technique — the lessons, in order learned

### Field rendering
1. **Lit surface, not a flat pattern.** Height field `h = fbm(domainWarp(x,y))`, normal from `gradient(h)`, shade `dot(normal, light) + ambient`. A flat 2D wave/noise has no light and always reads as a texture, not a form. This was the jump from "liney/cheap" to the Attio look.
2. **Map the SHADED value SMOOTHLY through the full ramp.** Never threshold into lines/stripes — the continuous gradient is the "middle ground" between stick-figure ASCII and pixel-perfect.
3. **Coverage-ordered ramps.** Order glyphs by measured ink coverage in the chosen font (rasterise each, count filled pixels, sort), not by eye. The `web` ramp (`@ / : ; < > # %` + N T) was built this way.
4. **Subtle = a thin `ink` band near the background.** "Dark vs darker" / "white vs faint grey" is a narrow value-band, NOT near-zero contrast — too narrow and it's invisible (the `veil` dead-end was 4% visible, mean 11 on bg 8). Keep max brightness clearly above bg but well below white.

### Layers
5. **Field and overlay are independent layers with their own colour bands.** Never share one band — brightening the logo must not touch the field. The overlay carries per-cell `{c, b}` for a shaded logo.
6. **Empty buffer ≠ gradient fade.** A guaranteed empty ring needs a morphological DILATION of the mask (a separable max-filter by N cells), not a blur-threshold (which barely clears past a thick stroke). For "fade reaches transparent just shy of the logo", build the clearing from the *dilated* mask blurred large, so it saturates to fully-clear over logo+ring and gradients up into the field.

### 3D logo
7. **Isometric depth needs TWO FLAT shades, not a bevel.** A rounded/tube cross-section reads as a soft bevel; the reference is flat-shaded faces — a light front face and a dark side face meeting at a hard edge. Two constant tones = solid prism. (The glyphs still vary by ink coverage; the *colour* per face is flat.)
8. **Sharp corners = outer-tri MINUS inner-tri, both MITER-offset.** Sampling each edge as its own bar gives rounded end-caps and blunts the apex. Offsetting the whole triangle outward/inward with proper miter joins keeps every corner (incl. the sharp apex) crisp.
9. **Real rotation is a software 3D point-cloud, no WebGL needed.** Build the prism's surfaces as object-space points (front/back faces + side walls, each with a normal). Each frame: rotate point + normal about Y, project orthographically (halve Y for 2:1 cells), z-buffer the nearest, shade by `dot(rotatedNormal, light)`. Y as the spin axis keeps apex-top / base-bottom.
10. **Rotation flicker has three causes, three fixes.** (a) z-fighting between front/back faces → **backface cull** (skip points whose rotated normal faces away) + a tiny camera-ward z-bias; (b) glyph crawl → **stable per-surface glyphs** assigned in OBJECT space (a patch keeps its character as it turns), not from screen position; (c) edge brightness oscillation → **temporal smoothing** (EMA the per-cell brightness when it was occupied last frame).

### Universal
11. **Sharpness = device pixels.** Size the canvas backing store to `innerWidth * devicePixelRatio` and scale the context by `dpr`, keep CSS size at `innerWidth`. Otherwise Retina upscales a 1x bitmap and every glyph looks soft. Single biggest crispness factor — verify with a DPR check, not a screenshot.
12. **Continuous flow vs seamless loop are mutually exclusive.** A live web hero runs forever → directional `flow` is ideal (never restarts). A short SEAMLESS GIF/MP4 loop needs in-place motion sampled around a circle in time (the tool's `animate` command). You cannot have both.
13. **Performance.** Integer hash for noise (not `Math.sin`); compute the height grid once per frame, normals from grid neighbours; bucket cells by brightness so `fillStyle` is set once per bucket, not per cell; per-frame moat via separable max-filter + box-blur is cheap on a ~160×64 grid.

### QA habit
14. **Verify by reading pixels, not by trusting a screenshot.** Sample the canvas (`getImageData`) for brightness spread, empty-ring width, silhouette width over time (rotation), flicker churn. Threshold carefully — bright field cells can pollute a "find the logo" scan (isolate the logo with a high threshold, e.g. `>150`).

## The next engine — `assets/next/nx.js`
A second engine, zero-dependency like the first. A piece supplies MOTION (a height field) and its
own LOOK; the engine owns lighting, glyph choice, layering and the matte. Six things it does that
`engine.js` does not, each of which was a fix for something that visibly failed:

| Capability | What it is | Why |
|---|---|---|
| **material** | Blinn-Phong specular + rim on top of diffuse | `dot(n,l)` alone always reads matte, like grey cloth. Keep the exponent LOW (8-16): a tight lobe is a high-frequency function of the normal and scintillates, which is the opposite of calm |
| **contour channel** | strong gradients take a directional glyph (`- / \| \`) instead of a tonal one | the image converter's dual channel, running live — glyphs describe form, not just density |
| **tile voting** | a neighbourhood votes on the contour direction, weighted by gradient strength | per-cell independent choice is what produces scattered, broken hatching: neighbours disagree by one bucket and the line falls apart. Lifted from the GPU ASCII pipelines, where the same vote runs across a pixel tile |
| **layers** | several fields back to front, one glyph per cell | see `composite()` below |
| **persistence** | per-cell decaying maximum of past brightness | motion leaves a wake, so a still frame carries its own history |
| **matte** | a sub-glyph pixel lattice | its own section below |

### Filling the viewport
There is no column cap. An earlier `maxCols` made the field stop part-way across a wide screen and
leave dead space — and capping width is the wrong lever anyway: what needs bounding is the WORK.
Both engines now keep the authored glyph size until the cell count would exceed `maxCells`, then
step the font size up. The piece spans the full width on any monitor; on a very large one it reads
as the same composition at a larger scale rather than a smaller one pinned to a corner.

Measured on a 3440x1440 display: ~26k cells ran at 18fps, below the engine's own 30fps target, so
the `nx.js` budget is 15000. The bed is also rebuilt at `bedFps` (default 12) rather than every
frame — it moves far too slowly for the difference to be visible, and rebuilding it at full rate
was the difference between 2fps and 60fps at that size.

### Layer levers
`span` `bump` `light` `contrast` `amb` `hgt` `dif` `spec` `shine` `rim` `rimPow` `drift`
`driftSpeed` `evolve` `edges` `edgeBoost` `edgeLift` `lineSmooth` `lineHyst` `vote` `dither`
`gamma` `persist` `cutoff` `ink` `inkLight` `gridSpace` `srgbBand` `oct`, plus
`shadedGrid` for a layer that supplies final brightness instead of a height field

Three that are easy to get wrong:
- **`gridSpace: true`** — the piece builds its height directly in CELL coordinates (the analytic-wave
  recipe the calm concepts use) rather than in world space. `bump` then reads in the same units as
  `field.js`, 28-34, not 1.9. Mixing the two conventions up gives normals ~8x too steep.
- **`gamma`** — the honest way to make a layer sparse. Raising the value to a power crushes the low
  end smoothly so most cells fall below the first ramp step and stop being drawn. `cutoff` does the
  same with a hard threshold and cells POP in and out as the field crosses it. Use gamma.
- **`vote`** — neighbourhood radius in cells for the contour direction vote. 0 is per-cell and looks
  like speckle. 1 (a 3x3) is the working default.

### `composite()` — one glyph per cell
Layers do NOT each draw their own glyph. Every cell is resolved by walking the layers front to back
and taking the first that has ink there. Before this, a three-layer piece stacked two or three
characters in the same character position, which reads as a smudge no single glyph could make and
made the layered piece look far heavier than its glyph mix said it was: 295% coverage against ~95%
for every other piece. Picking the nearest layer that covers the cell is also just what depth means.

### Greys are interpolated in LINEAR light
`hexrgb()` converts to linear on the way in, `band()` converts back to sRGB on the way out.
Interpolating sRGB values directly darkens the midpoint and bands in dark gradients — precisely the
range this project lives in. Fixing this brightened every piece by ~16 levels, so ink bands had to
be re-targeted afterwards; expect that if you touch it.

## Measuring a piece — `tools/measure.js`
Renders ONE frame headlessly (no browser, no screenshot) and reports what actually lands on screen.
Screenshotting to answer "is this too dense?" costs minutes; this costs a second.

```bash
node tools/measure.js assets/next/ridge.html 12      # file, then seconds into the animation
```

Reports **ink coverage**, **grey levels in use** and their spread, **ink weight**, **macro
structure**, **mean grey**, and the **glyph mix**. Works on both engines, so candidates and
references are measured the same way.

Read them together, because separately each one lies:
- **mean grey** is the colour a glyph is drawn in. It says nothing about how much of the cell that
  glyph fills — a `&` at grey 60 puts far more ink down than a `.` at grey 80.
- **ink weight** (mean ramp position) fixes that, but is a mean PER DRAWN CELL, so it misses a piece
  that draws twice as many cells.
- **coverage** catches that. A three-layer piece at 295% is overdrawing, not being dense.
- **macro structure** separates big organic masses from an even wash or a regular hatch.

Reference values, measured the same way, for calibration:

| Piece | coverage | ink weight | macro | mean grey |
|---|---|---|---|---|
| contours | ~98% | 0.290 | 7.8 | 48 |
| caustics | ~98% | 0.220 | 10.8 | 52 |
| dunes | ~98% | 0.481 | 20.3 | 69 |
| swell | ~98% | 0.624 | 26.6 | 78 |

Note coverage is ~100% for every good piece: **every cell gets a glyph.** The subtlety is not empty
space, it is that the whole image sits in a narrow band near the ground and the form reads through
glyph density. Chasing "fewer cells" is the wrong instinct.

## The matte — a sub-glyph pixel lattice (`assets/next/nx.js`)

Everything else in this engine works at the character cell, roughly 11x18 device pixels. The matte
works an order of magnitude finer: a lattice of 2-3 PIXEL blocks, each sitting at a slightly
different value, that the finished frame is resolved onto. It is what gives the image a produced,
photographed quality instead of looking like glyphs printed on flat black.

It is **not film grain**. Grain is per-pixel, random, and changes every frame, so it sits *on top of*
a picture. This is block-aligned, blue-noise derived, and **fixed** — it does not change frame to
frame — so the picture reads as resolved *onto* a surface.

### The control bar
Open any `assets/next/*.html` piece DIRECTLY and a control bar appears across the top:

`asciara` wordmark (Geist Pixel, links to the gallery) · a **switcher** listing every background in
the repo grouped by loadout · **off / field / noise** · the dials for the current mode ·
**light/dark** · **copy config** · **hide**

- It is gated on `window.self === window.top`, so it never appears in the gallery's iframe tiles.
- The switcher carries the current query string across, so settings and light mode survive a jump
  from one piece to the next.
- Only the dials that do something in the current mode are shown — `amp`/`contr`/`speed`/`wob` for
  noise, `bed`/`depth` for field.
- Every change rewrites the URL, so a setting you like is a link you can send or reload.
- **copy config** puts the exact line on the clipboard to paste back into the piece. This is the
  point of the whole bar: tuning that cannot get back into the source is just fiddling.
- The bar wraps onto extra rows on a narrow window rather than pushing controls off the edge.
- The switcher is built from `CATALOGUE` at the top of `nx.js` — add a background there and it
  appears in every other background's switcher.

Query overrides work without the bar too: `?matte=field|noise|off`, `?cell=`, `?amp=`, `?bed=`,
`?steps=`, `?contr=`, `?speed=`, `?wob=`, `?depth=`, `?light`.

```js
matte: { mode: 'noise', cell: 3, depth: 0.26, bed: 0.26, bedSteps: 2, amp: 20,
         contrast: 0.50, speed: 0.06, wobble: 0.50 }   // the tuned defaults
```

| Lever | Does |
|---|---|
| `mode` | `'field'` or `'noise'` — the two mattes, below |
| `cell` | lattice block size in DEVICE pixels. 2-3 is the range that reads as "light pixelation" |
| `depth` | how much the lattice varies the opacity of the glyph layer itself |
| `bed` | how present the tonal underlayer is. This is the main subtlety dial |
| `bedSteps` | quantisation levels in the bed. Fewer = blotchier; 9 is grain-fine |
| `amp` | `noise` only: peak-to-peak swing in sRGB levels. 40 is a floor, 64+ is clearly present |
| `contrast` | `noise` only: 0 spreads values evenly, 1 pushes them to the extremes. See below |
| `speed` | `noise` only: cycles per second each block travels light-to-dark. 0 = static |
| `wobble` | `noise` only: how far a block moves from its resting value |

**`mode: 'field'`** — the matte follows the picture. The bed is the shaded field itself, sampled
bilinearly *between* character cells, quantised and dithered, drawn as white at varying alpha so it
only ever *adds* light where the field is lit. Reinforces the form already there.

**`mode: 'noise'`** — the matte owes nothing to the picture. Every block takes its own fixed value,
a little lighter or darker than the ground, drawn opaque (it has to be able to go darker as well as
lighter, which alpha cannot do). Reads as the surface the image is printed on.

The noise swing is centred **half a step ABOVE the ground**, not on it. The ground sits near 8, so a
swing centred on it loses its whole dark half to clipping and the lattice reads at half strength.
Centring above lifts the black point slightly, which is the right direction anyway: pure black is
what makes a dark image read as flat rather than photographed. `amp` is in sRGB levels peak-to-peak
and is NOT scaled by `bed` — 40 is a floor, 64+ is clearly present.

### Motion, and why `contrast` exists
Blocks are not static. Each one drifts between light and dark on its own slow clock — the mask value
is its resting point, a sinusoid moves it either side, and every block carries a decorrelated phase
so they do not turn together. This is deliberately NOT per-frame randomness: that is grain, it
scintillates, and it is the thing this treatment exists to avoid. `speed` around 0.06 reads as the
surface breathing; 0 freezes it.

`contrast` is separate from `bedSteps` on purpose. Blue-noise values are uniformly spread, so at a
high step count most blocks sit near the middle and the lattice reads weak — the only way to get
punch used to be dragging `steps` down to 2, which forces the values bimodal but throws away the
level count as a side effect. `contrast` applies an S-curve BEFORE quantising, so it pushes values
toward the ends while keeping the levels. Contrast and granularity stopped fighting.

### Why it is built this way
- **The bed is rendered at one pixel per block** — a 3px lattice means a canvas a third the size —
  then scaled back up with `imageSmoothingEnabled = false`. That is what makes hard little blocks
  instead of a soft gradient.
- **Quantise, then dither.** An un-quantised gradient just looks like a blur. Quantised and
  dithered, it reads as an image resolved onto a grid.
- **The bed samples between cells while the glyphs snap to cells.** The two layers disagree at
  different scales, and that disagreement is what stops the whole thing looking like one flat pass.
- **The mask must actually be blue noise, and this is worth checking.** The first mask generated
  for `nx.js` had a bug in void-and-cluster's third phase — it searched for the zero with the
  highest energy measured over the ONES, when the algorithm requires the tightest cluster of zeros
  found via the INVERSE pattern's energy. The mask came out carrying large light and dark regions,
  and once tiled every 32 blocks those regions read on screen as a regular grid of soft round
  blobs. It looks like a design problem and is actually a generator bug. The test is cheap: average
  the mask into 8x8 blocks and take the spread of the block means. Near zero is correct — the
  shipped mask is 1.8, the broken one was 15.8. A visual QA pass explicitly looking for "a repeating
  cross-hatch or Bayer artefact" did NOT catch it, because the artefact was round, not hatched.
- **The swing must be centred away from BOTH ends.** Centred on the ground, half of it clips: on a
  near-black ground the dark half disappears, and on a near-white ground the light half does, which
  is why light mode showed almost no lattice at all. The centre is clamped to `[amp/2, 255-amp/2]`.
  On dark that lifts the black point slightly — the right direction anyway, since pure black is what
  makes a dark image read as flat rather than photographed.
- **Two approaches that do NOT work**, both tried: multiplying the finished frame does nothing,
  because the ground is near-black and black times anything is black — it only ever dims. And
  modulating the glyph layer's alpha alone does nothing either, because thin strokes over empty
  black give the lattice nothing to act on. It needs a continuous layer underneath.

## The lab — `assets/lab/`
The one place three.js is allowed, and the reason it is quarantined rather than adopted.

**Status: unverified.** `gpuascii.js` and `_smoke.html` exist and load; `volume.html`,
`flux.html` and `develop.html` are NOT written yet, so the lab gallery shows blank tiles. The smoke
test renders a black frame headlessly and it is not yet established whether that is a shader bug or
the known headless-WebGL failure. Do not treat this as working.

One trap already hit: `node --check gpuascii.js` PASSES on a file with a fatal ES-module syntax
error, because `--check` treats a `.js` file as CommonJS. Copy to `.mjs` first, or import it in a
browser. The error it missed was a comment inside a GLSL template literal that wrapped a word in
backticks and closed the template early.

### What the research actually concluded
- **GSAP: no.** It is fully free since April 2025 (Webflow acquisition, all plugins, redistribution
  permitted), so licensing is a non-issue — but it interpolates between defined states over a
  duration, and this project has no states. Motion is `f(x,y,t)` evaluated fresh every frame. If a
  parameter ever needs easing, that is one line: `cur += (tgt-cur) * (1 - Math.exp(-dt/tau))`.
- **three.js: not worth it for this aesthetic.** 178KB gzip breaks the single-file distribution by
  an order of magnitude. `AsciiEffect` is not even a canvas renderer — it builds a DOM `<table>` of
  `<span>`s and its colour mode drops the charset from 10 glyphs to 7. Headless WebGL is unreliable,
  which matters when screenshots are the verification method. What GPU genuinely unlocks — 500x200
  grids, live 3D scene normals, particle-fed cells — are wins for a bolder piece than this one.
- **Two things WERE worth stealing from the GPU world, and both are already in `nx.js` at zero cost:**
  tile-level directional voting for the contour channel, and (not yet done) pre-baking glyphs to an
  offscreen bitmap and blitting instead of `fillText`, which is a documented ~10x win and would
  raise the cell ceiling well past today's ~6000.
- **Blue noise beats Bayer** for the dither mask; error diffusion (Floyd-Steinberg) is disqualified
  for animation because it is scan-order sequential and crawls between frames.
- **Prior art:** `~/dev/accelerate-website/static/` has a decision-documented branch where this was
  already explored — `.block-runner/design-contract.md` keeps ASCII and three.js as separate
  registers, and `src/components/lab/dither-reveal.tsx` records an A/B where an ASCII-atlas variant
  LOST to Bayer dither on legibility for a scroll-driven image reveal. Narrow finding (revealing a
  screenshot is the opposite constraint from an ambient background) but real, and measured.

## Performance at large window sizes
Measured on the landing page (the heaviest: contour channel + dither + matte), frame-interval
distribution over 4s, viewport asserted in the same measurement:

| | p50 | p95 |
|---|---|---|
| 1440x900 | 16.7ms | 26.0ms |
| 2560x1440 | 16.7ms | 33.3ms |
| 3440x1440 | 17.2ms | 33.6ms |

Before the fix below, 3440x1440 was p50 22.2ms / p95 67.3ms — a 45fps median with visible stutter.

**The cause was the noise-mode bed being rebuilt full-screen.** In `noise` mode the bed owes nothing
to the picture: it is blue noise plus time. It never needed to be a full-screen buffer — 32 blocks
square is one whole period of the mask, so it is built as a tile and repeated. On a 3440 display
that is a 96x96 tile instead of ~550,000 samples per rebuild. `field` mode still needs the
full-screen path, because there the bed follows the image.

Other levers, in order of effect:
- **`fps`** — every piece is 30. These fields drift far too slowly for 60 to be visible, and 60
  doubles the work. The landing page and billow were the last two at 60; both are now 30.
- **`matte.depth: 0`** skips the offscreen glyph layer entirely. That layer exists only to let the
  lattice cut the glyphs' alpha, and it costs three full-screen operations per frame. The bed still
  supplies the lattice you actually see, so this is the cheapest way to keep the look on a weak GPU.
- **`maxCells`** bounds the grid; past it the glyphs grow rather than the field being clipped.
- **`matte.bedFps`** (default 12) throttles bed rebuilds.

### A measurement trap
`agent-browser set viewport` silently fails often enough that three consecutive "3440x1440" runs
were all actually 1280x577, which made an early read of this look like "no degradation with size".
Assert `window.innerWidth` INSIDE the measurement and retry until it matches — do not trust that
the viewport was applied.
