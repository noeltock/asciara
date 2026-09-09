# WebGL2 background engine

`gl.js` is the engine every non-logo page loads. It exposes `window.GL` and the same function as
`window.NX`, so existing `NX({...})` pieces retain their callback and configuration surface.
`assets/next/nx.js` stays untouched as the Canvas reference implementation.

Each layer keeps its height-field slices plus a ping-pong temporal cell state. That state stores
brightness persistence, smoothed contour magnitude, hysteresis, and the directional-vote result;
the GPU reduces each layer's gradient maximum before applying the same temporal contour controls as
the reference. WebGL also handles material shading, ramp/dither and edge glyph choice, nearest-layer
compositing, glyph-atlas rendering, every matte mode, and lattice alpha cut.

The direct-page control bar matches the Canvas reference: matte modes and dials update live, the
link query reflects the setting, copy config writes the source-ready matte object, and the catalogue
switcher carries query settings to its destination. `ui: false` suppresses it.

From the repository root, benchmark the GL pages against their Canvas reference if needed:

```sh
python3 -m http.server 8765
tools/bench.sh /tmp/asciara-gl-bench assets/next/screen.html assets/next/ridge.html
```
