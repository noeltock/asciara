# The aesthetic — hitting the middle ground
Reference for the `ascii` skill. The goal is the zone where the characters and the image read *together*: not crude stick-figure ASCII, not a soulless glyph-per-pixel photo. Load this when choosing parameters.

## The three levers that make or break it
1. **Glyph size relative to subject.** The single most important control. The grid must be coarse enough that you read each character *as a character* while still seeing the image. Sweet spot: **60-110 columns** for a full image/portrait; cell size **12-20px**. Below ~40 cols reads as abstract; above ~140 collapses into mechanical pixel-mapping and loses soul. `--width` and `--cell` set this.
2. **Structure, not just brightness.** Naive generators map luminance to a ramp and stop. The soul comes from the **edge channel**: a Sobel pass that lays directional glyphs (`| / - \`) along contours. Keep it on (`image` default). Tune `--edge-threshold` (0.12 busy → 0.28 sparse).
3. **Restraint in colour.** Monochrome-on-dark is the default and usually the right answer. A single accent hue reads as intentional; duotone is the ceiling. Full per-character RGB kills the grid-as-medium reading. Lift the black point slightly (built in) so glyphs *glow* on the dark field rather than sitting in hard-contrast.

## Ramp curation
Small, chosen sets beat the full 70-char ramp for intentional texture. Built-in ramps (light → dense):
- `mono10` ` .:-=+*#%@` — the workhorse; dense portraits, full tonal range
- `fine` — 70-step, maximum tonal depth for high-res portraits
- `calm` ` .·:-=` — sparse ambient fields
- `drift` ` .·:*+` — gentle motion
- `soft` ` .:-=+*#` — soft tonal shading
- `blocks` ` ░▒▓█` — painterly shading, moves toward texture over text
- `web` ` .:;/<>=?*T%&#@N` — coverage-ordered code-symbol set

Pass any literal string to `--ramp` for a custom set (order light→dense). 7-15 glyphs is the intentional-texture zone.

## Motion (animation) — why it feels calm
Calm = **low spatial frequency + slow + seamless + eased**. Use noise/flow, never per-frame randomness (that flickers and reads anxious). The animator loops seamlessly by sampling the field along a **circle in time** (no visible seam) and domain-warps two octaves for organic drift. Keep frame counts generous (a 6-18s loop at 24-30fps) so motion breathes.

## Four presets (encoded in the tool)
Output is greyscale; a preset sets only ramp and density.

| Preset | Use | Ramp | Density | Feel |
|---|---|---|---|---|
| `calm` | ambient hero / wallpaper | calm | 0.45 | meditative, sparse |
| `drift` | motion background | drift | 0.55 | gentle organic flow |
| `soft` | soft ambient field | soft | 0.50 | low-contrast, smooth |
| `mono` | dense portrait / static image | mono10 | 0.60 | maximum tonal fidelity |

## Quick recipes
- **Soulful portrait:** `image photo.jpg --width 100 --ramp mono10 --cell 12` (edges on, mono). For more grit drop `--edge-threshold 0.14`.
- **Calm web hero:** the `assets/mist.html` template, or `animate --preset calm` → loop GIF/MP4.
- **Structural / graphic object:** `image logo.png --width 110 --ramp " .:|-/\\+#" --edge-threshold 0.12` (edge-forward, sparse interiors).
- **Duotone motion:** `animate --preset drift` then encode WebM with alpha for overlay use.

## Cross-preset rules
- True monospace only; the tool corrects the ~1:2 cell aspect automatically.
- Never go below 12px cells — glyph legibility is the medium.
- Perceptual luminance `0.3R+0.59G+0.11B`, not flat average.
- Two palette colours max (foreground + void), optional single accent tier.
