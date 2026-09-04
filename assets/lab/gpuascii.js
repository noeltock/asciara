/* gpuascii.js — a small three.js → ASCII post-processing lab.
   The established canvas engine works one character cell at a time. This keeps that
   rule, but moves the expensive image reads into a fragment shader so contours can
   vote together inside a tile instead of breaking into per-pixel hatching.

   The source scene is rendered twice rather than through an MRT. A normal override
   pass is reliable for ordinary three.js scenes (including scenes authored without
   special materials), while a DepthTexture attached to the colour target preserves
   the scene depth from the colour pass. MRT would need WebGL2 capability handling
   and material-specific normal output, neither of which is useful friction in a lab.

   The host page must map the bare `three` specifier with a pinned ESM import map:
   { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js" } }
*/

import * as THREE from 'three';

const TONAL_GLYPHS = ' .:;/<>=?*T%&#@N';
const DIRECTIONAL_GLYPHS = ['-', '/', '|', '\\'];
const ATLAS_COLUMNS = 16;
const ATLAS_CELL = 32;
const FONT = "300 26px 'Geist Mono', 'JetBrains Mono', Menlo, monospace";

const DEFAULT_LOOK = {
  cellSize: 16,
  inkLo: '#161616',
  inkHi: '#707070',
  edgeThreshold: 0.055,
  dogSigma: 1.25,
  ditherAmount: 0.45,
  depthFade: 0.35,
  gamma: 1
};

