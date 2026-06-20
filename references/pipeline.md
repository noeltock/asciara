# Output pipeline — encoding, embedding, fonts
Reference for the `ascii` skill: turning frames into shareable assets, embedding on the web, and font/colour choices. Load when producing animation or web output.

## Encode an animation (frames → loop)
`animate` writes `frame_0000.png …` to the out dir. Encode with ffmpeg. Two-pass palette gives a clean, banding-free looping GIF:
```bash
# GIF — palette-optimised, infinite loop
ffmpeg -y -framerate 24 -i OUTDIR/frame_%04d.png -vf "palettegen=stats_mode=diff" /tmp/pal.png
ffmpeg -y -framerate 24 -i OUTDIR/frame_%04d.png -i /tmp/pal.png -loop 0 \
  -filter_complex "[0:v][1:v]paletteuse=dither=sierra2_4a" out.gif

# MP4 — broadest compatibility (yuv420p is required)
ffmpeg -y -framerate 24 -i OUTDIR/frame_%04d.png -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p out.mp4

# WebM — smallest, supports alpha for overlays
ffmpeg -y -framerate 24 -i OUTDIR/frame_%04d.png -c:v libvpx-vp9 -b:v 0 -crf 30 -pix_fmt yuva420p out.webm
```
The loop is already seamless (the field is sampled around a circle in time), so `-loop 0` on the GIF or an HTML `loop` attribute plays without a seam. Match `-framerate` to the `--frames` ÷ desired seconds.

## Embed on the web (a site hero)
**Option A — self-contained animated template (no build, no deps):** ship `assets/hero.html`. It renders a live looping flow field in a `<pre>`; tune the `CONFIG` block (ramp, cell, density, loopSeconds, colour). Copy its `<pre>` + `<style>` + `<script>` into the page, or iframe the file.

**Option B — `<video>` (most reliable, zero JS):** encode MP4 + WebM (above) and:
```html
<video autoplay muted loop playsinline style="background:#050505;width:100%">
  <source src="ascii-hero.webm" type="video/webm">
  <source src="ascii-hero.mp4" type="video/mp4">
</video>
```

## Fonts
Use a true monospace with good glyph coverage. Both are OFL-1.1, free to embed/redistribute (safe for public release):
- **Iosevka** — densest coverage incl. box/block glyphs; best for the `blocks` ramp
- **JetBrains Mono** — clean, reliable default
The tool auto-discovers a system monospace (Menlo/SF Mono on macOS, DejaVu Sans Mono on Linux) and falls back gracefully; pass `--font /path/to/Font.ttf` to pin one. For web, `font-family: "Iosevka","JetBrains Mono",monospace` with the woff2 self-hosted.

## Colour notes
- Default render is monochrome (`--fg`/`--bg`). Keep the background near-black, not pure black, and the foreground near-white, not pure white — the slight softening avoids a harsh bitmap look.
- `--color source` samples each cell's average colour from the image; only use it on already-desaturated/duotone sources, or it tips into novelty.
- Terminal preview only (not asset output): `chafa --symbols ascii --colors 256 image.png` is a fast path, but it has no edge channel, so it is not the skill's signature look.
