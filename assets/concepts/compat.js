/* compat.js — run the original concepts on the nx.js engine.
   The older pieces were written against `ASCIARA({ compute(buf, cols, rows, t) })`, where the
   piece fills `buf` with FINAL BRIGHTNESS (it does its own lighting via litShade). nx.js expects a
   height field and lights it itself — but it also accepts a `shadedGrid` layer, which is exactly
   the older contract under a different name.

   So this is a shim, not a rewrite: every concept keeps its own motion and its own lighting, and
   inherits everything the newer engine has — the matte, the control bar and switcher, adaptive
   fill at any viewport size, blue-noise dithering, and greys interpolated in linear light.
   The two logo pieces (monolith, gyre) stay on engine.js: they use its second OVERLAY layer with
   its own colour band, which has no equivalent here and is not worth faking.  */
(function () {
  // the same normal-shading litShade the concepts already call, unchanged
  window.litShade = function (H, buf, cols, rows, o) {
    o = o || {};
    const l = o.light || [-0.5,-0.6,0.62], lm = Math.hypot(l[0],l[1],l[2]);
    const Lx=l[0]/lm, Ly=l[1]/lm, Lz=l[2]/lm;
    const bump = o.bump==null?34:o.bump, contrast = o.contrast==null?1.05:o.contrast;
    const amb = o.amb==null?0.08:o.amb, hgt = o.hgt==null?0.10:o.hgt, dif = o.dif==null?0.92:o.dif;
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
      const i=y*cols+x;
      const xm=x>0?x-1:x, xp=x<cols-1?x+1:x, ym=y>0?y-1:y, yp=y<rows-1?y+1:y;
      const hx=(H[y*cols+xp]-H[y*cols+xm])*0.5*(xp!==xm?1:2);
      const hy=(H[yp*cols+x]-H[ym*cols+x])*0.5*(yp!==ym?1:2);
      const bx=-bump*hx, by=-bump*hy, nl=Math.hypot(bx,by,1);
      let diff=(bx*Lx+by*Ly+Lz)/nl; if(diff<0)diff=0;
      let s=amb+hgt*H[i]+dif*diff; s=(s-0.5)*contrast+0.5; s=s<0?0:s>1?1:s;
      buf[i]=s;
    }
  };

  window.ASCIARA = function (concept) {
    let buf = null, ov = null;
    const ink = concept.ink || (NX.LIGHT ? ["#ececec","#9a9a9a"] : ["#1c1c1c","#6c6c6c"]);
    // Forward ONLY the keys the concept actually set. Passing `ramp: undefined` does not fall
    // back to the engine default — Object.assign happily writes the undefined over it.
    const cfg = {
      fps: concept.fps || 30,
      levels: concept.levels || 12,
      // the tuned defaults, same as the next loadout
      matte: { mode: 'noise', cell: 3, depth: 0.26, bed: 0.26, bedSteps: 2, amp: 20,
               contrast: 0.50, speed: 0.06, wobble: 0.50 },
      layers: [{
        ink: ink, inkLight: ink,
        srgbBand: true,   // keep these pieces looking exactly as they were authored
        resize(cols, rows){
          buf = new Float32Array(cols*rows);
          ov = new Array(cols*rows).fill(null);
          if (concept.resize) concept.resize(cols, rows);
        },
        shadedGrid(S, cols, rows, t){
          if (!buf || buf.length !== cols*rows) this.resize(cols, rows);
          buf.fill(0);
          concept.compute(buf, cols, rows, t, ov);
          S.set(buf);
        }
      }]
    };
    for (const k of ['bg','ramp','fontSize','fontWeight','fontFamily','pad','edgeGlyphs'])
      if (concept[k] !== undefined) cfg[k] = concept[k];
    NX(cfg);
  };
  window.ASCIARA.noise = NX.noise;
  window.ASCIARA.fbm   = NX.fbm;
  window.ASCIARA.hash  = NX.hash;
})();