function makeGlyphAtlas(glyphs) {
  const rows = Math.ceil(glyphs.length / ATLAS_COLUMNS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * ATLAS_CELL;
  canvas.height = rows * ATLAS_CELL;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  glyphs.forEach((glyph, index) => {
    const x = (index % ATLAS_COLUMNS) * ATLAS_CELL + ATLAS_CELL / 2;
    const y = Math.floor(index / ATLAS_COLUMNS) * ATLAS_CELL + ATLAS_CELL / 2 + 0.5;
    context.fillText(glyph, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return { texture, grid: new THREE.Vector2(ATLAS_COLUMNS, rows) };
}

function makeRenderTarget(width, height, withDepthTexture) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace
  });

  if (withDepthTexture) {
    // Sampling the real depth pass lets the output shader dim distant cells without
    // trying to reconstruct depth from the displayed colour.
    target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    target.depthTexture.format = THREE.DepthFormat;
  }

  return target;
}

function asLinearColor(value) {
  // Modern three.js parses CSS/hex colour strings into its linear working space.
  // Keeping uniforms linear means the mix in the fragment shader cannot introduce
  // the dark-gradient banding that a direct sRGB interpolation would create.
  return new THREE.Color(value);
}

const vertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  uniform sampler2D uColorTexture;
  uniform sampler2D uNormalTexture;
  uniform sampler2D uDepthTexture;
  uniform sampler2D uTonalAtlas;
  uniform sampler2D uDirectionalAtlas;
  uniform vec2 uResolution;
  uniform vec2 uTonalAtlasGrid;
  uniform vec2 uDirectionalAtlasGrid;
  uniform float uTonalCount;
  uniform float uDirectionalCount;
  uniform float uCellSize;
  uniform float uPixelRatio;
  uniform float uEdgeThreshold;
  uniform float uDogSigma;
  uniform float uDitherAmount;
  uniform float uDepthFade;
  uniform float uGamma;
  uniform vec3 uInkLo;
  uniform vec3 uInkHi;

  #include <colorspace_pars_fragment>

  float lumaAt(vec2 pixel) {
    vec2 uv = clamp(pixel / uResolution, vec2(0.0), vec2(1.0));
    return dot(texture2D(uColorTexture, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
  }

  // A compact 3×3 Gaussian is enough here: the aim is not photographic blur, but a
  // local DoG signal that suppresses broad tonal gradients before Sobel finds lines.
  float blur3(vec2 pixel, float sigma) {
    float total = 0.0;
    float weightTotal = 0.0;
    float safeSigma = max(sigma, 0.25);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        float weight = exp(-dot(offset, offset) / (2.0 * safeSigma * safeSigma));
        total += lumaAt(pixel + offset * safeSigma) * weight;
        weightTotal += weight;
      }
    }
    return total / weightTotal;
  }

  vec2 sobelAt(vec2 pixel, float stepSize) {
    float a = lumaAt(pixel + vec2(-stepSize, -stepSize));
    float b = lumaAt(pixel + vec2( 0.0,     -stepSize));
    float c = lumaAt(pixel + vec2( stepSize, -stepSize));
    float d = lumaAt(pixel + vec2(-stepSize,  0.0));
    float f = lumaAt(pixel + vec2( stepSize,  0.0));
    float g = lumaAt(pixel + vec2(-stepSize,  stepSize));
    float h = lumaAt(pixel + vec2( 0.0,      stepSize));
    float i = lumaAt(pixel + vec2( stepSize,  stepSize));
    return vec2(-a - 2.0 * d - g + c + 2.0 * f + i,
                -a - 2.0 * b - c + g + 2.0 * h + i);
  }

  float bayer4(vec2 cell) {
    float x = mod(cell.x, 4.0);
    float y = mod(cell.y, 4.0);
    if (y < 1.0) return x < 1.0 ? -0.46875 : x < 2.0 ? 0.03125 : x < 3.0 ? -0.34375 : 0.15625;
    if (y < 2.0) return x < 1.0 ?  0.28125 : x < 2.0 ? -0.21875 : x < 3.0 ?  0.40625 : -0.09375;
    if (y < 3.0) return x < 1.0 ? -0.28125 : x < 2.0 ? 0.21875 : x < 3.0 ? -0.40625 : 0.09375;
    return              x < 1.0 ?  0.46875 : x < 2.0 ? -0.03125 : x < 3.0 ?  0.34375 : -0.15625;
  }

  vec2 atlasUv(float index, vec2 grid, vec2 glyphUv) {
    float column = mod(index, grid.x);
    float row = floor(index / grid.x);
    // Canvas has a top-left origin while the output quad's glyph coordinates are
    // bottom-left. Flip within each atlas cell so punctuation remains upright.
    return vec2((column + glyphUv.x) / grid.x,
                1.0 - (row + 1.0 - glyphUv.y) / grid.y);
  }

  float directionFor(vec2 gradient) {
    // Sobel points across a contour, while a directional glyph should lie along it.
    float angle = mod(atan(gradient.y, gradient.x) + 1.57079632679, 3.14159265359);
    return floor(mod(angle + 0.3926990817, 3.14159265359) / 0.78539816339);
  }

  void main() {
    // cellSize is a CSS-pixel control. Multiplying here keeps a 16px character
    // physically 16 CSS pixels on Retina while all source sampling stays device sharp.
    vec2 cellSize = vec2(max(1.0, uCellSize * uPixelRatio));
    vec2 cell = floor(gl_FragCoord.xy / cellSize);
    vec2 cellOrigin = cell * cellSize;
    vec2 cellUv = clamp((cellOrigin + cellSize * 0.5) / uResolution, vec2(0.0), vec2(1.0));
    vec2 glyphUv = fract(gl_FragCoord.xy / cellSize);

    // Four samples around the centre are the cell's mean tone. It is deliberately
    // stable per tile; using one sample per output pixel would reintroduce shimmer.
    vec2 toneOffset = cellSize * 0.25;
    float tone = 0.25 * (
      lumaAt(cellOrigin + cellSize * 0.5 + vec2(-toneOffset.x, -toneOffset.y)) +
      lumaAt(cellOrigin + cellSize * 0.5 + vec2( toneOffset.x, -toneOffset.y)) +
      lumaAt(cellOrigin + cellSize * 0.5 + vec2(-toneOffset.x,  toneOffset.y)) +
      lumaAt(cellOrigin + cellSize * 0.5 + vec2( toneOffset.x,  toneOffset.y))
    );

    // Vote over a 4×4 lattice across the entire character cell. Every output pixel
    // performs the same deterministic vote, so an accepted contour uses one intact
    // directional glyph rather than a scatter of independently chosen fragments.
    vec4 votes = vec4(0.0);
    float voteCount = 0.0;
    float cellEdge = 0.0;
    float sigma = max(0.25, uDogSigma * uPixelRatio);
    for (int y = 0; y < 4; y++) {
      for (int x = 0; x < 4; x++) {
        vec2 samplePosition = cellOrigin + (vec2(float(x), float(y)) + 0.5) * cellSize / 4.0;
        float dog = abs(blur3(samplePosition, sigma) - blur3(samplePosition, sigma * 1.6));
        vec2 gradient = sobelAt(samplePosition, max(1.0, sigma * 0.75));
        float strength = length(gradient) * 0.5 + dog;
        cellEdge += strength;
        if (strength > uEdgeThreshold) {
          float direction = directionFor(gradient);
          if (direction < 0.5) votes.x += 1.0;
          else if (direction < 1.5) votes.y += 1.0;
          else if (direction < 2.5) votes.z += 1.0;
          else votes.w += 1.0;
          voteCount += 1.0;
        }
      }
    }
    cellEdge /= 16.0;

    float glyphIndex;
    bool useDirectional = voteCount > 0.0 && cellEdge > uEdgeThreshold;
    if (useDirectional) {
      glyphIndex = 0.0;
      float winner = votes.x;
      if (votes.y > winner) { glyphIndex = 1.0; winner = votes.y; }
      if (votes.z > winner) { glyphIndex = 2.0; winner = votes.z; }
      if (votes.w > winner) { glyphIndex = 3.0; }
    } else {
      // Ordered dither is cell-constant; a stipple is useful, temporal crawl is not.
      tone += bayer4(cell) * uDitherAmount / max(1.0, uTonalCount);
      glyphIndex = floor(clamp(tone, 0.0, 0.999999) * uTonalCount);
    }

    // Both normal and depth are real render-pass inputs, not inferred from colour.
    // Facing normals subtly lift curved geometry; depth then fades the result back.
    vec3 normal = texture2D(uNormalTexture, cellUv).xyz * 2.0 - 1.0;
    float normalRelief = 1.0 - max(normal.z, 0.0);
    float depth = texture2D(uDepthTexture, cellUv).x;
    tone = clamp(tone + normalRelief * 0.06, 0.0, 1.0);
    tone *= 1.0 - clamp(uDepthFade, 0.0, 1.0) * depth;
    tone = pow(max(tone, 0.0), 1.0 / max(uGamma, 0.001));

    float mask;
    if (useDirectional) {
      mask = texture2D(uDirectionalAtlas, atlasUv(glyphIndex, uDirectionalAtlasGrid, glyphUv)).a;
    } else {
      mask = texture2D(uTonalAtlas, atlasUv(glyphIndex, uTonalAtlasGrid, glyphUv)).a;
    }

    // uInkLo/uInkHi are linear. three.js converts the final linear interpolation to
    // the canvas output space through this chunk only after the grey band is mixed.
    gl_FragColor = vec4(mix(uInkLo, uInkHi, tone) * mask, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Render a caller-owned scene and camera as a GPU-computed ASCII field.
 *
 * `look.cellSize`, `dogSigma`, and the atlas font are CSS-pixel concepts; the
 * renderer and render targets remain device-pixel-sized for a sharp Retina result.
 * Await `ready` before first render so browser-loaded monospace fonts are baked into
 * the two runtime atlases rather than a transient fallback face.
 */
export class GPUAscii {
  constructor({ scene, camera, canvas, look = {}, onResize } = {}) {
    if (!scene || !camera) throw new Error('[GPUAscii] A three.js scene and camera are required.');

    this.scene = scene;
    this.camera = camera;
    this.onResize = onResize;
    this.look = { ...DEFAULT_LOOK, ...look };
    this.contextLost = false;
    this._ownsCanvas = !canvas;
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.style.display = 'block';
    if (this._ownsCanvas) document.body.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);

    this._normalMaterial = new THREE.MeshNormalMaterial();
    this._screenScene = new THREE.Scene();
    this._screenCamera = new THREE.Camera();
    this._screenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._makeOutputMaterial());
    this._screenScene.add(this._screenQuad);

    this._resize = this._resize.bind(this);
    this._onContextLost = this._onContextLost.bind(this);
    this._onReducedMotionChange = this._onReducedMotionChange.bind(this);
    this.canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    window.addEventListener('resize', this._resize);
    this._reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion = this._reducedMotionQuery.matches;
    this._reducedMotionQuery.addEventListener('change', this._onReducedMotionChange);

    this._resize();
    this.ready = this._createAtlases();
  }

  _makeOutputMaterial() {
    const placeholderTexture = new THREE.Texture();
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColorTexture: { value: placeholderTexture },
        uNormalTexture: { value: placeholderTexture },
        uDepthTexture: { value: placeholderTexture },
        uTonalAtlas: { value: placeholderTexture },
        uDirectionalAtlas: { value: placeholderTexture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTonalAtlasGrid: { value: new THREE.Vector2(ATLAS_COLUMNS, 1) },
        uDirectionalAtlasGrid: { value: new THREE.Vector2(ATLAS_COLUMNS, 1) },
        uTonalCount: { value: TONAL_GLYPHS.length },
        uDirectionalCount: { value: DIRECTIONAL_GLYPHS.length },
        uCellSize: { value: DEFAULT_LOOK.cellSize },
        uPixelRatio: { value: 1 },
        uEdgeThreshold: { value: DEFAULT_LOOK.edgeThreshold },
        uDogSigma: { value: DEFAULT_LOOK.dogSigma },
        uDitherAmount: { value: DEFAULT_LOOK.ditherAmount },
        uDepthFade: { value: DEFAULT_LOOK.depthFade },
        uGamma: { value: DEFAULT_LOOK.gamma },
        uInkLo: { value: asLinearColor(DEFAULT_LOOK.inkLo) },
        uInkHi: { value: asLinearColor(DEFAULT_LOOK.inkHi) }
      }
    });
  }

  async _createAtlases() {
    // Waiting is essential: a CanvasTexture is just pixels, so it cannot repair a
    // fallback glyph after a web font finishes arriving.
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    this.tonalAtlas = makeGlyphAtlas([...TONAL_GLYPHS]);
    this.directionalAtlas = makeGlyphAtlas(DIRECTIONAL_GLYPHS);
    const uniforms = this._screenQuad.material.uniforms;
    uniforms.uTonalAtlas.value = this.tonalAtlas.texture;
    uniforms.uDirectionalAtlas.value = this.directionalAtlas.texture;
    uniforms.uTonalAtlasGrid.value.copy(this.tonalAtlas.grid);
    uniforms.uDirectionalAtlasGrid.value.copy(this.directionalAtlas.grid);
    this.setLook(this.look);
  }

  _onContextLost(event) {
    event.preventDefault();
    this.contextLost = true;
    console.error('[GPUAscii] WebGL context lost; rendering is paused until the caller recreates the pipeline.');
  }

  _onReducedMotionChange(event) {
    this.prefersReducedMotion = event.matches;
  }

  _resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    const drawWidth = this.renderer.domElement.width;
    const drawHeight = this.renderer.domElement.height;
    this._colorTarget?.setSize(drawWidth, drawHeight);
    this._normalTarget?.setSize(drawWidth, drawHeight);
    if (!this._colorTarget) this._colorTarget = makeRenderTarget(drawWidth, drawHeight, true);
    if (!this._normalTarget) this._normalTarget = makeRenderTarget(drawWidth, drawHeight, false);

    const uniforms = this._screenQuad.material.uniforms;
    uniforms.uResolution.value.set(drawWidth, drawHeight);
    uniforms.uPixelRatio.value = pixelRatio;
    if (this.onResize) this.onResize({ width, height, pixelRatio, drawWidth, drawHeight });
  }

  setLook(nextLook = {}) {
    Object.assign(this.look, nextLook);
    const uniforms = this._screenQuad.material.uniforms;
    uniforms.uCellSize.value = this.look.cellSize;
    uniforms.uEdgeThreshold.value = this.look.edgeThreshold;
    uniforms.uDogSigma.value = this.look.dogSigma;
    uniforms.uDitherAmount.value = this.look.ditherAmount;
    uniforms.uDepthFade.value = this.look.depthFade;
    uniforms.uGamma.value = this.look.gamma;
    uniforms.uInkLo.value.copy(asLinearColor(this.look.inkLo));
    uniforms.uInkHi.value.copy(asLinearColor(this.look.inkHi));
  }

  render() {
    if (this.contextLost || !this.tonalAtlas || !this.directionalAtlas) return false;

    const previousTarget = this.renderer.getRenderTarget();
    const previousOverride = this.scene.overrideMaterial;
    const previousAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = true;

    try {
      this.renderer.setRenderTarget(this._colorTarget);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      this.scene.overrideMaterial = this._normalMaterial;
      this.renderer.setRenderTarget(this._normalTarget);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);

      this.scene.overrideMaterial = previousOverride;
      this.renderer.setRenderTarget(null);
      this.renderer.clear(true, true, true);
      this.renderer.render(this._screenScene, this._screenCamera);
      return true;
    } finally {
      this.scene.overrideMaterial = previousOverride;
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = previousAutoClear;
    }
  }

  dispose() {
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this._reducedMotionQuery.removeEventListener('change', this._onReducedMotionChange);
    this._colorTarget.dispose();
    this._normalTarget.dispose();
    this.tonalAtlas?.texture.dispose();
    this.directionalAtlas?.texture.dispose();
    this._normalMaterial.dispose();
    this._screenQuad.geometry.dispose();
    this._screenQuad.material.dispose();
    this.renderer.dispose();
    if (this._ownsCanvas) this.canvas.remove();
  }
}

export { DIRECTIONAL_GLYPHS, TONAL_GLYPHS };
