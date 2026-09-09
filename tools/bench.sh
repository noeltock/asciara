#!/bin/sh
# Frame-time and screenshot baseline for the WebGL trial pages.
#   usage:  tools/bench.sh [outdir] [page ...]
# Needs a server on :8765 (python3 -m http.server 8765) and agent-browser on PATH.
# Runs each page at 2560x1440, samples rAF for 10s, prints average/worst frame
# time and frames above 16ms, and saves a screenshot per page into outdir.
set -e
OUT=${1:-/tmp/asciara-bench}; shift
mkdir -p "$OUT"
agent-browser open >/dev/null                            # size the window BEFORE the first page loads,
agent-browser set viewport 2560 1440 >/dev/null          # or the canvas keeps the default size
PAGES=${*:-"assets/next/screen.html assets/next/screen.html?matte=off assets/next/ridge.html index.html"}
for u in $PAGES; do
  n=$(echo "$u" | sed 's#assets/next/##; s#[/?=&.]#_#g')
  case "$u" in *\?*) sep='&';; *) sep='?';; esac
  agent-browser open "http://localhost:8765/$u${sep}v=$$" >/dev/null         # defeat the page cache
  sleep 2.5
  # time the frame CALLBACK, not the interval between frames: headless paces rAF to vsync, so the
  # interval is 16.7ms on every page and says nothing. Callback time is the real cost per frame.
  r=$(agent-browser eval 'new Promise(res=>{const o=window.requestAnimationFrame;let n=0,sum=0,mx=0,over16=0,over8=0;window.requestAnimationFrame=cb=>o(ts=>{const a=performance.now();cb(ts);const d=performance.now()-a;n++;sum+=d;if(d>mx)mx=d;if(d>16)over16++;if(d>8)over8++;});setTimeout(()=>{window.requestAnimationFrame=o;const st=window.GL&&window.GL.stats?" gpu="+JSON.stringify(window.GL.stats):"";res("avg="+(sum/n).toFixed(2)+"ms worst="+mx.toFixed(1)+"ms over8="+over8+" over16="+over16+" frames="+n+st)},10000)})' 2>&1 | tail -1 | tr -d '"')
  agent-browser screenshot "$OUT/$n.png" >/dev/null
  printf '%-42s %s\n' "$u" "$r"
done
agent-browser close >/dev/null
echo "screenshots: $OUT"
