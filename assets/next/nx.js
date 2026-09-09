/* nx.js — the asciara "next" engine.
   Every background in the repo today is one lit height field turned into one number per cell:
   the glyph carries HOW MUCH light and nothing else. This engine adds the four things that
   were missing, and each new piece leans on one of them.

     1. MATERIAL, not just diffuse. Blinn-Phong specular + a rim term, so a crest can glint and
        a silhouette can catch light. `dot(n,l)` alone always reads as matte cloth.
     2. A DIRECTIONAL GLYPH CHANNEL. This is the Sobel idea from the image converter, in motion:
        where the shaded field has a strong gradient the cell takes a CONTOUR glyph ( - / | \ )
        chosen by angle instead of a tonal one. Tone still sets brightness. The characters start
        describing form, not just density — which is the whole thesis of the project, and no
        existing background does it.
     3. LAYERS. Several fields drawn back-to-front, each with its own scale, drift and ink band,
        so depth comes from parallax and aerial perspective instead of one flat plane.
     4. PERSISTENCE. An optional per-cell decay buffer, so motion leaves a phosphor trail and
        the piece has a memory of where it has been.

   A piece supplies layers. A layer supplies MOTION — height(x,y,t) — and its own LOOK.
   Usage:  NX({ layers:[ {height(x,y,t){...}, span:1.5, ink:["#161616","#707070"]} ] })
   Helpers: NX.noise, NX.fbm, NX.warp, NX.sdTriangle, NX.smoothstep, NX.mix, NX.LIGHT
*/
(function () {

  // --- noise ------------------------------------------------------------------------------
  // Integer hash, not Math.sin — sin-hash bands visibly at scale and is slower.
  function hash(ix, iy){
    let h = (ix|0)*374761393 + (iy|0)*668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function sm(t){ return t*t*t*(t*(t*6-15)+10); }
  function noise(x, y){
    const ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy;
    const u = sm(fx), v = sm(fy);
    const a = hash(ix,iy), b = hash(ix+1,iy), c = hash(ix,iy+1), d = hash(ix+1,iy+1);
    return (a*(1-u)+b*u)*(1-v) + (c*(1-u)+d*u)*v;
  }
  function fbm(x, y, oct){
    let s = 0, amp = 0.55, f = 1.0;
    const n = oct || 4;
    for (let o = 0; o < n; o++){ s += amp * noise(x*f, y*f); f *= 2; amp *= 0.5; }
    return s;
  }
  // two-step domain warp — the folds and billows come from here, not from the octaves
  function warp(x, y, amt, oct){
    const a = amt == null ? 1.6 : amt;
    const qx = fbm(x, y, oct),                   qy = fbm(x+5.2, y+1.3, oct);
    const rx = fbm(x+a*qx+1.7, y+a*qy+9.2, oct), ry = fbm(x+a*qx+8.3, y+a*qy+2.8, oct);
    return fbm(x + 1.8*rx, y + 1.8*ry, oct);
  }
  function smoothstep(e0, e1, x){ const t = Math.max(0, Math.min(1, (x-e0)/(e1-e0))); return t*t*(3-2*t); }
  function mix(a, b, t){ return a + (b-a)*t; }

  // signed distance to a triangle (negative inside) — used to grow a logo out of the terrain
  function sdTriangle(px, py, p0, p1, p2){
    function edge(a, b){
      const ex = b[0]-a[0], ey = b[1]-a[1], wx = px-a[0], wy = py-a[1];
      const t = Math.max(0, Math.min(1, (wx*ex + wy*ey) / (ex*ex + ey*ey)));
      const dx = wx - ex*t, dy = wy - ey*t;
      return [dx*dx + dy*dy, wx*ey - wy*ex];
    }
    const e0 = edge(p0,p1), e1 = edge(p1,p2), e2 = edge(p2,p0);
    const s = Math.sign(e0[1]) === Math.sign(e1[1]) && Math.sign(e1[1]) === Math.sign(e2[1]) ? -1 : 1;
    return s * Math.sqrt(Math.min(e0[0], e1[0], e2[0]));
  }

  // DITHER MASK — 32x32 blue noise, generated offline by void-and-cluster (Ulichney 1993).
  // Verify any replacement before trusting it: the FIRST mask generated for this file had a bug
  // in the algorithm's third phase and carried large light and dark regions. Tiled across the
  // frame those regions read as a regular grid of blobs — the giveaway that a "blue noise" mask
  // is not actually blue. The test is cheap: average the mask into 8x8 blocks and take the
  // spread of the block means. It should be near zero (this one is 1.8; the broken one was 15.8).
  // A ramp of ~16 glyphs quantises a smooth field into 16 steps, and quantisation shows as
  // banding: flat plateaus of one glyph with a hard seam where the value crosses a step.
  // Dithering is the correct fix. Blue noise rather than a Bayer matrix because Bayer's energy
  // sits at low frequencies too, so it reads as a visible cross-hatch; blue noise is
  // high-frequency only, so it reads as fine grain. The mask is fixed per cell and does not
  // change between frames, so it never crawls.
  const BN = (function(){
    const b = atob("I5d/zzB8rETKdU4MaCxLiBfskFn8CV7jkfRCKrUXYD/+AULzT+UGZZ0vvtep6QDPo3AOyXfXoi9QA2fThe2gu2alxY0dodOK8ROBOlSVvFoz4E2aOiRrxq/beqgNTS2A11UubbVbPCFR36L3GXkl/ISvIOe9i/cYgzsi+1zH4hmuEe3PCvt4x7RuJ1/B3kNqDdRifgFZRpvmVbiMN3KSPmyJSX6aM9yQAUXRmAiHscyeRy/yodm5C2nJE96kBbz3ody5I2KsFlin7X088lMwHO+Pwm8+JnPuNZZ2KmTrUSBdBDrw0kf0dDHDErNrouB3XAexFMqRrRzRSPawQsiCNebKknEMgrgh4oZcKdgMjkHHgUz/XuNOh1+gCInYEpi3FGtLs582zmOdSP6Vuk74qifqmyB8MQr5uyXhVm8o/XasLvYX41SNCdQawTt1I2cR0zhk2byk1mw8ecQ1pr5SPZTUf17EJOxBsWiBAszqn7tYka8CQVeSFavoD4zwAoThWAu9NJNqqnfzLNqoWoowe/Udc+eI8Cm/Spda1ERnzR/ybKZJ/wTdHleQSuYbRNgHS9A0wxho0H/0HnMqtpk0q4ss3xvHhziewwu2bpX8ZcCIp2GYTK45BGLMqvx+FepMBsqWeVGyYtJ9+TsnxhWtOfAm3Av/dOKeuDNICNxhxHr6Wz/pDfEmSBdlo9Z5UJxyEFV8ui2NHFGG2ZRWpCVAr22nH7ZxnILareRUigboK9W16aBA0VzG9ikR7m27h+MUMNuDzis9vgCPMhnzP7CFYEaOG23rBqY+ZHvFHjbOU5TDRQVW5Gb2U2/Lnbxs0Bn4A8UzsU2Rdr3lqkaZ+QNz7mOf+IysEqQk5UN7KFiWN6Zw4n37EssxGosI3V+BSbQYKL1wNclKhcKWCf3VD+x/zFcpmFuj3WX1WTu3Jeal1Y7nUBDfIWrZMlm0ZKhKuB1CshbYPSKDQ8Kh0XCTEzFpQMiJrnqc+w537x6CNJNm13X3hcJo87UBeCwO/UXGevgMYCTxOVe5RqnNTtq/AvErmwdPqRCPVOGa6IZdqd5Vs53hR78JkNMuigqUJud2UMVe4DjpdDLNH2lLsjYbiwAugBZ0omHkHHHqW7ppP6uPGq6AyyOZ76g+wBTP7nHB9E/SN/3NKH2gTMg3+p4Qzi/+RRFnt1INYIT6dZInoz1mmrZdBY1St/UDq4AWeE3rhm/Vk+RDjMTbLa0FWkfgE9YghMGnQewYOmrfKsDdpV8HvlUtpQTyaxpPl9LruYhysEnvbivbcpvWiVKXYzgfyDycHfV40DaDsu1uOSFjCvoylQ7lVrMPXb8i/g/osI75e960YUC6Ip9EwBV+qsuZU9p8yQ=="), a = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) a[i] = (b.charCodeAt(i) + 0.5)/256 - 0.5;   // -0.5 .. +0.5
    return a;
  })();

  // The catalogue the nav is built from. One list, so adding a background makes it appear in
  // every other background's switcher without touching anything else.
  const CATALOGUE = [
    ['', [
      ['home',     '/']
    ]],
    ['next', [
      ['ridge',    '/assets/next/ridge.html'],
      ['glint',    '/assets/next/glint.html'],
      ['strata',   '/assets/next/strata.html'],
      ['phosphor', '/assets/next/phosphor.html'],
      ['mark',     '/assets/next/mark.html'],
      ['screen',   '/assets/next/screen.html']
    ]],
    ['current', [
      ['billow',   '/assets/billow.html'],
      ['mist',     '/assets/mist.html'],
      ['contours', '/assets/concepts/contours.html'],
      ['swell',    '/assets/concepts/swell.html'],
      ['dunes',    '/assets/concepts/dunes.html'],
      ['tide',     '/assets/concepts/tide.html'],
      ['plume',    '/assets/concepts/plume.html'],
      ['caustics', '/assets/concepts/caustics.html'],
      ['aurora',   '/assets/concepts/aurora.html'],
      ['wind',     '/assets/concepts/wind.html'],
      ['current',  '/assets/concepts/current.html'],
      ['monolith', '/assets/concepts/monolith.html'],
      ['gyre',     '/assets/concepts/gyre.html']
    ]],
    ['lab', [
      ['smoke',    '/assets/lab/_smoke.html']
    ]]
  ];

  const LIGHT_MODE = new URLSearchParams(location.search).has('light');

  // Greys are interpolated in LINEAR light, not in sRGB. Mixing sRGB values directly is the
  // classic cause of banding and a dark, muddy midpoint — and this project spends its whole life
  // in a narrow band just above black, which is exactly where that error is most visible.
  function s2l(c){ c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4); }
  function l2s(v){ v = v <= 0.0031308 ? v*12.92 : 1.055*Math.pow(v, 1/2.4) - 0.055;
                   return Math.max(0, Math.min(255, Math.round(v*255))); }
  function hexrgb(h){ h = h.replace('#','');
    return [s2l(parseInt(h.slice(0,2),16)), s2l(parseInt(h.slice(2,4),16)), s2l(parseInt(h.slice(4,6),16))]; }
  function band(lo, hi, b){
    return 'rgb(' + l2s(lo[0]+(hi[0]-lo[0])*b) + ',' +
                    l2s(lo[1]+(hi[1]-lo[1])*b) + ',' +
                    l2s(lo[2]+(hi[2]-lo[2])*b) + ')';
  }
  // The original concepts were art-directed against sRGB interpolation. Linear is the correct
  // maths and everything new uses it, but switching an existing piece to it lifts its midtones by
  // roughly sixteen levels — which is not a bug fix on work someone already tuned by eye, it is a
  // restyle. A layer can opt back into the old behaviour so ported pieces look exactly as before.
  function bandSrgb(lo, hi, b){
    return 'rgb(' + Math.round(l2s(lo[0]) + (l2s(hi[0])-l2s(lo[0]))*b) + ',' +
                    Math.round(l2s(lo[1]) + (l2s(hi[1])-l2s(lo[1]))*b) + ',' +
                    Math.round(l2s(lo[2]) + (l2s(hi[2])-l2s(lo[2]))*b) + ')';
  }

  // --- main -------------------------------------------------------------------------------
  function run(spec){
    const C = Object.assign({
      ramp: " .:;/<>=?*T%&#@N",        // coverage-ordered, light -> dense
      edgeGlyphs: ["-", "/", "|", "\\"],
      fontSize: 15, fontWeight: 300,
      fontFamily: "'Geist Mono','JetBrains Mono',Menlo,monospace",
      pad: 2, fps: 30, levels: 14,
      maxCells: 15000,   // work budget. Past this the glyphs grow instead of the field being clipped.
      //                   Measured: ~26k cells only managed 18fps on a 3440x1440 display, below
      //                   this engine's own 30fps target. 15k holds the frame rate and the piece
      //                   simply reads at a slightly larger scale on a very big screen.
      maxFontSize: 34,   // ...but never past this, or it stops reading as a character grid
      matte: null,        // { mode, cell, depth, bed, bedSteps, amp, curve } — see the matte section
      ui: true,           // the control bar. Set false when embedding this in another site
      bg: LIGHT_MODE ? "#fbfbfb" : "#080808"
    }, spec);

    // ?matte=noise | ?matte=field | ?matte=screen | ?matte=off — switch without editing the file
    const MQ = new URLSearchParams(location.search).get('matte');
    let matteDisabled = MQ === 'off';
    if (MQ && C.matte){
      if (MQ === 'off') C.matte = null;
      else if (MQ === 'noise' || MQ === 'field' || MQ === 'screen')
        C.matte = Object.assign({}, C.matte, { mode: MQ });
    }
    if (C.matte){                                  // numeric matte levers override live
      const QP = new URLSearchParams(location.search);
      for (const [q, k] of [['cell','cell'],['amp','amp'],['bed','bed'],['steps','bedSteps'],['contr','contrast'],['speed','speed'],['wob','wobble'],['depth','depth'],['floor','floor'],['pitch','pitch'],['angle','angle'],['duty','duty']]){
        const v = QP.get(q);
        if (v !== null && v !== '' && !isNaN(+v)) C.matte[k] = +v;
      }
      const curve = QP.get('curve');
      if (curve === 'flat' || curve === 'bell') C.matte.curve = curve;
      else if (curve !== null && curve !== '' && !isNaN(+curve)) C.matte.curve = +curve;
    }
    document.documentElement.style.background = document.body.style.background = C.bg;
    const BGL = hexrgb(C.bg);   // background in linear light — the bed is built around it

    const EGG = C.edgeGlyphs;
    const layers = C.layers.map(function (l) {
      return Object.assign({
        span: 1.5, aspect: 2.0, gridSpace: false, srgbBand: false,
        drift: [-0.85, -0.32], driftSpeed: 0.05, evolve: 0.12,
        bump: 1.9, light: [-0.5, -0.6, 0.62], contrast: 1.05,
        amb: 0.08, hgt: 0.10, dif: 0.92,          // ambient / height tint / diffuse
        spec: 0.0, shine: 24, rim: 0.0, rimPow: 3, // material
        edges: 0, edgeBoost: 1.0, edgeLift: 0,     // directional channel: 0 = off
        lineSmooth: 0.86,   // how much of last frame's gradient survives (higher = calmer lines)
        lineHyst: 0.62,     // a line cell only stops being one below this fraction of the threshold
        vote: 1,            // neighbourhood radius in cells for the direction vote (0 = per-cell)
        persist: 0, cutoff: 0, occlude: false,
        dither: 0,          // in ramp steps. 1.0 = spread each step across its own width
        gamma: 1,           // >1 crushes the low end smoothly — how a layer becomes sparse
        ramp: null, oct: 4,
        ink: ["#161616", "#707070"], inkLight: ["#ececec", "#9a9a9a"]
      }, l);
    });
    const MATTE_DEFAULTS = { mode:'noise', cell:3, depth:0.26, bed:0.26, bedSteps:2,
                             amp:20, contrast:0.5, speed:0.06, wobble:0.5,
                             curve:'flat', floor:0.25, pitch:4, angle:0, duty:0.5 };
    const hasLayerMattes = layers.some(L => L.matte && typeof L.matte === 'object');
    let layerMattes = [];
    function resolveMattes(){
      if (matteDisabled){ layerMattes = layers.map(() => null); return false; }
      layerMattes = layers.map(L => L.matte && typeof L.matte === 'object'
        ? Object.assign({}, MATTE_DEFAULTS, C.matte || {}, L.matte)
        : C.matte);
      return layerMattes.some(Boolean);
    }

    let cv = document.querySelector('canvas');
    if (!cv){ cv = document.createElement('canvas'); document.body.appendChild(cv); }
    const ctx = cv.getContext('2d');
    let cols, rows, adv, lineH, W, Hh;
    let mattePattern = null;   // declared here: fit() runs before the matte block below
    let bedAt = -1e9;
    let oc = null, octx = null; // offscreen glyph layer, composited back through the lattice
    let bed = null, bctx = null, bimg = null, bw = 0, bh = 0, bedCell = 1; // sub-glyph tonal layer
    let bedTile = null, bedTileCtx = null, bedTileImg = null, bedPattern = null;  // noise-mode tile
    let matteMask = null, matteMaskCtx = null, matteMaskImg = null; // winning layer per bed block
    let bedWinner = null, bedValue = null, bedCurve = null, bedGX = null, bedGY = null;
    let screenInk = [], noisePhase = new Map(), noiseQuant = new Map();

    function fit(){
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth; Hh = window.innerHeight;
      cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      cv.width = Math.round(W*dpr); cv.height = Math.round(Hh*dpr);   // backing store at device res
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                          // draw in CSS px, render sharp
      // FILL THE VIEWPORT, AT ANY SIZE.
      // A hard column cap (this was `maxCols`) makes the field stop part-way across a wide screen
      // and leave dead space — the composition simply does not reach the edge. Capping is the
      // wrong lever anyway: what needs bounding is the amount of WORK, not the width. So keep the
      // glyph size as authored until the cell count would get expensive, then step the glyphs UP.
      // The piece then spans the full width on any monitor; on a very large one it reads as the
      // same composition at a larger scale rather than as a smaller one pinned to the corner.
      let fs = C.fontSize;
      for (;;){
        ctx.font = C.fontWeight + ' ' + fs + 'px ' + C.fontFamily;
        adv = ctx.measureText('M').width + C.pad; lineH = fs*1.06 + C.pad;
        cols = Math.ceil(W/adv); rows = Math.ceil(Hh/lineH) + 1;
        if (cols*rows <= C.maxCells || fs >= C.maxFontSize) break;
        fs += 1;
      }
      ctx.textBaseline = 'top';
      C._fs = fs;
      for (const L of layers){
        L._H = new Float32Array(cols*rows);
        L._S = new Float32Array(cols*rows);
        L._P = new Float32Array(cols*rows);   // persistence buffer
        L._GX = new Float32Array(cols*rows); L._GY = new Float32Array(cols*rows);
        L._BX = new Float32Array(cols*rows); L._BY = new Float32Array(cols*rows);
        L._Gs = new Float32Array(cols*rows);  // time-smoothed gradient magnitude
        L._ln = new Uint8Array(cols*rows);    // hysteresis state: is this cell currently a line?
        L._dir = new Uint8Array(cols*rows);   // this cell's own quantised gradient direction
        L._vdir = new Uint8Array(cols*rows);  // the direction its neighbourhood voted for
        L._lo = hexrgb((LIGHT_MODE ? L.inkLight : L.ink)[0]);
        L._hi = hexrgb((LIGHT_MODE ? L.inkLight : L.ink)[1]);
        L._gmax = 1;
        const l = L.light, m = Math.hypot(l[0],l[1],l[2]);
        L._L = [l[0]/m, l[1]/m, l[2]/m];
        // half-vector for Blinn-Phong, view direction is straight on (0,0,1)
        const hx = L._L[0], hy = L._L[1], hz = L._L[2] + 1, hm = Math.hypot(hx,hy,hz);
        L._Hv = [hx/hm, hy/hm, hz/hm];
        if (L.resize) L.resize(cols, rows);
      }
      if (C.resize) C.resize(cols, rows);
      if (typeof buildMatte === 'function') buildMatte();
    }
    const FONT_PROBE = C.fontWeight + ' ' + C.fontSize + 'px ' + C.fontFamily;
    window.addEventListener('resize', fit); fit();
    // The layout depends on the WEBFONT's advance width, so it has to be re-measured once the font
    // actually arrives. `fonts.ready` alone is not enough: it can resolve BEFORE the face has even
    // been requested (nothing is pending yet), in which case the later load never triggers a
    // refit — `cols` stays sized for the fallback's wider advance while glyphs draw at the real
    // font's narrower one, so they bunch into the left of the canvas and the right stays empty.
    // Force the load, listen for it, and re-check a couple of times as a backstop.
    if (document.fonts){
      const probe = FONT_PROBE;
      try { document.fonts.load(probe).then(fit, function(){}); } catch (e) {}
      if (document.fonts.ready) document.fonts.ready.then(fit);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fit);
    }

    function computeLayer(L, t){
      const H = L._H, S = L._S, P = L._P, N = cols*rows;
      const scale = L.span / cols;
      const dx = L.drift[0]*L.driftSpeed*t + 0.4*Math.cos(t*L.evolve);
      const dy = L.drift[1]*L.driftSpeed*t + 0.4*Math.sin(t*L.evolve);

      // A layer may hand over FINAL BRIGHTNESS rather than a height field. The older concepts do
      // their own lighting (they call litShade themselves), so there is nothing here to shade —
      // take their buffer as the shaded result and skip straight to the glyph passes. H is filled
      // too, so the contour channel still has something to differentiate.
      if (L.shadedGrid){
        L.shadedGrid(S, cols, rows, t);
        H.set(S);
        if (L.persist > 0){
          const P = L._P;
          for (let i = 0; i < cols*rows; i++){
            const prev = P[i]*L.persist;
            if (prev > S[i]) S[i] = prev;
            P[i] = S[i];
          }
        }
        return finishLayer(L, t);
      }

      // pass 1 — motion. The piece owns this and nothing else.
      if (L.heightGrid) L.heightGrid(H, cols, rows, t, {scale: scale, dx: dx, dy: dy, aspect: adv/lineH});
      else for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          H[y*cols+x] = L.height(x*scale + dx, y*scale*L.aspect + dy, t);

      // pass 2 — material. normal from the height gradient, then diffuse + specular + rim.
      // `gridSpace` layers build their height directly in cell coordinates (the analytic-wave
      // recipe the calm concepts use), so the gradient is a plain per-cell difference and
      // `bump` reads in the same units as field.js — 28-34, not 1.9.
      const inv2s = L.gridSpace ? 0.5 : 1/(2*scale), Lv = L._L, Hv = L._Hv;
      for (let y = 0; y < rows; y++){
        for (let x = 0; x < cols; x++){
          const i = y*cols+x;
          const xm = x>0?x-1:x, xp = x<cols-1?x+1:x, ym = y>0?y-1:y, yp = y<rows-1?y+1:y;
          const hx = (H[y*cols+xp]-H[y*cols+xm]) * inv2s * (xp!==xm?1:2);
          const hy = (H[yp*cols+x]-H[ym*cols+x]) * inv2s * (yp!==ym?1:2);
          const bx = -L.bump*hx, by = -L.bump*hy, nl = Math.hypot(bx, by, 1);
          const nx = bx/nl, ny = by/nl, nz = 1/nl;
          let d = nx*Lv[0] + ny*Lv[1] + nz*Lv[2]; if (d < 0) d = 0;
          let s = L.amb + L.hgt*H[i] + L.dif*d;
          if (L.spec > 0){                                     // crests catch a hard highlight
            let sp = nx*Hv[0] + ny*Hv[1] + nz*Hv[2]; if (sp < 0) sp = 0;
            s += L.spec * Math.pow(sp, L.shine);
          }
          if (L.rim > 0) s += L.rim * Math.pow(1 - nz, L.rimPow);  // grazing angles glow
          s = (s-0.5)*L.contrast + 0.5;
          // GAMMA — the honest way to make a layer sparse. Raising the value to a power crushes
          // the low end smoothly toward zero, so most cells fall below the first ramp step and
          // simply stop being drawn. A `cutoff` would do it with a hard threshold, and cells
          // would pop in and out as the field crossed it; this fades them instead. That matters
          // for the far planes of a parallax stack, which otherwise draw a full sheet of ink
          // behind everything and triple the density of the whole piece.
          if (L.gamma !== 1) s = s > 0 ? Math.pow(s, L.gamma) : 0;
          if (L.persist > 0){                                  // phosphor memory
            const prev = P[i] * L.persist;
            if (prev > s) s = prev;
            P[i] = s;
          }
          S[i] = s < 0 ? 0 : s > 1 ? 1 : s;
        }
      }

      return finishLayer(L, t);
    }

    function finishLayer(L, t){
      const H = L._H, S = L._S;
      // pass 2.5 — CONTOUR CHANNEL, made continuous.
      // Three things keep it from chattering, and all three are necessary:
      //  (a) it reads the HEIGHT field, not the shaded value. Shading carries the specular and
      //      the normal, both high-frequency, and taking a gradient amplifies high frequencies
      //      again — differentiating the shaded value is differentiating noise.
      //  (b) the gradient VECTOR is blurred (separable 3-tap), so magnitude and angle are both
      //      smooth across neighbouring cells instead of speckling.
      //  (c) the result is smoothed in TIME and switched with HYSTERESIS, so a cell that is a
      //      line stays a line until the field clearly moves off it. A bare threshold makes
      //      every cell near it flip between a line glyph and a tone glyph every single frame,
      //      and that flicker is what reads as mess.
      const LN = L._ln;
      if (L.edges > 0){
        const GX = L._GX, GY = L._GY, BX = L._BX, BY = L._BY, Gs = L._Gs;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){
          const i = y*cols+x;
          const xm = x>0?x-1:x, xp = x<cols-1?x+1:x, ym = y>0?y-1:y, yp = y<rows-1?y+1:y;
          GX[i] = H[y*cols+xp]-H[y*cols+xm];
          GY[i] = H[yp*cols+x]-H[ym*cols+x];
        }
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){   // blur x
          const i = y*cols+x, a = x>0?i-1:i, b = x<cols-1?i+1:i;
          BX[i] = (GX[a]+GX[i]+GX[b])/3; BY[i] = (GY[a]+GY[i]+GY[b])/3;
        }
        let gmax = 1e-6;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){   // blur y, then EMA
          const i = y*cols+x, a = y>0?i-cols:i, b = y<rows-1?i+cols:i;
          const gx = (BX[a]+BX[i]+BX[b])/3, gy = (BY[a]+BY[i]+BY[b])/3;
          GX[i] = gx; GY[i] = gy;
          const m = Math.hypot(gx, gy);
          Gs[i] = Gs[i]*L.lineSmooth + m*(1-L.lineSmooth);
          if (Gs[i] > gmax) gmax = Gs[i];
        }
        L._gmax = L._gmax*0.9 + gmax*0.1;
        const hi = L.edges * L._gmax, lo = hi * L.lineHyst;   // enter high, leave low
        for (let i = 0; i < cols*rows; i++) LN[i] = Gs[i] > (LN[i] ? lo : hi) ? 1 : 0;

        // TILE-LEVEL DIRECTIONAL VOTING.
        // Each cell quantises its own gradient angle to one of four directions, and then a
        // neighbourhood VOTES on which direction the whole patch takes, weighted by gradient
        // strength. Letting every cell choose independently is what produces scattered, broken
        // hatching — neighbours disagree by one bucket and the line falls apart. The vote makes
        // adjacent cells agree, so contours come out as continuous strokes.
        // (Lifted from the GPU ASCII pipelines, where the same vote runs across a pixel tile.)
        const D = L._dir, R = L.vote|0;
        for (let i = 0; i < cols*rows; i++){
          const deg = (Math.atan2(GY[i], GX[i])*57.2957795 + 90 + 360) % 180;
          D[i] = deg < 22.5 || deg >= 157.5 ? 0 : deg < 67.5 ? 1 : deg < 112.5 ? 2 : 3;
        }
        if (R > 0){
          const V = L._vdir;
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){
            const i = y*cols+x;
            if (!LN[i]) { V[i] = D[i]; continue; }
            let v0=0, v1=0, v2=0, v3=0;
            for (let dy = -R; dy <= R; dy++){
              const yy = y+dy; if (yy < 0 || yy >= rows) continue;
              for (let dx = -R; dx <= R; dx++){
                const xx = x+dx; if (xx < 0 || xx >= cols) continue;
                const j = yy*cols+xx, w = Gs[j];
                const d = D[j];
                if (d === 0) v0 += w; else if (d === 1) v1 += w; else if (d === 2) v2 += w; else v3 += w;
              }
            }
            V[i] = v0 >= v1 && v0 >= v2 && v0 >= v3 ? 0 : v1 >= v2 && v1 >= v3 ? 1 : v2 >= v3 ? 2 : 3;
          }
        } else L._vdir.set(D);
      }

    }

    // COMPOSITE — one glyph per cell, taken from the FRONTMOST layer that has any ink there.
    // Previously every layer drew its own glyph into the same cell and they stacked, so a cell
    // could carry two or three overlapping characters. That reads as a smudge rather than as a
    // character, and it made the layered piece look far heavier than its glyph mix said it was.
    // Picking the nearest layer that covers the cell is also what depth actually means: near
    // things hide far things.
    function composite(){
      const g = octx || ctx;                                 // draw glyphs to the offscreen layer
      const N = cols*rows, Lc = C.levels;
      const buckets = [];        // [layerIndex][greyLevel] -> flat [glyph, x, y, ...]
      for (let li = 0; li < layers.length; li++)
        buckets.push(Array.from({length: Lc}, () => []));

      for (let y = 0; y < rows; y++){
        for (let x = 0; x < cols; x++){
          const i = y*cols+x;
          for (let li = layers.length-1; li >= 0; li--){       // front to back
            const L = layers[li], ramp = L.ramp || C.ramp, n = ramp.length-1;
            let s = L._S[i];
            if (s <= L.cutoff) continue;
            let ch = null;
            if (L.edges > 0 && L._ln[i]){
              ch = EGG[L._vdir[i]];
              s = Math.min(1, s*L.edgeBoost + L.edgeLift);
            }
            if (ch === null){
              const dth = L.dither/(n+1);
              const sd = L.dither ? s + dth*BN[(y & 31)*32 + (x & 31)] : s;
              const ci = Math.min(n, Math.max(0, (sd*(n+1))|0));
              if (ci === 0) continue;                          // no ink here — fall through
              ch = ramp[ci]; s = sd;
            }
            buckets[li][Math.min(Lc-1, (s*Lc)|0)].push(ch, x*adv, y*lineH);
            break;                                             // nearest layer wins the cell
          }
        }
      }
      for (let li = 0; li < layers.length; li++){
        const L = layers[li];
        for (let l = 0; l < Lc; l++){
          const a = buckets[li][l]; if (!a.length) continue;
          g.fillStyle = (L.srgbBand ? bandSrgb : band)(L._lo, L._hi, (l+0.5)/Lc);
          for (let k = 0; k < a.length; k += 3) g.fillText(a[k], a[k+1], a[k+2]);
        }
      }
    }

    // ---- MATTE: a sub-glyph pixel lattice -------------------------------------------------
    // Everything above works at the character cell, roughly 11x18 device pixels. This pass works
    // an order of magnitude finer: the finished frame is multiplied by a lattice of 2-3 PIXEL
    // blocks, each block sitting at a slightly different opacity, with values drawn from the
    // selected noise, field, or ruled material. It is not grain — grain is per-pixel and random, and it
    // sits ON the image. This is a structured lattice the image is resolved ONTO, so the layers
    // stop looking like separate passes stacked up and start looking like one exposure.
    // A single piece-level lattice is stamped as a tile. Per-layer mattes keep one block map so
    // their material can change without redrawing the full bed once for every layer.
    function buildMatte(){
      mattePattern = null; oc = null; octx = null; bedAt = -1e9;
      bedTile = null; bedPattern = null;
      bed = null; bctx = null; bimg = null; matteMask = null; matteMaskCtx = null; matteMaskImg = null;
      bedWinner = null; bedValue = null; bedCurve = null; bedGX = null; bedGY = null;
      screenInk = []; noisePhase = new Map(); noiseQuant = new Map();
      if (!resolveMattes()) return;
      const active = layerMattes.filter(Boolean);
      let cell = Math.max(1, ((C.matte || active[0]).cell|0));
      if (hasLayerMattes){
        // Mixed lattices share one pass. Their greatest common divisor is the smallest backing
        // grid that preserves every authored block boundary instead of softening one layer to fit.
        function gcd(a, b){ while (b){ const r = a%b; a = b; b = r; } return a; }
        for (const M of active) cell = gcd(cell, Math.max(1, M.cell|0));
      }
      bedCell = cell;
      const dynamicMask = hasLayerMattes || active.some(M => M.mode === 'screen');
      const depth = active.reduce((m, M) => Math.max(m, M.depth || 0), 0);
      let tile = null;

      if (!dynamicMask){
        const T = cell * 32;                                 // one full period of the mask
        tile = document.createElement('canvas');
        tile.width = T; tile.height = T;
        const tc = tile.getContext('2d');
        const img = tc.createImageData(T, T);
        const d = img.data;
        for (let by = 0; by < 32; by++){
          for (let bx = 0; bx < 32; bx++){
            // ONE ALPHA PER BLOCK, not per pixel — that is what makes it a lattice and not grain
            const n = BN[by*32 + bx] + 0.5;                   // 0 .. 1
            const a = Math.max(0, Math.min(255, Math.round(255*(1 - depth*n))));
            for (let y = 0; y < cell; y++){
              const row = (by*cell + y)*T;
              for (let x = 0; x < cell; x++){
                const i = (row + bx*cell + x)*4;
                d[i] = d[i+1] = d[i+2] = 255; d[i+3] = a;    // white, varying ALPHA
              }
            }
          }
        }
        tc.putImageData(img, 0, 0);
      }
      // THE BED — the continuous tonal layer the pixelation resolves onto.
      // Rendered at one pixel per LATTICE BLOCK (so a 3px lattice means a canvas a third the
      // size), then blown back up with smoothing off, which is what produces hard little blocks
      // rather than a soft gradient. The winning field value is cached at character-cell scale;
      // the sub-glyph structure comes from the noise or screen rather than costly interpolation.
      bw = Math.max(1, Math.ceil(cv.width / bedCell));
      bh = Math.max(1, Math.ceil(cv.height / bedCell));
      bed = document.createElement('canvas');
      bed.width = bw; bed.height = bh;
      bctx = bed.getContext('2d');
      bimg = bctx.createImageData(bw, bh);
      bedWinner = new Int16Array(cols*rows);
      bedValue = new Float32Array(cols*rows);
      bedCurve = new Float64Array(cols*rows);
      bedGX = new Int32Array(bw); bedGY = new Int32Array(bh);
      const dpr = window.devicePixelRatio || 1, cw = adv*dpr, chh = lineH*dpr;
      for (let px = 0; px < bw; px++)
        bedGX[px] = Math.max(0, Math.min(cols-1, Math.round(px*bedCell/cw - 0.5)));
      for (let py = 0; py < bh; py++)
        bedGY[py] = Math.max(0, Math.min(rows-1, Math.round(py*bedCell/chh - 0.5)));

      // A ruled screen is fixed until its config or the viewport changes. Bake it once by stepping
      // a linear phase across each row, so the hot bed loop does no trigonometry at all.
      const madeScreens = new Map();
      screenInk = layerMattes.concat([C.matte]).map(M => {
        if (!M || M.mode !== 'screen') return null;
        if (madeScreens.has(M)) return madeScreens.get(M);
        const mc = Math.max(1, M.cell|0), pitch = Math.max(1, M.pitch == null ? 4 : M.pitch);
        const angle = (M.angle == null ? 0 : M.angle)*Math.PI/180;
        const sx = -Math.sin(angle)/pitch, sy = Math.cos(angle)/pitch;
        const duty = Math.max(0, Math.min(1, M.duty == null ? 0.5 : M.duty));
        const xPhase = new Float64Array(bw), ink = new Uint8Array(bw*bh);
        let bx = 0, phaseX = 0;
        for (let px = 0; px < bw; px++){
          const next = Math.floor(px*bedCell/mc);
          while (bx < next){ bx++; phaseX += sx; }
          xPhase[px] = phaseX;
        }
        for (let py = 0; py < bh; py++){
          const rowPhase = Math.floor(py*bedCell/mc)*sy, row = py*bw;
          for (let px = 0; px < bw; px++){
            const phase = rowPhase + xPhase[px];
            ink[row+px] = phase-Math.floor(phase) < duty ? 1 : 0;
          }
        }
        madeScreens.set(M, ink); return ink;
      });

      // Animated noise keeps an irregular phase per block. Cache its sine and cosine once, then
      // advance time with the angle-addition identity instead of calling Math.sin per repaint.
      const flatTiled = !hasLayerMattes && C.matte && C.matte.mode === 'noise'
        && (C.matte.curve == null || C.matte.curve === 'flat');
      if (!flatTiled){
        for (const M of layerMattes.concat([C.matte])){
          if (!M || M.mode !== 'noise') continue;
          if (!noiseQuant.has(M)){
            const steps = M.bedSteps || 2, contrast = M.contrast == null ? 0.5 : M.contrast;
            const g = 1 - contrast*0.85, thresholds = [];
            for (let k = 1; (2*k-1)/steps <= 1; k++)
              thresholds.push(Math.pow((2*k-1)/steps, 1/g));
            noiseQuant.set(M, thresholds);
          }
          if (M.speed == null ? 0.06 : M.speed){
            const mc = Math.max(1, M.cell|0); if (noisePhase.has(mc)) continue;
            const sin = new Float64Array(bw*bh), cos = new Float64Array(bw*bh);
            for (let py = 0; py < bh; py++){
              const my = Math.floor(py*bedCell/mc), row = py*bw;
              for (let px = 0; px < bw; px++){
                const mx = Math.floor(px*bedCell/mc);
                const phase = 6.28318*blockPhase(mx, my), i = row+px;
                sin[i] = Math.sin(phase); cos[i] = Math.cos(phase);
              }
            }
            noisePhase.set(mc, {sin, cos});
          }
        }
      }

      // The offscreen layer exists ONLY to let the lattice cut the glyphs' alpha. That costs three
      // full-screen operations every frame (clear, destination-in fill, blit), which on a large
      // display is the single most expensive thing left in the renderer. When `depth` is 0 the
      // lattice is not modulating the glyphs at all, so none of it is needed — draw straight to
      // the visible canvas instead. The bed still supplies the lattice you actually see.
      if (depth <= 0){ oc = null; octx = null; mattePattern = null; return; }
      oc = document.createElement('canvas');
      oc.width = cv.width; oc.height = cv.height;
      octx = oc.getContext('2d');
      if (dynamicMask){
        matteMask = document.createElement('canvas');
        matteMask.width = bw; matteMask.height = bh;
        matteMaskCtx = matteMask.getContext('2d');
        matteMaskImg = matteMaskCtx.createImageData(bw, bh);
      } else mattePattern = octx.createPattern(tile, 'repeat');
    }

    // Paint the bed: look up the cached shaded field, dither it with the same blue-noise mask,
    // and quantise to a handful of levels. Quantising is the point — an un-quantised gradient
    // just looks like a blur; quantised and dithered, it reads as an image resolved onto a fine
    // grid, which is the "light pixelation" this is after. It is NOT grain: grain is per-pixel
    // and random and sits on top; this is structured, block-aligned, and sits underneath.
    // A second, decorrelated value per block, used as a PHASE. Reusing the mask itself as the
    // phase would make every block of the same brightness turn at the same moment, which reads
    // as the whole lattice pulsing.
    function blockPhase(px, py){
      let h = (px|0)*2654435761 + (py|0)*40503;
      h = (h ^ (h >> 15)) * 2246822519;
      return ((h ^ (h >> 13)) >>> 0) / 4294967295;
    }

    // The bed is recomputed at one sample per lattice block, which on a large display is hundreds
    // of thousands of samples. It also moves slowly BY DESIGN (`speed` defaults to 0.06 — a block
    // takes ~16s to travel light-to-dark), so recomputing it on every frame is almost entirely
    // waste. Rebuild it a few times a second and blit the cached canvas in between; the motion is
    // far too slow for the difference to be visible.
    // Flat, piece-level NOISE owes nothing to the picture, so 32 blocks square is one whole period
    // and can simply repeat. On a 3440-wide display that is a 96x96 tile instead of ~550,000
    // samples per rebuild. Curved noise, field, screen, and per-layer mattes need the full path
    // because their strength or material follows the shaded image.
    function paintBedTiled(t){
      const M = C.matte;
      const cell = Math.max(1, M.cell|0), T = 32*cell;
      if (!bedTile || bedTile.width !== T){
        bedTile = document.createElement('canvas');
        bedTile.width = T; bedTile.height = T;
        bedTileCtx = bedTile.getContext('2d');
        bedTileImg = bedTileCtx.createImageData(T, T);
      }
      const steps = M.bedSteps || 9, NAMP = (M.amp == null ? 20 : M.amp);
      const NCON = M.contrast == null ? 0.5 : M.contrast;
      const NSPD = M.speed == null ? 0.06 : M.speed, NWOB = M.wobble == null ? 0.5 : M.wobble;
      const bgS = [l2s(BGL[0]), l2s(BGL[1]), l2s(BGL[2])];
      const d = bedTileImg.data, h = NAMP*0.5;
      for (let by = 0; by < 32; by++){
        for (let bx = 0; bx < 32; bx++){
          const n = BN[by*32 + bx];
          let nn = n;
          if (NSPD > 0){
            const ph = blockPhase(bx, by);
            nn = n + NWOB*Math.sin(6.28318*(t*NSPD + ph));
            if (nn > 0.5) nn -= 1; else if (nn < -0.5) nn += 1;
          }
          let u = nn*2;
          if (NCON > 0){ const g = 1 - NCON*0.85; u = (u < 0 ? -1 : 1)*Math.pow(Math.abs(u), g); }
          const v = Math.round(u*0.5*steps)/steps;
          for (let y = 0; y < cell; y++){
            const row = (by*cell + y)*T;
            for (let x = 0; x < cell; x++){
              const i = (row + bx*cell + x)*4;
              for (let k = 0; k < 3; k++){
                const c = Math.max(h, Math.min(255-h, bgS[k])) + NAMP*v;
                d[i+k] = c < 0 ? 0 : c > 255 ? 255 : c;
              }
              d[i+3] = 255;
            }
          }
        }
      }
      bedTileCtx.putImageData(bedTileImg, 0, 0);
      bedPattern = ctx.createPattern(bedTile, 'repeat');
      blitBedTile();
    }
    function blitBedTile(){
      if (!bedPattern) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bedPattern;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.restore();
    }

    function matteCurve(M, v){
      const curve = M.curve;
      if (curve == null || curve === 'flat') return 1;
      const exponent = curve === 'bell' ? 1 : typeof curve === 'number' ? Math.max(0, curve) : 0;
      if (!exponent) return 1;
      const floor = Math.max(0, Math.min(1, M.floor == null ? 0.25 : M.floor));
      const x = 1 - Math.abs(2*Math.max(0, Math.min(1, v)) - 1);
      return floor + (1-floor)*Math.pow(x, exponent);
    }

    function paintBed(t){
      const M0 = C.matte;
      const flatNoise = M0 && M0.mode === 'noise' && (M0.curve == null || M0.curve === 'flat');
      if (!hasLayerMattes && flatNoise && (M0.bed == null || M0.bed > 0)){
        const e = 1 / Math.max(1, M0.bedFps || 12);
        if (t - bedAt < e){ blitBedTile(); return; }
        bedAt = t; paintBedTiled(t); return;
      }
      if (!bed) return;
      let bedFps = 1;
      for (const M of layerMattes) if (M) bedFps = Math.max(bedFps, M.bedFps || 12);
      const every = 1 / bedFps;
      if (t - bedAt < every){ blitBed(); return; }
      bedAt = t;
      const cell = bedCell, d = bimg.data;
      const md = matteMaskImg && matteMaskImg.data;
      const bgS = [l2s(BGL[0]), l2s(BGL[1]), l2s(BGL[2])];

      // Resolve material and curve strength once at GLYPH resolution. Repeating this scan for
      // every sub-glyph block was multiplying the most expensive work by roughly a hundred.
      for (let i = 0; i < cols*rows; i++){
        let sv = 0, win = -1;
        for (let li = 0; li < layers.length; li++){
          const v = layers[li]._S[i];
          if (v > sv){ sv = v; win = li; }
        }
        bedWinner[i] = win; bedValue[i] = sv;
        const M = win >= 0 ? layerMattes[win] : C.matte;
        bedCurve[i] = M ? matteCurve(M, sv) : 1;
      }
      const matteByWinner = layerMattes.concat([C.matte]);
      const noiseTime = new Map();
      for (const M of matteByWinner){
        if (!M || M.mode !== 'noise' || noiseTime.has(M)) continue;
        const speed = M.speed == null ? 0.06 : M.speed;
        if (speed <= 0) continue;
        const phase = 6.28318*t*speed;
        noiseTime.set(M, {sin:Math.sin(phase), cos:Math.cos(phase)});
      }

      for (let py = 0; py < bh; py++){
        const glyphRow = bedGY[py]*cols;
        for (let px = 0; px < bw; px++){
          const bi = py*bw + px, i = bi*4;
          const gi = glyphRow + bedGX[px], win = bedWinner[gi], sv = bedValue[gi];
          const mi = win >= 0 ? win : layers.length, M = matteByWinner[mi];
          if (!M){
            d[i] = d[i+1] = d[i+2] = d[i+3] = 0;
            if (md){ md[i] = md[i+1] = md[i+2] = 255; md[i+3] = 255; }
            continue;
          }
          const mc = Math.max(1, M.cell|0);
          const mx = Math.floor(px*cell/mc), my = Math.floor(py*cell/mc);
          const n = BN[(my & 31)*32 + (mx & 31)];            // -0.5 .. +0.5
          const steps = M.bedSteps || 2;
          const curve = bedCurve[gi], sm = screenInk[mi];
          const inked = sm ? sm[bi] === 1 : false;

          if (M.mode === 'noise' && (M.bed == null || M.bed > 0)){
            // MODE 'noise' — the matte owes nothing to the picture. Every block is its own
            // value, drifting a little lighter or a little darker than the ground. Because the
            // values are FIXED per block and do not change frame to frame, it reads as a
            // surface the image is printed on, not as grain moving over it. That is the whole
            // difference: grain is temporal and random, this is spatial and still.
            // A swing centred ON the ground loses half of itself to clipping: on a near-black
            // ground the dark half clips away, and on a near-white ground the light half does —
            // which is why light mode showed almost no lattice at all. Push the centre far
            // enough from either end that the whole swing survives. On dark that lifts the black
            // point slightly, which is the right direction anyway: pure black is what makes a
            // dark image read as flat rather than photographed. On light it does the same in
            // reverse, pulling the white point down off the page.
            // CONTRAST before quantisation. Blue-noise values are uniformly spread, so with many
            // steps most blocks land near the middle and the lattice reads weak; the only way to
            // get punch was to drag `steps` down to 2-3, which forces the values bimodal but
            // throws away the level count as a side effect. An S-curve pushes values toward the
            // ends while KEEPING the levels, so contrast and granularity stop fighting.
            // MOTION. The mask value is the block's resting point; a slow sinusoid moves it
            // either side of that, and each block carries its own phase so they do not turn
            // together. This is deliberately NOT per-frame randomness — that is grain, it
            // scintillates, and it is the thing this whole treatment is trying not to be. Each
            // cell travels light-to-dark and back on its own clock, slowly enough to read as
            // the surface breathing rather than as noise.
            const NAMP = M.amp == null ? 20 : M.amp;          // sRGB levels, peak-to-peak
            const NSPD = M.speed == null ? 0.06 : M.speed;
            const NWOB = M.wobble == null ? 0.5 : M.wobble;
            let nn = n;
            if (NSPD > 0){
              const ph = noisePhase.get(mc), tm = noiseTime.get(M);
              nn = n + NWOB * (tm.sin*ph.cos[bi] + tm.cos*ph.sin[bi]);
              if (nn > 0.5) nn -= 1; else if (nn < -0.5) nn += 1;   // wrap, so it never clips flat
            }
            const u = nn*2, au = Math.abs(u);                 // -1 .. +1
            const thresholds = noiseQuant.get(M);
            let level = 0;
            if (u < 0){
              while (level < thresholds.length && au > thresholds[level]) level++;
              level = -level;
            } else while (level < thresholds.length && au >= thresholds[level]) level++;
            const v = level/steps;                            // hold it to discrete levels
            for (let k = 0; k < 3; k++){
              const amp = NAMP*curve, h = amp*0.5;
              const centre = Math.max(h, Math.min(255 - h, bgS[k]));   // keep the swing in range
              const c = centre + amp*v;
              d[i+k] = c < 0 ? 0 : c > 255 ? 255 : c;
            }
            d[i+3] = 255;
          } else if ((M.mode === 'field' || M.mode === 'screen') && (M.bed == null || M.bed > 0)){
            // FIELD uses blue noise across the quantisation step; SCREEN replaces that stochastic
            // term with a fixed ruled lattice, so one plane reads as manufactured beside the grain.
            let v = sv;
            if (M.mode === 'field'){
              if (M.curve == null || M.curve === 'flat') v += n/steps;
              else v += n/steps*curve;
              v = Math.round(v*steps)/steps;
            } else {
              v += (inked ? 0.5 : -0.5)/steps*curve;
              // A half-step is deliberate here. Absorb field floating-point dust so a regular
              // rule cannot lose one row merely because 0.5 arrived as 0.49999999999999994.
              v = Math.round(v*steps + 1e-9)/steps;
            }
            v = v < 0 ? 0 : v > 1 ? 1 : v;
            const depth = M.bed == null ? 0.5 : M.bed;
            d[i] = d[i+1] = d[i+2] = 255;
            d[i+3] = Math.round(255 * depth * v * v);        // squared: keep it under the glyphs
          } else d[i] = d[i+1] = d[i+2] = d[i+3] = 0;

          if (md){
            const depth = M.depth || 0;
            const maskValue = M.mode === 'screen' ? (inked ? 1 : 0) : n + 0.5;
            const alpha = Math.max(0, Math.min(255, Math.round(255*(1-depth*maskValue))));
            md[i] = md[i+1] = md[i+2] = 255; md[i+3] = alpha;
          }
        }
      }
      bctx.putImageData(bimg, 0, 0);
      if (matteMaskImg) matteMaskCtx.putImageData(matteMaskImg, 0, 0);
      blitBed();
    }
    function blitBed(){
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;                     // hard blocks, not a resampled blur
      ctx.drawImage(bed, 0, 0, cv.width, cv.height);
      ctx.restore();
    }

    // The glyphs are drawn to an offscreen layer with a transparent ground, that layer's alpha is
    // then cut by the lattice, and the result is laid over the background. Multiplying the
    // finished frame does not work: the ground is nearly black, and multiplying black by anything
    // is still black, so the lattice would only ever dim the few lit pixels. Modulating ALPHA is
    // what was actually being described — each little block of the image sits at a slightly
    // different opacity over the ground, so the whole picture reads as resolved onto a fine
    // lattice rather than drawn on top of one.
    function applyMatte(){
      if (!mattePattern && !matteMask) return;
      octx.save();
      octx.setTransform(1, 0, 0, 1, 0, 0);                    // device pixels
      octx.globalCompositeOperation = 'destination-in';
      if (matteMask){
        octx.imageSmoothingEnabled = false;
        octx.drawImage(matteMask, 0, 0, oc.width, oc.height);
      } else {
        octx.fillStyle = mattePattern;
        octx.fillRect(0, 0, oc.width, oc.height);
      }
      octx.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(oc, 0, 0);
      ctx.restore();
    }


    // ---- CONTROL BAR ------------------------------------------------------------------------
    // Only when the page is viewed DIRECTLY. The gallery embeds these in iframes, and a control
    // bar in every tile would be worse than useless — so `self === top` gates it. Changes write
    // straight into C.matte, rebuild the lattice, and update the URL so a setting you like is a
    // link you can send. "copy" gives you the exact config line to paste back into the piece,
    // which is the only part of this that matters: tuning that cannot get back into the source
    // is just fiddling.
    function buildUI(){
      if (C.ui === false) return;                        // embedded in someone else's page
      if (window.self !== window.top) return;            // embedded — no chrome
      if (!C.matte && !C.matteDefault) return;
      if (C.matte) C.matte = Object.assign({}, MATTE_DEFAULTS, C.matte);
      const M = () => C.matte || (C.matte = Object.assign({}, MATTE_DEFAULTS, C.matteDefault||{}));
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9;display:flex;'
        + 'flex-wrap:wrap;'   // a narrow window wraps the controls onto a second row rather
                              // than pushing them off the right edge where they cannot be reached
        + 'align-items:center;gap:10px 16px;padding:9px 14px;font:300 11px/1.4 "Geist Mono",'
        + 'ui-monospace,Menlo,monospace;letter-spacing:1px;color:#9a9a9a;'
        + (LIGHT_MODE
            ? 'background:rgba(251,251,251,.88);border-bottom:1px solid #e2e2e2;color:#4a4a4a;'
            : 'background:rgba(8,8,8,.86);border-bottom:1px solid #202020;')
        + '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);user-select:none;';

      // Geist Pixel for the wordmark — a pixel face on a project about resolving images onto a
      // grid of cells. Loaded here rather than in each piece so the pieces stay untouched.
      const gf = document.createElement('link');
      gf.rel = 'stylesheet';
      gf.href = 'https://fonts.googleapis.com/css2?family=Geist+Pixel&display=swap';
      document.head.appendChild(gf);

      const brand = document.createElement('a');
      brand.href = '/';
      brand.textContent = 'asciara';
      brand.title = 'home';
      brand.style.cssText = "font-family:'Geist Pixel','Geist Mono',ui-monospace,monospace;"
        + 'font-size:17px;letter-spacing:2px;color:' + (LIGHT_MODE ? '#101010' : '#f2f2f2')
        + ';text-decoration:none;line-height:1;';
      bar.appendChild(brand);

      const gal = document.createElement('a');
      gal.href = '/gallery.html';
      gal.textContent = 'gallery';
      gal.style.cssText = 'padding:4px 11px;border:1px solid ' + (LIGHT_MODE ? '#d0d0d0' : '#2a2a2a')
        + ';text-decoration:none;color:' + (LIGHT_MODE ? '#4a4a4a' : '#a8a8a8') + ';cursor:pointer;';
      bar.appendChild(gal);

      // switcher — jump straight between backgrounds, carrying the current settings across
      const pick = document.createElement('select');
      pick.style.cssText = 'font:300 11px/1.4 "Geist Mono",ui-monospace,Menlo,monospace;'
        + 'letter-spacing:1px;padding:4px 8px;border:1px solid ' + (LIGHT_MODE ? '#d0d0d0' : '#2a2a2a')
        + ';background:transparent;color:' + (LIGHT_MODE ? '#303030' : '#c8c8c8')
        + ';cursor:pointer;outline:none;min-width:112px;';
      const here = location.pathname;
      for (const [group, items] of CATALOGUE){
        const og = document.createElement('optgroup');
        og.label = group;
        for (const [name, href] of items){
          const o = document.createElement('option');
          o.value = href; o.textContent = name;
          if (href === here) o.selected = true;
          og.appendChild(o);
        }
        pick.appendChild(og);
      }
      pick.onchange = () => {
        const u = new URL(pick.value, location.origin);
        u.search = location.search;               // keep matte settings and light mode
        location.href = u.toString();
      };
      bar.appendChild(pick);

      // mode: off / field / noise / screen
      const modes = document.createElement('span');
      modes.style.cssText = 'display:flex;gap:0;';
      const btns = {};
      for (const m of ['off','field','noise','screen']){
        const b = document.createElement('a');
        b.textContent = m; b.href = '#';
        b.style.cssText = 'padding:4px 11px;border:1px solid #2a2a2a;margin-left:-1px;'
          + 'text-decoration:none;color:#a8a8a8;cursor:pointer;';
        b.onclick = e => { e.preventDefault(); setMode(m); };
        btns[m] = b; modes.appendChild(b);
      }
      bar.appendChild(modes);

      const rows = {};
      function slider(key, label, min, max, step){
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;align-items:center;gap:7px;flex:0 0 auto;';
        const nm = document.createElement('span'); nm.textContent = label;
        const inp = document.createElement('input');
        inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
        inp.style.cssText = 'width:clamp(56px,10vw,92px);accent-color:#8a8a8a;background:transparent;';
        const out = document.createElement('span');
        out.style.cssText = 'color:#e0e0e0;min-width:30px;text-align:right;';
        inp.oninput = () => {
          M()[key] = +inp.value; out.textContent = inp.value;
          buildMatte(); sync(false);
        };
        wrap.append(nm, inp, out); bar.appendChild(wrap);
        rows[key] = { wrap, inp, out };
      }
      slider('cell',     'cell',  1, 10, 1);
      slider('amp',      'amp',   0, 140, 2);
      slider('bed',      'bed',   0, 1, 0.02);
      slider('bedSteps', 'steps', 2, 20, 1);
      slider('depth',    'depth', 0, 1, 0.02);
      slider('contrast', 'contr', 0, 1, 0.02);
      slider('speed',    'speed', 0, 0.5, 0.01);
      slider('wobble',   'wob',   0, 1, 0.02);
      slider('floor',    'floor', 0, 1, 0.02);
      slider('pitch',    'pitch', 1, 16, 1);
      slider('angle',    'angle', 0, 180, 1);
      slider('duty',     'duty',  0, 1, 0.02);

      const spacer = document.createElement('span');
      spacer.style.cssText = 'flex:1 1 0;min-width:0;';   // must be allowed to collapse when wrapped
      bar.appendChild(spacer);

      const lightBtn = document.createElement('a');
      lightBtn.href = '#';
      lightBtn.textContent = LIGHT_MODE ? 'dark' : 'light';
      lightBtn.title = 'switch the piece between dark and light mode';
      lightBtn.style.cssText = 'padding:4px 11px;border:1px solid #2a2a2a;text-decoration:none;'
        + 'color:#a8a8a8;cursor:pointer;';
      lightBtn.onclick = e => {
        e.preventDefault();
        const u = new URL(location.href);
        if (LIGHT_MODE) u.searchParams.delete('light'); else u.searchParams.set('light', '');
        location.href = u.toString();          // ?light is read at startup, so this needs a reload
      };
      bar.appendChild(lightBtn);

      const copy = document.createElement('a');
      copy.href = '#'; copy.textContent = 'copy config';
      copy.style.cssText = 'padding:4px 11px;border:1px solid #2a2a2a;text-decoration:none;color:#a8a8a8;cursor:pointer;';
      copy.onclick = e => {
        e.preventDefault();
        const m = M();
        const curve = typeof m.curve === 'number' ? m.curve : "'" + m.curve + "'";
        const line = "matte: { mode: '" + m.mode + "', cell: " + m.cell + ", depth: " + (+m.depth).toFixed(2)
          + ", bed: " + (+m.bed).toFixed(2) + ", bedSteps: " + m.bedSteps + ", amp: " + m.amp
          + ", contrast: " + (+m.contrast).toFixed(2) + ", speed: " + (+m.speed).toFixed(2)
          + ", wobble: " + (+m.wobble).toFixed(2) + ", curve: " + curve
          + ", floor: " + (+m.floor).toFixed(2)
          + (m.mode === 'screen' ? ", pitch: " + m.pitch + ", angle: " + m.angle
              + ", duty: " + (+m.duty).toFixed(2) : '') + " }";
        (navigator.clipboard ? navigator.clipboard.writeText(line) : Promise.reject()).then(
          () => { copy.textContent = 'copied'; setTimeout(() => copy.textContent = 'copy config', 1100); },
          () => { copy.textContent = line; }
        );
      };
      bar.appendChild(copy);

      const hide = document.createElement('a');
      hide.href = '#'; hide.textContent = 'hide';
      hide.style.cssText = copy.style.cssText;
      hide.onclick = e => { e.preventDefault(); bar.style.display = 'none'; };
      bar.appendChild(hide);

      document.body.appendChild(bar);

      function setMode(m){
        if (m === 'off'){ C.matte = null; matteDisabled = true; }
        else { matteDisabled = false; M().mode = m; }
        buildMatte(); sync(true);
      }
      function sync(full){
        const on = !!C.matte, m = C.matte || {};
        for (const k of ['off','field','noise','screen']){
          const active = on ? m.mode === k : k === 'off';
          btns[k].style.color = active ? '#ffffff' : '#a8a8a8';
          btns[k].style.borderColor = active ? '#5a5a5a' : '#2a2a2a';
          btns[k].style.background = active ? '#141414' : 'transparent';
        }
        // only show the dials that do something in the current mode
        rows.amp.wrap.style.display      = on && m.mode === 'noise' ? 'flex' : 'none';
        rows.contrast.wrap.style.display = on && m.mode === 'noise' ? 'flex' : 'none';
        rows.speed.wrap.style.display    = on && m.mode === 'noise' ? 'flex' : 'none';
        rows.wobble.wrap.style.display   = on && m.mode === 'noise' ? 'flex' : 'none';
        rows.bed.wrap.style.display      = on && (m.mode === 'field' || m.mode === 'screen') ? 'flex' : 'none';
        rows.depth.wrap.style.display    = on && (m.mode === 'field' || m.mode === 'screen') ? 'flex' : 'none';
        rows.floor.wrap.style.display    = on && m.curve !== 'flat' ? 'flex' : 'none';
        rows.pitch.wrap.style.display    = on && m.mode === 'screen' ? 'flex' : 'none';
        rows.angle.wrap.style.display    = on && m.mode === 'screen' ? 'flex' : 'none';
        rows.duty.wrap.style.display     = on && m.mode === 'screen' ? 'flex' : 'none';
        rows.cell.wrap.style.display     = on ? 'flex' : 'none';
        rows.bedSteps.wrap.style.display = on ? 'flex' : 'none';
        if (full && on) for (const k of ['cell','amp','bed','bedSteps','depth','contrast','speed','wobble','floor','pitch','angle','duty']){
          rows[k].inp.value = m[k]; rows[k].out.textContent = m[k];
        }
        const u = new URL(location.href);
        u.searchParams.set('matte', on ? m.mode : 'off');
        for (const [q,k] of [['cell','cell'],['amp','amp'],['bed','bed'],['steps','bedSteps'],['contr','contrast'],['speed','speed'],['wob','wobble'],['depth','depth'],['floor','floor'],['pitch','pitch'],['angle','angle'],['duty','duty']])
          if (on) u.searchParams.set(q, m[k]); else u.searchParams.delete(q);
        if (on) u.searchParams.set('curve', m.curve); else u.searchParams.delete('curve');
        history.replaceState(null, '', u);
        try { localStorage.setItem('asciara-matte', JSON.stringify(C.matte)); } catch (e) {}
      }
      sync(true);
    }

    let last = -1e9;
    function loop(now){
      requestAnimationFrame(loop);
      if (now - last < 1000/Math.max(1, C.fps)) return;
      last = now;
      const t = now/1000;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, Hh);
      if (octx){                                             // clear the offscreen glyph layer
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, oc.width, oc.height);
        const dpr = window.devicePixelRatio || 1;
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.font = C.fontWeight + ' ' + C._fs + 'px ' + C.fontFamily;
        octx.textBaseline = 'top';
      }
      for (const L of layers) computeLayer(L, t);
      paintBed(t);
      composite();
      applyMatte();
    }
    requestAnimationFrame(loop);
    buildUI();
  }

  window.NX = run;
  run.noise = noise; run.fbm = fbm; run.warp = warp; run.hash = hash;
  run.smoothstep = smoothstep; run.mix = mix; run.sdTriangle = sdTriangle;
  run.LIGHT = LIGHT_MODE;
})();
