# Animated ASCII backgrounds: architecture, levers, technique
Reference for the embeddable web backgrounds in `assets/` and `assets/concepts/`. Load this when building, tuning, or explaining an animated ASCII background, a logo treatment, or the rotating 3D mark.

## The pieces
| File | What it is | Modes |
|---|---|---|
| `assets/hero.html` | simple drifting noise field in a `<pre>`, one grey. Quiet, minimal. | dark / `?light` |
| `assets/hero2.html` | the signature: a LIT VOLUMETRIC SURFACE on canvas, graded greys, flowing. Default choice. | dark / `?light` |
| `assets/concepts/dissolve.html` | the Accelerate logo as a STATIC isometric 3D prism, sitting in the hero2 field. | dark / `?light` |
| `assets/concepts/logo-3d.html` | the same prism ROTATING 360° about its vertical axis (software 3D). | dark / `?light` |
| `assets/concepts/contours.html` | slow topographic ridge lines. | dark / `?light` |
| `assets/concepts/logo-iso.html` | snapshot backup of the static iso logo. | — |
| `assets/concepts/index.html` | the gallery — one page linking each piece, dark + light. | — |
| `assets/concepts/all.html` | all pieces rendering live on one page (heavy; preview only). | — |

## The shared engine — `assets/concepts/engine.js`
All `concepts/*` pieces run on this. A concept supplies a `compute(buf, cols, rows, t, ov)` callback; the engine owns the canvas, DPR scaling, font, fps throttle, and the two-layer render. Helpers exposed: `ASCIARA.noise(x,y)`, `ASCIARA.fbm(x,y)`, `ASCIARA.hash(ix,iy)`.

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
| `maxCols` | cap horizontal cells (perf) | `160` |

## hero2.html CONFIG levers (the lit surface)
| Lever | Does | Typical | Notes |
|---|---|---|---|
| `ramp` | the alphabet, light→dense | `" .:;/<>=?*T%&#@N"` | MUST be coverage-ordered |
| `fontFamily` / `fontWeight` | typeface | Geist Mono / `300` | loaded via the `<link>` in `<head>` |
| `fontSize` | glyph + cell size | `13-18` | |
| `pad` | gap around each glyph | `0-3` | 0 tight, 2 default, 3 airy mesh |
| `span` | macro scale | `1.1-2.0` | SMALLER = BIGGER forms |
| `bump` | relief strength | `1.5-3.0` | higher = more dramatic lighting |
| `light` | light direction `[x,y,z]` | `[-0.5,-0.6,0.62]` | upper-left toward viewer |
| `contrast` | tonal punch | `1.0-1.6` | lower subtler; higher crisper |
| `bg` | background | `#080808` | near-black, not pure black |
| `ink` | `[faint, dense]` value-band — **the subtlety dial** | `["#161616","#707070"]` | narrow+dark = whisper (dark on darker); widen/brighten for presence. `?light` flips to grey-on-white |
| `levels` | grey buckets | `8-16` | shading only |
| `shading` | graded greys vs monochrome | `true`/`false` | |
| `mono` | glyph colour | `#cfcfcf` | `shading:false` |
| `fps` | cadence | `8-60` | 60 smooth; 8-12 terminal |
| `flow` | drift direction `[x,y]` | `[-0.85,-0.32]` | surface flows this way |
| `flowSpeed` | drift speed | `0.02-0.12` | lower = subtler |
| `evolve` | internal meander | `0.0-0.3` | gentle life atop the drift |

### Quick presets
- **Attio-style (default):** `shading:true, span:1.5, bump:1.9, contrast:1.05, flow on, Geist Mono Light, web ramp`.
- **Subtle / "dark on darker":** narrow + dark `ink` (e.g. `["#161616","#707070"]`), low `flowSpeed`, `span` low.
- **Light mode:** `?light` — `bg:#fbfbfb`, `ink:["#ececec","#9a9a9a"]` (grey on near-white).
- **Old terminal:** `shading:false, fps:10, contrast:1.4, mono` (phosphor green/amber).

## Logo layer levers (dissolve.html — static isometric prism)
The Accelerate triangle, extruded into a 2-shade isometric solid, on the hero2 field, with a faded moat around it.
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

## Logo layer levers (logo-3d.html — rotating prism)
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
