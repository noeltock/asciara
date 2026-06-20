/* asciara concepts engine — shared boilerplate so each concept is just a field.
   DPR-correct canvas (sharp on Retina), Geist Mono Light, greyscale graded render,
   coverage-ordered web ramp, fps throttle. A concept calls:
     ASCIARA({ compute(buf, cols, rows, t){ ... fill buf[y*cols+x] in 0..1 ... }, resize?, ...overrides })
   Helpers: ASCIARA.noise(x,y), ASCIARA.fbm(x,y), ASCIARA.hash(ix,iy).  Math.random is fine here. */
(function () {
  function hash(ix, iy){ let h=(ix|0)*374761393+(iy|0)*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }
  function sm(t){ return t*t*t*(t*(t*6-15)+10); }
  function noise(x, y){
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy, u=sm(fx), v=sm(fy);
    const a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1);
    return (a*(1-u)+b*u)*(1-v) + (c*(1-u)+d*u)*v;
  }
  function fbm(x, y){ let s=0, amp=0.55, f=1; for (let o=0;o<4;o++){ s+=amp*noise(x*f,y*f); f*=2; amp*=0.5; } return s; }

  function run(concept){
    const C = Object.assign({
      ramp: " .:;/<>=?*T%&#@N", fontSize: 15, fontWeight: 300,
      fontFamily: "'Geist Mono','JetBrains Mono',Menlo,monospace",
      bg: "#080808", shading: true, mono: "#cfcfcf", fps: 30, levels: 12, maxCols: 160, pad: 2,
      ink: ["#4d4d4d", "#ffffff"],     // [faint, dense] colour band for the FIELD layer
      overlay: ["#3a3a3a", "#ffffff"]  // [shadow, lit] band for the OVERLAY layer (e.g. a shaded 3D logo)
    }, concept);

    let cv = document.querySelector('canvas');
    if (!cv){ cv = document.createElement('canvas'); document.body.appendChild(cv); }
    const ctx = cv.getContext('2d');
    let cols, rows, adv, lineH, buf, ov;

    function fit(){
      const dpr = window.devicePixelRatio || 1, W = innerWidth, Hh = innerHeight;
      cv.style.width = W+'px'; cv.style.height = Hh+'px';
      cv.width = Math.round(W*dpr); cv.height = Math.round(Hh*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.font = C.fontWeight+' '+C.fontSize+'px '+C.fontFamily; ctx.textBaseline = 'top';
      adv = ctx.measureText('M').width + C.pad; lineH = C.fontSize*1.06 + C.pad;
      cols = Math.min(C.maxCols, Math.ceil(W/adv)); rows = Math.ceil(Hh/lineH);
      buf = new Float32Array(cols*rows); ov = new Array(cols*rows).fill(null);
      if (concept.resize) concept.resize(cols, rows);
    }
    addEventListener('resize', fit); fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    const ramp = C.ramp, n = ramp.length-1, Lc = C.levels;
    function hexrgb(h){ h = h.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
    const inkLo = hexrgb(C.ink[0]), inkHi = hexrgb(C.ink[1]);
    const ovLo = hexrgb(C.overlay[0]), ovHi = hexrgb(C.overlay[1]);
    function band(lo, hi, b){
      const r = Math.round(lo[0] + (hi[0]-lo[0])*b), g = Math.round(lo[1] + (hi[1]-lo[1])*b), bl = Math.round(lo[2] + (hi[2]-lo[2])*b);
      return 'rgb('+r+','+g+','+bl+')';
    }
    function grey(b){ return band(inkLo, inkHi, b); }

    let last = -1e9;
    function loop(now){
      requestAnimationFrame(loop);
      if (now - last < 1000/Math.max(1, C.fps)) return; last = now;
      const t = now/1000;
      buf.fill(0); ov.fill(null);
      concept.compute(buf, cols, rows, t, ov);   // ov[i] = an overlay glyph, drawn in C.overlay on top of the field
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,innerWidth,innerHeight);
      // overlay cells: ov[idx] is a glyph string (flat, b=1) or {c, b} with its own brightness within the overlay band
      const ovb = Array.from({length:Lc}, ()=>[]);
      function pushOv(o, px, py){
        if (typeof o === 'string'){ ovb[Lc-1].push(o, px, py); }
        else { let b=o.b; if(b<0)b=0; if(b>1)b=1; ovb[Math.min(Lc-1,(b*Lc)|0)].push(o.c, px, py); }
      }
      if (C.shading){
        const bk = Array.from({length:Lc}, ()=>[]);
        for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
          const idx=y*cols+x, o=ov[idx];
          if (o!=null){ pushOv(o, x*adv, y*lineH); continue; }       // overlay cell: skip the field here
          let v = buf[idx]; if (v<=0) continue; if (v>1) v=1;
          const ci = Math.min(n,(v*(n+1))|0); if (ci===0) continue;
          bk[Math.min(Lc-1,(v*Lc)|0)].push(ramp[ci], x*adv, y*lineH);
        }
        for (let l=0;l<Lc;l++){ const a=bk[l]; if(!a.length) continue; ctx.fillStyle=grey((l+0.5)/Lc);
          for (let i=0;i<a.length;i+=3) ctx.fillText(a[i],a[i+1],a[i+2]); }
      } else {
        ctx.fillStyle = C.mono;
        for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
          const idx=y*cols+x, o=ov[idx];
          if (o!=null){ pushOv(o, x*adv, y*lineH); continue; }
          let v = buf[idx]; if (v<=0) continue; if (v>1) v=1;
          const ci = Math.min(n,(v*(n+1))|0); if (ci===0) continue;
          ctx.fillText(ramp[ci], x*adv, y*lineH);
        }
      }
      // draw the shaded overlay (logo) on top, bucketed by brightness within the overlay band
      for (let l=0;l<Lc;l++){ const a=ovb[l]; if(!a.length) continue; ctx.fillStyle=band(ovLo, ovHi, (l+0.5)/Lc);
        for (let i=0;i<a.length;i+=3) ctx.fillText(a[i],a[i+1],a[i+2]); }
    }
    requestAnimationFrame(loop);
  }
  window.ASCIARA = run; run.noise = noise; run.fbm = fbm; run.hash = hash;
})();
