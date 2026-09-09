# WebGL2 next-engine trial

`gl.js` exposes `window.GL` with the `NX({...})` configuration shape. `screen.html` and
`ridge.html` are the two next-engine pieces with only their renderer symbol and script changed.

CPU work is deliberately limited to each piece's `heightGrid`/`height` callback and a small
per-layer gradient maximum used to keep the contour threshold comparable to `nx.js`. WebGL does
height-field shading, ramp/dither and edge glyph choice, nearest-layer compositing, glyph-atlas
rendering, all three matte modes, their curve/floor controls, the blue-noise lattice, and lattice
alpha cut.

When a piece supplies `fps`, GL updates its field at that rate while still rendering every animation
frame. Each layer retains previous and current float slices in one texture array, and the cell pass
interpolates between them; its scalar gradient maximum is interpolated on the CPU too. Matte time
remains on the render clock. Missing or render-rate-or-higher `fps` keeps the every-frame path.
`GL.stats.fieldMs` is the running update cost on a field-update frame and `0` on an interpolated frame.

This trial does not port the next control bar or gallery navigation. It also does not yet duplicate
the next engine's temporal contour hysteresis/directional vote or phosphor persistence; those keys
warn once if used where they affect output. The existing `screen` and `ridge` callback/config
surface, per-layer matte, `GL.LIGHT`, and `GL.fbm` are supported.

From the repository root, run the existing server if needed, then benchmark both renderers:

```sh
python3 -m http.server 8765
tools/bench.sh /tmp/asciara-gl-bench assets/gl/screen.html assets/next/screen.html assets/gl/ridge.html assets/next/ridge.html
```
