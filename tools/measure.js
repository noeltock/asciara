/* measure.js — render ONE frame of a background headlessly and report what it actually puts on
   screen: ink coverage, the spread across the grey buckets, and the glyph mix.
   Screenshotting to answer "is this too dense?" costs minutes; this costs a second, and it is
   the same numbers a screenshot would have told you.

   usage:  node tools/measure.js <piece.html> [seconds]        e.g. node tools/measure.js assets/next/ridge.html 12
   Works for both engines — nx.js (NX) and engine.js + field.js (ASCIARA). */
const fs = require('fs'), path = require('path'), vm = require('vm');

const file = process.argv[2];
const T = parseFloat(process.argv[3] || '12');
if (!file) { console.error('usage: node tools/measure.js <piece.html> [seconds]'); process.exit(1); }

const html = fs.readFileSync(file, 'utf8');
const dir = path.dirname(file);
const FS = 15, PAD = 2;                  // the engines' defaults
const ADV = 1440/118 - PAD;              // measureText('M') stub, chosen to give ~118 cols
const gridCols = Math.ceil(1440/(ADV+PAD)), gridRows = Math.ceil(900/(FS*1.06+PAD)) + 1;

const cells = [];                        // every fillText the frame issues
let curFill = '#000';
const ctx = {
  set font(v){}, get font(){ return ''; },
  set fillStyle(v){ curFill = v; }, get fillStyle(){ return curFill; },
  set textBaseline(v){},
  setTransform(){}, fillRect(){}, clearRect(){},
  measureText(){ return { width: ADV }; },
  // the matte pass builds an offscreen tile; stub just enough for it to run headlessly
  createImageData(w, h){ return { width: w, height: h, data: new Uint8ClampedArray(w*h*4) }; },
  putImageData(){}, createPattern(){ return null; }, save(){}, restore(){},
  drawImage(){}, set globalCompositeOperation(v){}, set globalAlpha(v){},
  set imageSmoothingEnabled(v){},
  fillText(ch, x, y){ cells.push([ch, x, y, curFill]); }
};
const canvas = { style:{}, width:0, height:0, getContext(){ return ctx; } };
const scripts = [];
const sandbox = {
  console,
  location: { search: '' },
  devicePixelRatio: 2,
  innerWidth: 1440, innerHeight: 900,
  document: {
    documentElement: { style: {} }, body: { style: {}, appendChild(){} },
    querySelector(){ return canvas; },
    title: '',
    createElement(){ return { width:0, height:0, style:{}, getContext(){ return ctx; } }; },
    fonts: { ready: { then(){} } }
  },
  addEventListener(){},
  matchMedia(){ return { matches: false, addEventListener(){}, addListener(){} }; },
  requestAnimationFrame(fn){ scripts.push(fn); },   // capture, drive manually
  Math, Float32Array, Uint8Array, Uint8ClampedArray, Int32Array, Array, Object, URLSearchParams, JSON, parseInt, parseFloat, isNaN,
  atob: (b64) => Buffer.from(b64, 'base64').toString('binary')
};
sandbox.top = {};   // self !== top, so the control bar bails out — we only want the render
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// load whichever engine + helper scripts the page pulls in, then its own inline script
for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g))
  vm.runInContext(fs.readFileSync(path.join(dir, m[1]), 'utf8'), sandbox, { filename: m[1] });
const inline = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!inline) { console.error('no inline <script> found'); process.exit(1); }
vm.runInContext(inline[1], sandbox, { filename: file });

if (!scripts.length) { console.error('engine never requested a frame'); process.exit(1); }
scripts[0](0);                                   // frame 0 primes buffers (persistence, EMA)
const q = scripts.splice(0);
cells.length = 0;                                // ...and is NOT counted
for (const fn of q) fn(T*1000);                  // the frame we actually measure

const total = gridCols * gridRows;
const cov = cells.length / total * 100;
const greys = {};
for (const [, , , f] of cells){
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(f);
  const v = m ? +m[1] : 0;
  greys[v] = (greys[v] || 0) + 1;
}
const levels = Object.keys(greys).map(Number).sort((a,b)=>a-b);
const glyphs = {};
for (const [ch] of cells) glyphs[ch] = (glyphs[ch] || 0) + 1;
const top = Object.entries(glyphs).sort((a,b)=>b[1]-a[1]).slice(0, 10);

// MACRO STRUCTURE — the thing that separates swell from a uniform hatch.
// Drop the brightness field into an 8x8-cell grid and take the spread of those block means.
// A field with big organic masses varies a lot block to block (high); an even wash or a
// regular hatch averages out to the same value everywhere (low).
const BK = 8;
const bw = Math.ceil(gridCols/BK), bh = Math.ceil(gridRows/BK);
const bsum = new Float64Array(bw*bh), bcnt = new Float64Array(bw*bh);
for (const [, x, y, f] of cells){
  const m = /rgb\((\d+),/.exec(f); const v = m ? +m[1] : 0;
  const cx = Math.floor(x/(ADV+PAD)/BK), cy = Math.floor(y/(FS*1.06+PAD)/BK);
  const bi = Math.min(bh-1,cy)*bw + Math.min(bw-1,cx);
  bsum[bi] += v; bcnt[bi]++;
}
const means = [];
for (let i=0;i<bw*bh;i++) if (bcnt[i]) means.push(bsum[i]/bcnt[i]);
const mu = means.reduce((a,b)=>a+b,0)/means.length;
const macro = Math.sqrt(means.reduce((a,b)=>a+(b-mu)*(b-mu),0)/means.length);

// how evenly the ink is spread across the grey levels: 1.0 = perfectly even, low = bunched
const counts = levels.map(v => greys[v]), sum = counts.reduce((a,b)=>a+b,0);
const H = -counts.reduce((a,c)=> a + (c/sum) * Math.log(c/sum), 0);
const even = levels.length > 1 ? H / Math.log(levels.length) : 0;

console.log(`${path.basename(file)}  t=${T}s  grid ~${gridCols}x${gridRows}`);
console.log(`  ink coverage   ${cov.toFixed(1)}%   (measure the references the same way to compare)`);
console.log(`  grey levels    ${levels.length} in use, spread evenness ${even.toFixed(2)} (1.0 = uses the whole spectrum)`);
console.log(`  level counts   ${levels.map(v=>`${v}:${greys[v]}`).join('  ')}`);
// INK WEIGHT — mean position in the ramp, 0..1. Mean grey measures the COLOUR a glyph is drawn
// in; it says nothing about how much of the cell that glyph fills. A '&' at grey 60 puts far more
// ink on screen than a '.' at grey 80, so two pieces can match on grey and still look nothing
// alike in weight. This is the number that tracks how heavy a piece actually reads.
const RAMP = " .:;/<>=?*T%&#@N";
let inkSum = 0;
for (const [ch] of cells){ const i = RAMP.indexOf(ch); if (i > 0) inkSum += i/(RAMP.length-1); }
const inkW = inkSum / Math.max(1, cells.length);
console.log(`  ink weight     ${inkW.toFixed(3)}  (mean ramp position — how heavy it reads)`);
console.log(`  macro structure ${macro.toFixed(1)}  mean grey ${mu.toFixed(0)}   (big organic masses = high macro; even wash or regular hatch = low)`);
console.log(`  glyph mix      ${top.map(([c,n])=>`${JSON.stringify(c)}:${n}`).join('  ')}`);
