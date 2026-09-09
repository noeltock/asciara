/* gl.js — WebGL2 trial renderer for the asciara next pieces.
   Height callbacks remain ordinary JavaScript. Everything after the height field is a pair of
   WebGL passes: one cell-resolution material/glyph pass, then one viewport-resolution atlas,
   matte, lattice, and composite pass. */
(function(){
  'use strict';

  const MAX_LAYERS = 8, HEIGHT_TEXTURE_UNIT = 6;
  // One list drives the direct-page switcher.  The pages under `next/` now load this renderer;
  // `nx.js` remains beside them as the Canvas reference implementation.
  const CATALOGUE = [
    ['', [['home','/']]],
    ['next', [
      ['ridge','/assets/next/ridge.html'], ['glint','/assets/next/glint.html'],
      ['strata','/assets/next/strata.html'], ['phosphor','/assets/next/phosphor.html'],
      ['mark','/assets/next/mark.html']
    ]],
    ['gl', [['screen','/assets/next/screen.html'], ['stress','/assets/gl/stress.html']]],
    ['current', [
      ['billow','/assets/billow.html'], ['mist','/assets/mist.html'],
      ['contours','/assets/concepts/contours.html'], ['swell','/assets/concepts/swell.html'],
      ['dunes','/assets/concepts/dunes.html'], ['tide','/assets/concepts/tide.html'],
      ['plume','/assets/concepts/plume.html'], ['caustics','/assets/concepts/caustics.html'],
      ['aurora','/assets/concepts/aurora.html'], ['wind','/assets/concepts/wind.html'],
      ['current','/assets/concepts/current.html'], ['monolith','/assets/concepts/monolith.html'],
      ['gyre','/assets/concepts/gyre.html']
    ]],
    ['lab', [['smoke','/assets/lab/_smoke.html']]]
  ];
  const BN64 = 'I5d/zzB8rETKdU4MaCxLiBfskFn8CV7jkfRCKrUXYD/+AULzT+UGZZ0vvtep6QDPo3AOyXfXoi9QA2fThe2gu2alxY0dodOK8ROBOlSVvFoz4E2aOiRrxq/beqgNTS2A11UubbVbPCFR36L3GXkl/ISvIOe9i/cYgzsi+1zH4hmuEe3PCvt4x7RuJ1/B3kNqDdRifgFZRpvmVbiMN3KSPmyJSX6aM9yQAUXRmAiHscyeRy/yodm5C2nJE96kBbz3ody5I2KsFlin7X088lMwHO+Pwm8+JnPuNZZ2KmTrUSBdBDrw0kf0dDHDErNrouB3XAexFMqRrRzRSPawQsiCNebKknEMgrgh4oZcKdgMjkHHgUz/XuNOh1+gCInYEpi3FGtLs582zmOdSP6Vuk74qifqmyB8MQr5uyXhVm8o/XasLvYX41SNCdQawTt1I2cR0zhk2byk1mw8ecQ1pr5SPZTUf17EJOxBsWiBAszqn7tYka8CQVeSFavoD4zwAoThWAu9NJNqqnfzLNqoWoowe/Udc+eI8Cm/Spda1ERnzR/ybKZJ/wTdHleQSuYbRNgHS9A0wxho0H/0HnMqtpk0q4ss3xvHhziewwu2bpX8ZcCIp2GYTK45BGLMqvx+FepMBsqWeVGyYtJ9+TsnxhWtOfAm3Av/dOKeuDNICNxhxHr6Wz/pDfEmSBdlo9Z5UJxyEFV8ui2NHFGG2ZRWpCVAr22nH7ZxnILareRUigboK9W16aBA0VzG9ikR7m27h+MUMNuDzis9vgCPMhnzP7CFYEaOG23rBqY+ZHvFHjbOU5TDRQVW5Gb2U2/Lnbxs0Bn4A8UzsU2Rdr3lqkaZ+QNz7mOf+IysEqQk5UN7KFiWN6Zw4n37EssxGosI3V+BSbQYKL1wNclKhcKWCf3VD+x/zFcpmFuj3WX1WTu3Jeal1Y7nUBDfIWrZMlm0ZKhKuB1CshbYPSKDQ8Kh0XCTEzFpQMiJrnqc+w537x6CNJNm13X3hcJo87UBeCwO/UXGevgMYCTxOVe5RqnNTtq/AvErmwdPqRCPVOGa6IZdqd5Vs53hR78JkNMuigqUJud2UMVe4DjpdDLNH2lLsjYbiwAugBZ0omHkHHHqW7ppP6uPGq6AyyOZ76g+wBTP7nHB9E/SN/3NKH2gTMg3+p4Qzi/+RRFnt1INYIT6dZInoz1mmrZdBY1St/UDq4AWeE3rhm/Vk+RDjMTbLa0FWkfgE9YghMGnQewYOmrfKsDdpV8HvlUtpQTyaxpPl9LruYhysEnvbivbcpvWiVKXYzgfyDycHfV40DaDsu1uOSFjCvoylQ7lVrMPXb8i/g/osI75e960YUC6Ip9EwBV+qsuZU9p8yQ==';
  const BN = (function(){
    const b = atob(BN64), a = new Uint8Array(1024);
    for (let i = 0; i < a.length; i++) a[i] = b.charCodeAt(i);
    return a;
  })();
  const LIGHT = new URLSearchParams(location.search).has('light');
  const warned = new Set();

  function warn(key){
    if (!warned.has(key)){ warned.add(key); console.warn('GL: unsupported key ignored: ' + key); }
  }
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
    let s = 0, amp = 0.55, f = 1;
    for (let o = 0, n = oct || 4; o < n; o++){ s += amp*noise(x*f, y*f); f *= 2; amp *= .5; }
    return s;
  }
  function warp(x, y, amt, oct){
    const a = amt == null ? 1.6 : amt;
    const qx = fbm(x,y,oct), qy = fbm(x+5.2,y+1.3,oct);
    const rx = fbm(x+a*qx+1.7,y+a*qy+9.2,oct), ry = fbm(x+a*qx+8.3,y+a*qy+2.8,oct);
    return fbm(x+1.8*rx,y+1.8*ry,oct);
  }
  function smoothstep(e0, e1, x){ const t = Math.max(0,Math.min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t); }
  function mix(a,b,t){ return a+(b-a)*t; }
  function sdTriangle(px,py,p0,p1,p2){
    function edge(a,b){
      const ex=b[0]-a[0], ey=b[1]-a[1], wx=px-a[0], wy=py-a[1];
      const t=Math.max(0,Math.min(1,(wx*ex+wy*ey)/(ex*ex+ey*ey))), dx=wx-ex*t, dy=wy-ey*t;
      return [dx*dx+dy*dy,wx*ey-wy*ex];
    }
    const e0=edge(p0,p1),e1=edge(p1,p2),e2=edge(p2,p0);
    const s=Math.sign(e0[1])===Math.sign(e1[1])&&Math.sign(e1[1])===Math.sign(e2[1])?-1:1;
    return s*Math.sqrt(Math.min(e0[0],e1[0],e2[0]));
  }
  function s2l(c){ c/=255; return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4); }
  function hex(h){
    h=h.replace('#','');
    return [s2l(parseInt(h.slice(0,2),16)),s2l(parseInt(h.slice(2,4),16)),s2l(parseInt(h.slice(4,6),16))];
  }
  function hexSrgb(h){
    h=h.replace('#','');
    return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function gcd(a,b){ while(b){ const r=a%b; a=b; b=r; } return a; }
  function shader(gl, type, source){
    const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs){
    const p=gl.createProgram(); gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs)); gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    return p;
  }
  function texture(gl, internal, format, type){
    const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    t._internal=internal; t._format=format; t._type=type;
    return t;
  }
  function textureArray(gl, internal, format, type){
    const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY,t);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }

  const VS = `#version 300 es
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    gl_Position=vec4(p*2.0-1.0,0.0,1.0);
  }`;
  const STATE_RAW_FS = `#version 300 es
  precision highp float;
  precision highp int;
  #define MAX_LAYERS ${MAX_LAYERS}
  uniform int uLayer;
  uniform float uBlend[MAX_LAYERS];
  uniform ivec2 uGrid;
  uniform int uHeightParity[MAX_LAYERS];
  uniform highp sampler2DArray uHeights;
  uniform sampler2D uPrevState;
  uniform vec4 uP0[MAX_LAYERS],uP1[MAX_LAYERS],uP2[MAX_LAYERS],uP3[MAX_LAYERS],uP4[MAX_LAYERS];
  uniform vec4 uTemporal[MAX_LAYERS];
  layout(location=0) out vec4 oState;
  float hAt(int layer, ivec2 p){
    p=clamp(p,ivec2(0),uGrid-1);
    vec2 uv=(vec2(p)+.5)/vec2(uGrid);
    int parity=uHeightParity[layer];
    float previous=texture(uHeights,vec3(uv,float(layer*2+1-parity))).r;
    float current=texture(uHeights,vec3(uv,float(layer*2+parity))).r;
    return mix(previous,current,uBlend[layer]);
  }
  float shade(int layer, ivec2 p){
    float h=hAt(layer,p);
    if(uP4[layer].w>.5)return clamp(h,0.0,1.0);
    ivec2 xm=ivec2(max(0,p.x-1),p.y),xp=ivec2(min(uGrid.x-1,p.x+1),p.y);
    ivec2 ym=ivec2(p.x,max(0,p.y-1)),yp=ivec2(p.x,min(uGrid.y-1,p.y+1));
    float inv2s=uP0[layer].y>.5?.5:float(uGrid.x)/(2.0*uP0[layer].x);
    float hx=(hAt(layer,xp)-hAt(layer,xm))*inv2s*(xp.x!=xm.x?1.0:2.0);
    float hy=(hAt(layer,yp)-hAt(layer,ym))*inv2s*(yp.y!=ym.y?1.0:2.0);
    vec3 n=normalize(vec3(-uP0[layer].z*hx,-uP0[layer].z*hy,1.0));
    vec3 l=normalize(uP4[layer].xyz),hv=normalize(l+vec3(0.0,0.0,1.0));
    float d=max(0.0,dot(n,l));
    float s=uP1[layer].x+uP1[layer].y*h+uP1[layer].z*d;
    if(uP1[layer].w>0.0)s+=uP1[layer].w*pow(max(0.0,dot(n,hv)),uP2[layer].x);
    if(uP2[layer].y>0.0)s+=uP2[layer].y*pow(1.0-n.z,uP2[layer].z);
    s=(s-.5)*uP0[layer].w+.5;
    if(uP2[layer].w!=1.0)s=s>0.0?pow(s,uP2[layer].w):0.0;
    return clamp(s,0.0,1.0);
  }
  vec2 rawGradient(int layer,ivec2 p){
    return vec2(hAt(layer,p+ivec2(1,0))-hAt(layer,p-ivec2(1,0)),hAt(layer,p+ivec2(0,1))-hAt(layer,p-ivec2(0,1)));
  }
  vec2 blurredGradient(int layer,ivec2 p){
    vec2 total=vec2(0.0);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)total+=rawGradient(layer,p+ivec2(x,y));
    return total/9.0;
  }
  void main(){
    ivec2 p=ivec2(int(gl_FragCoord.x),int(gl_FragCoord.y)-uLayer*uGrid.y);
    vec4 prev=texelFetch(uPrevState,ivec2(p.x,p.y+uLayer*uGrid.y),0);
    float s=shade(uLayer,p),persist=uTemporal[uLayer].x;
    if(persist>0.0)s=max(prev.r*persist,s);
    if(uP3[uLayer].z<=0.0){oState=vec4(s,prev.g,0.0,0.0);return;}
    float m=length(blurredGradient(uLayer,p));
    float gs=prev.g*uTemporal[uLayer].y+m*(1.0-uTemporal[uLayer].y);
    oState=vec4(s,gs,0.0,0.0);
  }`;
  const REDUCE_FS = `#version 300 es
  precision highp float;
  precision highp int;
  uniform sampler2D uInput;
  uniform ivec2 uInputGrid;
  uniform int uInputRows,uOutputRows,uChannel;
  out vec4 outColor;
  float at(ivec2 p,int layer){
    p=clamp(p,ivec2(0),uInputGrid-1);
    vec4 v=texelFetch(uInput,ivec2(p.x,p.y+layer*uInputRows),0);
    return uChannel==0?v.r:v.g;
  }
  void main(){
    int layer=int(gl_FragCoord.y)/uOutputRows;
    int oy=int(gl_FragCoord.y)-layer*uOutputRows;
    ivec2 p=ivec2(int(gl_FragCoord.x)*2,oy*2);
    float m=max(max(at(p,layer),at(p+ivec2(1,0),layer)),max(at(p+ivec2(0,1),layer),at(p+ivec2(1,1),layer)));
    outColor=vec4(m,0.0,0.0,1.0);
  }`;
  const GMAX_FS = `#version 300 es
  precision highp float;
  precision highp int;
  uniform sampler2D uReduced,uPrevious;
  out vec4 outColor;
  void main(){
    int layer=int(gl_FragCoord.y);
    float current=texelFetch(uReduced,ivec2(0,layer),0).r;
    float previous=texelFetch(uPrevious,ivec2(0,layer),0).r;
    outColor=vec4(previous*.9+current*.1,0.0,0.0,1.0);
  }`;
  const STATE_FINAL_FS = `#version 300 es
  precision highp float;
  precision highp int;
  #define MAX_LAYERS ${MAX_LAYERS}
  uniform int uLayer;
  uniform float uBlend[MAX_LAYERS];
  uniform ivec2 uGrid;
  uniform int uHeightParity[MAX_LAYERS];
  uniform highp sampler2DArray uHeights;
  uniform sampler2D uRawState,uPrevState,uGmax;
  uniform vec4 uP3[MAX_LAYERS],uTemporal[MAX_LAYERS];
  layout(location=0) out vec4 oState;
  float hAt(int layer,ivec2 p){
    p=clamp(p,ivec2(0),uGrid-1);
    vec2 uv=(vec2(p)+.5)/vec2(uGrid);int parity=uHeightParity[layer];
    float previous=texture(uHeights,vec3(uv,float(layer*2+1-parity))).r;
    float current=texture(uHeights,vec3(uv,float(layer*2+parity))).r;
    return mix(previous,current,uBlend[layer]);
  }
  vec2 rawGradient(int layer,ivec2 p){return vec2(hAt(layer,p+ivec2(1,0))-hAt(layer,p-ivec2(1,0)),hAt(layer,p+ivec2(0,1))-hAt(layer,p-ivec2(0,1)));}
  vec2 blurredGradient(int layer,ivec2 p){vec2 total=vec2(0.0);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)total+=rawGradient(layer,p+ivec2(x,y));return total/9.0;}
  int directionAt(int layer,ivec2 p){
    vec2 g=blurredGradient(layer,p);
    float deg=mod(degrees(atan(g.y,g.x))+450.0,180.0);
    return deg<22.5||deg>=157.5?0:deg<67.5?1:deg<112.5?2:3;
  }
  void main(){
    ivec2 p=ivec2(int(gl_FragCoord.x),int(gl_FragCoord.y)-uLayer*uGrid.y),sp=ivec2(p.x,p.y+uLayer*uGrid.y);
    vec4 raw=texelFetch(uRawState,sp,0),prev=texelFetch(uPrevState,sp,0);
    if(uP3[uLayer].z<=0.0){oState=vec4(raw.r,raw.g,0.0,0.0);return;}
    float hi=uP3[uLayer].z*texelFetch(uGmax,ivec2(0,uLayer),0).r;
    float lo=hi*uTemporal[uLayer].z;
    float line=raw.g>(prev.b>.5?lo:hi)?1.0:0.0;
    int own=directionAt(uLayer,p),chosen=own,r=max(0,int(floor(uTemporal[uLayer].w)));
    if(line>.5&&r>0){
      float v0=0.0,v1=0.0,v2=0.0,v3=0.0;
      for(int y=-r;y<=r;y++)for(int x=-r;x<=r;x++){
        ivec2 q=clamp(p+ivec2(x,y),ivec2(0),uGrid-1);
        float w=texelFetch(uRawState,ivec2(q.x,q.y+uLayer*uGrid.y),0).g;
        int d=directionAt(uLayer,q);
        if(d==0)v0+=w;else if(d==1)v1+=w;else if(d==2)v2+=w;else v3+=w;
      }
      chosen=v0>=v1&&v0>=v2&&v0>=v3?0:v1>=v2&&v1>=v3?1:v2>=v3?2:3;
    }
    oState=vec4(raw.r,raw.g,line,(float(chosen)+.5)/4.0);
  }`;
  const CELL_FS = `#version 300 es
  precision highp float;
  precision highp int;
  #define MAX_LAYERS ${MAX_LAYERS}
  uniform int uLayerCount;
  uniform float uLevels;
  uniform ivec2 uGrid;
  uniform sampler2D uState,uBlue,uRampMap;
  uniform vec4 uP3[MAX_LAYERS];
  uniform vec4 uInkLo[MAX_LAYERS],uInkHi[MAX_LAYERS],uInkLoS[MAX_LAYERS],uInkHiS[MAX_LAYERS];
  uniform float uEdgeLift[MAX_LAYERS];
  uniform int uRampLength[MAX_LAYERS];
  layout(location=0) out vec4 oGlyph;
  layout(location=1) out vec4 oBed;
  vec3 toSrgb(vec3 c){
    vec3 lo=c*12.92, hi=1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055;
    return clamp(mix(hi,lo,lessThanEqual(c,vec3(.0031308))),0.0,1.0);
  }
  void main(){
    ivec2 p=clamp(ivec2(gl_FragCoord.xy),ivec2(0),uGrid-1);
    float best=-1.0; int bedLayer=-1;
    for(int li=0;li<MAX_LAYERS;li++) if(li<uLayerCount){ float s=texelFetch(uState,ivec2(p.x,p.y+li*uGrid.y),0).r; if(s>best){best=s;bedLayer=li;} }
    int chosen=-1; float cs=0.0; int glyph=0;
    for(int k=0;k<MAX_LAYERS;k++){
      int li=uLayerCount-1-k; if(li<0)break;
      vec4 state=texelFetch(uState,ivec2(p.x,p.y+li*uGrid.y),0);
      float s=state.r; if(s<=uP3[li].x)continue;
      int rampN=uRampLength[li]-1; float sd=s;
      bool edge=uP3[li].z>0.0&&state.b>.5;
      if(edge){
        int dir=int(floor(state.a*4.0));
        glyph=int(floor(texelFetch(uRampMap,ivec2(rampN+1+dir,li),0).r*255.0+.5));
        sd=clamp(s*uP3[li].w+uEdgeLift[li],0.0,1.0);
      }
      if(!edge){
        float bn=texelFetch(uBlue,ivec2(p.x&31,p.y&31),0).r-.5;
        sd=s+uP3[li].y/float(rampN+1)*bn;
        int ci=int(floor(clamp(sd,0.0,.999999)*float(rampN+1)));
        if(ci==0)continue;
        glyph=int(floor(texelFetch(uRampMap,ivec2(ci,li),0).r*255.0+.5));
      }
      chosen=li; cs=sd; break;
    }
    if(chosen<0) oGlyph=vec4(0.0);
    else{
      float level=floor(clamp(cs,0.0,.999999)*uLevels);
      vec3 col=mix(uInkLo[chosen].rgb,uInkHi[chosen].rgb,(level+.5)/uLevels);
      if(uInkLo[chosen].w>.5) col=mix(uInkLoS[chosen].rgb,uInkHiS[chosen].rgb,(level+.5)/uLevels);
      else col=toSrgb(col);
      oGlyph=vec4(col,float(glyph+1)/255.0);
    }
    oBed=vec4(float(bedLayer+1)/255.0,clamp(best,0.0,1.0),0.0,1.0);
  }`;
  const PAINT_FS = `#version 300 es
  precision highp float;
  precision highp int;
  #define MAX_LAYERS ${MAX_LAYERS}
  uniform ivec2 uGrid;
  uniform vec2 uViewport,uCell,uAtlas;
  uniform float uTime;
  uniform int uGlyphCount,uMatteOn;
  uniform sampler2D uGlyph,uBed,uAtlasTex,uBlue;
  uniform vec4 uMatte0[MAX_LAYERS];
  uniform vec4 uMatte1[MAX_LAYERS];
  uniform vec4 uMatte2[MAX_LAYERS];
  uniform vec4 uMatte3[MAX_LAYERS];
  uniform vec3 uBg;
  out vec4 outColor;
  float bnAt(ivec2 p){ return texelFetch(uBlue,ivec2(p.x&31,p.y&31),0).r-.5; }
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
  float curve(vec4 m3,float s){
    if(m3.x<=0.0)return 1.0;
    float x=1.0-abs(2.0*clamp(s,0.0,1.0)-1.0);
    return m3.y+(1.0-m3.y)*pow(x,m3.x);
  }
  void main(){
    vec2 top=vec2(gl_FragCoord.x,uViewport.y-gl_FragCoord.y);
    ivec2 cell=clamp(ivec2(floor(top/uCell)),ivec2(0),uGrid-1);
    vec4 glyph=texelFetch(uGlyph,cell,0), bed=texelFetch(uBed,cell,0);
    int layer=int(floor(bed.r*255.0+.5))-1;
    vec3 base=uBg; float cut=1.0;
    if(uMatteOn==1 && layer>=0){
      vec4 m0=uMatte0[layer],m1=uMatte1[layer],m2=uMatte2[layer],m3=uMatte3[layer];
      int mode=int(floor(m0.x+.5));
      float cellPx=max(1.0,m0.y);
      ivec2 block=ivec2(floor(top/cellPx));
      float n=bnAt(block), c=curve(m3,bed.g), steps=max(2.0,m1.x);
      bool ink=true;
      if(mode==3){
        float angle=radians(m2.y);
        float phase=(float(block.x)*-sin(angle)+float(block.y)*cos(angle))/max(1.0,m2.x);
        ink=fract(phase)<clamp(m2.z,0.0,1.0);
      }
      if(mode==1 && m0.z>0.0){
        float v=n;
        if(m1.w>0.0){ v+=m3.z*sin(6.28318*(uTime*m1.w+hash(vec2(block)))); if(v>.5)v-=1.0; else if(v<-.5)v+=1.0; }
        float u=v*2.0;
        if(m1.z>0.0)u=sign(u)*pow(abs(u),1.0-m1.z*.85);
        v=floor(u*.5*steps+.5)/steps;
        float amp=m1.y*c,h=amp*.5;
        vec3 centre=clamp(uBg*255.0,vec3(h),vec3(255.0-h));
        base=clamp((centre+amp*v)/255.0,0.0,1.0);
      } else if((mode==2||mode==3) && m0.z>0.0){
        float v=bed.g;
        if(mode==2)v+=n/steps*c; else v+=(ink?.5:-.5)/steps*c;
        v=clamp(floor(v*steps+.5)/steps,0.0,1.0);
        base=mix(base,vec3(1.0),m0.z*v*v);
      }
      float mask=mode==3?(ink?1.0:0.0):n+.5;
      cut=1.0-m0.w*mask;
    }
    float code=floor(glyph.a*255.0+.5)-1.0;
    float alpha=0.0;
    if(code>=0.0){
      vec2 inCell=fract(top/uCell);
      vec2 auv=vec2((code+inCell.x)/float(uGlyphCount),inCell.y);
      alpha=texture(uAtlasTex,auv).a*cut;
    }
    outColor=vec4(mix(base,glyph.rgb,alpha),1.0);
  }`;

  function run(spec){
    const C=Object.assign({
      ramp:' .:;/<>=?*T%&#@N',edgeGlyphs:['-','/','|','\\'],fontSize:15,fontWeight:300,
      fontFamily:"'Geist Mono','JetBrains Mono',Menlo,monospace",pad:2,fps:30,levels:14,
      maxCells:15000,maxFontSize:34,matte:null,ui:true,bg:LIGHT?'#fbfbfb':'#080808'
    },spec);
    const fieldFps=Number.isFinite(C.fps)&&C.fps>0?C.fps:0,fieldPeriod=fieldFps?1/fieldFps:0;
    const allowed=new Set(['ramp','edgeGlyphs','fontSize','fontWeight','fontFamily','pad','fps','levels','maxCells','maxFontSize','matte','matteDefault','ui','bg','layers','resize']);
    Object.keys(spec).forEach(k=>{if(!allowed.has(k))warn(k);});
    if(!Array.isArray(C.layers)||!C.layers.length) throw Error('GL requires at least one layer');
    if(C.layers.length>MAX_LAYERS) throw Error('GL supports at most '+MAX_LAYERS+' layers');
    const query=new URLSearchParams(location.search), mq=query.get('matte');
    let matteDisabled=mq==='off';
    if(matteDisabled) C.matte=null;
    else if(C.matte&&['noise','field','screen'].indexOf(mq)>=0) C.matte=Object.assign({},C.matte,{mode:mq});
    if(C.matte){
      const qkeys=[['cell','cell'],['amp','amp'],['bed','bed'],['steps','bedSteps'],['contr','contrast'],['speed','speed'],['wob','wobble'],['depth','depth'],['floor','floor'],['pitch','pitch'],['angle','angle'],['duty','duty']];
      qkeys.forEach(([q,k])=>{const v=query.get(q);if(v!==null&&v!==''&&!isNaN(+v))C.matte[k]=+v;});
      const curve=query.get('curve'); if(curve==='flat'||curve==='bell')C.matte.curve=curve; else if(curve!==null&&!isNaN(+curve))C.matte.curve=+curve;
    }
    const defaults={span:1.5,aspect:2,gridSpace:false,srgbBand:false,drift:[-.85,-.32],driftSpeed:.05,evolve:.12,bump:1.9,light:[-.5,-.6,.62],contrast:1.05,amb:.08,hgt:.1,dif:.92,spec:0,shine:24,rim:0,rimPow:3,edges:0,edgeBoost:1,edgeLift:0,lineSmooth:.86,lineHyst:.62,vote:1,persist:0,cutoff:0,dither:0,gamma:1,ramp:null,ink:['#161616','#707070'],inkLight:['#ececec','#9a9a9a']};
    const knownLayer=new Set(Object.keys(defaults).concat(['height','heightGrid','shadedGrid','resize','matte','occlude','oct']));
    const layers=C.layers.map((source,i)=>{
      Object.keys(source).forEach(k=>{if(!knownLayer.has(k))warn('layers['+i+'].'+k);});
      if(!source.height&&!source.heightGrid&&!source.shadedGrid)throw Error('GL layer '+i+' needs height, heightGrid, or shadedGrid');
      return Object.assign({},defaults,source);
    });
    const matteDefaults={mode:'noise',cell:3,depth:.26,bed:.26,bedSteps:2,amp:20,contrast:.5,speed:.06,wobble:.5,curve:'flat',floor:.25,pitch:4,angle:0,duty:.5};
    const knownMatte=new Set(Object.keys(matteDefaults).concat(['bedFps']));
    function checkedMatte(m,label){
      if(!m)return null; Object.keys(m).forEach(k=>{if(!knownMatte.has(k))warn(label+'.'+k);});
      const out=Object.assign({},matteDefaults,C.matte||{},m);
      out.mode=out.mode==='field'?2:out.mode==='screen'?3:1;
      const c=out.curve; out._curve=c==='flat'||c==null?0:c==='bell'?1:Math.max(0,+c||0);
      return out;
    }
    if(C.matte) Object.keys(C.matte).forEach(k=>{if(!knownMatte.has(k))warn('matte.'+k);});
    let mattes=matteDisabled?layers.map(()=>null):layers.map((l,i)=>checkedMatte(l.matte,'layers['+i+'].matte') || checkedMatte(C.matte,'matte'));
    document.documentElement.style.background=document.body.style.background=C.bg;
    let cv=document.querySelector('canvas'); if(!cv){cv=document.createElement('canvas');document.body.appendChild(cv);}
    const gl=cv.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!gl)throw Error('GL requires WebGL2');
    const floatCells=!!gl.getExtension('EXT_color_buffer_float');
    if(!floatCells)console.warn('GL: EXT_color_buffer_float unavailable; temporal state uses RGBA8 buffers.');
    const stateRawProgram=program(gl,VS,STATE_RAW_FS),reduceProgram=program(gl,VS,REDUCE_FS),gmaxProgram=program(gl,VS,GMAX_FS),stateFinalProgram=program(gl,VS,STATE_FINAL_FS),cellProgram=program(gl,VS,CELL_FS),paintProgram=program(gl,VS,PAINT_FS),vao=gl.createVertexArray();
    const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),STATS_SAMPLES=60,TIMER_SLOTS=16;
    const stats={cpuMs:0,fieldMs:0,gpuCellMs:0,gpuPaintMs:0};run.stats=stats;
    const cpuHistory=new Float32Array(STATS_SAMPLES),fieldHistory=new Float32Array(STATS_SAMPLES),cellHistory=new Float32Array(STATS_SAMPLES),paintHistory=new Float32Array(STATS_SAMPLES);
    let cpuAt=0,cpuCount=0,cpuSum=0,fieldAt=0,fieldCount=0,fieldSum=0,cellAt=0,cellCount=0,cellSum=0,paintAt=0,paintCount=0,paintSum=0;
    const timerSlots=timer?new Array(TIMER_SLOTS):null;
    if(timer)for(let i=0;i<TIMER_SLOTS;i++)timerSlots[i]={cell:gl.createQuery(),paint:gl.createQuery(),pending:false};
    let timerRead=0,timerWrite=0,timerPending=0;
    let cols=0,rows=0,adv=0,lineH=0,fs=C.fontSize,dpr=1,W=0,H=0,cellFbo=null,glyphTex=null,bedTex=null,atlasTex=null,rampTex=null,blueTex=null,heightTex=null,stateFbo=null,stateWorkFbo=null,stateWorkTex=null,stateTex=null,stateRead=0,stateWrite=1,gmaxTex=null,gmaxFbo=null,gmaxRead=0,gmaxWrite=1,reduceTex=null,reduceFbo=null,reduceSizes=null;
    const scratch=document.createElement('canvas'),sctx=scratch.getContext('2d');
    const cellLoc={layerCount:gl.getUniformLocation(cellProgram,'uLayerCount'),levels:gl.getUniformLocation(cellProgram,'uLevels'),state:gl.getUniformLocation(cellProgram,'uState'),grid:gl.getUniformLocation(cellProgram,'uGrid'),p3:gl.getUniformLocation(cellProgram,'uP3[0]'),lo:gl.getUniformLocation(cellProgram,'uInkLo[0]'),hi:gl.getUniformLocation(cellProgram,'uInkHi[0]'),los:gl.getUniformLocation(cellProgram,'uInkLoS[0]'),his:gl.getUniformLocation(cellProgram,'uInkHiS[0]'),lift:gl.getUniformLocation(cellProgram,'uEdgeLift[0]'),ramps:gl.getUniformLocation(cellProgram,'uRampLength[0]'),blue:gl.getUniformLocation(cellProgram,'uBlue'),rampMap:gl.getUniformLocation(cellProgram,'uRampMap')};
    function stateLoc(program){return {layer:gl.getUniformLocation(program,'uLayer'),blend:gl.getUniformLocation(program,'uBlend[0]'),grid:gl.getUniformLocation(program,'uGrid'),heightParity:gl.getUniformLocation(program,'uHeightParity[0]'),heights:gl.getUniformLocation(program,'uHeights'),p0:gl.getUniformLocation(program,'uP0[0]'),p1:gl.getUniformLocation(program,'uP1[0]'),p2:gl.getUniformLocation(program,'uP2[0]'),p3:gl.getUniformLocation(program,'uP3[0]'),p4:gl.getUniformLocation(program,'uP4[0]'),temporal:gl.getUniformLocation(program,'uTemporal[0]'),prev:gl.getUniformLocation(program,'uPrevState'),raw:gl.getUniformLocation(program,'uRawState'),gmax:gl.getUniformLocation(program,'uGmax')};}
    const stateRawLoc=stateLoc(stateRawProgram),stateFinalLoc=stateLoc(stateFinalProgram);
    const reduceLoc={input:gl.getUniformLocation(reduceProgram,'uInput'),grid:gl.getUniformLocation(reduceProgram,'uInputGrid'),rows:gl.getUniformLocation(reduceProgram,'uInputRows'),outRows:gl.getUniformLocation(reduceProgram,'uOutputRows'),channel:gl.getUniformLocation(reduceProgram,'uChannel')};
    const gmaxLoc={reduced:gl.getUniformLocation(gmaxProgram,'uReduced'),previous:gl.getUniformLocation(gmaxProgram,'uPrevious')};
    const paintLoc={grid:gl.getUniformLocation(paintProgram,'uGrid'),viewport:gl.getUniformLocation(paintProgram,'uViewport'),cell:gl.getUniformLocation(paintProgram,'uCell'),atlas:gl.getUniformLocation(paintProgram,'uAtlas'),time:gl.getUniformLocation(paintProgram,'uTime'),glyphCount:gl.getUniformLocation(paintProgram,'uGlyphCount'),matteOn:gl.getUniformLocation(paintProgram,'uMatteOn'),glyph:gl.getUniformLocation(paintProgram,'uGlyph'),bed:gl.getUniformLocation(paintProgram,'uBed'),atlasTex:gl.getUniformLocation(paintProgram,'uAtlasTex'),blue:gl.getUniformLocation(paintProgram,'uBlue'),m0:gl.getUniformLocation(paintProgram,'uMatte0[0]'),m1:gl.getUniformLocation(paintProgram,'uMatte1[0]'),m2:gl.getUniformLocation(paintProgram,'uMatte2[0]'),m3:gl.getUniformLocation(paintProgram,'uMatte3[0]'),bg:gl.getUniformLocation(paintProgram,'uBg')};
    const U={p0:new Float32Array(MAX_LAYERS*4),p1:new Float32Array(MAX_LAYERS*4),p2:new Float32Array(MAX_LAYERS*4),p3:new Float32Array(MAX_LAYERS*4),p4:new Float32Array(MAX_LAYERS*4),temporal:new Float32Array(MAX_LAYERS*4),lo:new Float32Array(MAX_LAYERS*4),hi:new Float32Array(MAX_LAYERS*4),los:new Float32Array(MAX_LAYERS*4),his:new Float32Array(MAX_LAYERS*4),blend:new Float32Array(MAX_LAYERS),heightParity:new Int32Array(MAX_LAYERS),lift:new Float32Array(MAX_LAYERS),ramps:new Int32Array(MAX_LAYERS),m0:new Float32Array(MAX_LAYERS*4),m1:new Float32Array(MAX_LAYERS*4),m2:new Float32Array(MAX_LAYERS*4),m3:new Float32Array(MAX_LAYERS*4),bg:new Float32Array(3)};
    const heightArgs={scale:0,dx:0,dy:0,aspect:0};
    function bindTex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
    function bindTexArray(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D_ARRAY,t);}
    function makeBlue(){
      blueTex=texture(gl,gl.R8,gl.RED,gl.UNSIGNED_BYTE); gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,32,32,0,gl.RED,gl.UNSIGNED_BYTE,BN);
    }
    function makeAtlas(){
      const glyphs=[]; function add(ch){if(glyphs.indexOf(ch)<0)glyphs.push(ch);}
      Array.from(C.ramp).forEach(add); C.edgeGlyphs.forEach(add);
      C._glyphs=glyphs;
      const ac=document.createElement('canvas'),cw=Math.ceil(adv*dpr),ch=Math.ceil(lineH*dpr);
      ac.width=cw*glyphs.length;ac.height=ch;const a=ac.getContext('2d');
      a.scale(dpr,dpr);a.font=C.fontWeight+' '+fs+'px '+C.fontFamily;a.textBaseline='top';a.fillStyle='#fff';
      glyphs.forEach((g,i)=>a.fillText(g,i*adv,0));
      atlasTex=texture(gl,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,ac);
      const data=new Uint8Array(32*MAX_LAYERS);
      layers.forEach((l,y)=>{
        const ramp=l.ramp||C.ramp;
        for(let x=0;x<ramp.length&&x<28;x++)data[y*32+x]=glyphs.indexOf(ramp[x]);
        for(let x=0;x<4;x++)data[y*32+ramp.length+x]=glyphs.indexOf(C.edgeGlyphs[x]);
      });
      rampTex=texture(gl,gl.R8,gl.RED,gl.UNSIGNED_BYTE);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,32,MAX_LAYERS,0,gl.RED,gl.UNSIGNED_BYTE,data);
      C._atlas=[cw*glyphs.length,ch];
    }
    function createCellBuffers(){
      glyphTex=texture(gl,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      bedTex=texture(gl,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      cellFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,cellFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,glyphTex,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,bedTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GL cell framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    function createStateBuffers(){
      const internal=floatCells?gl.RGBA16F:gl.RGBA8,type=floatCells?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,h=rows*MAX_LAYERS;
      function allocate(){const t=texture(gl,internal,gl.RGBA,type);gl.texImage2D(gl.TEXTURE_2D,0,internal,cols,h,0,gl.RGBA,type,null);return t;}
      stateTex=[allocate(),allocate()];stateWorkTex=allocate();
      stateFbo=gl.createFramebuffer();stateWorkFbo=gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,stateWorkFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,stateWorkTex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GL temporal state framebuffer incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER,stateFbo);
      for(const t of stateTex){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GL temporal state ping-pong framebuffer incomplete');gl.viewport(0,0,cols,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
      gmaxTex=[texture(gl,internal,gl.RGBA,type),texture(gl,internal,gl.RGBA,type)];gmaxFbo=[gl.createFramebuffer(),gl.createFramebuffer()];
      for(let i=0;i<2;i++){bindTex(0,gmaxTex[i]);gl.texImage2D(gl.TEXTURE_2D,0,internal,1,MAX_LAYERS,0,gl.RGBA,type,null);gl.bindFramebuffer(gl.FRAMEBUFFER,gmaxFbo[i]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gmaxTex[i],0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GL contour maximum framebuffer incomplete');gl.viewport(0,0,1,MAX_LAYERS);gl.clearColor(1,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
      reduceTex=[];reduceFbo=[];reduceSizes=[];
      let rw=cols,rh=rows;
      do{
        rw=Math.max(1,Math.ceil(rw/2));rh=Math.max(1,Math.ceil(rh/2));
        const t=texture(gl,internal,gl.RGBA,type);gl.texImage2D(gl.TEXTURE_2D,0,internal,rw,rh*MAX_LAYERS,0,gl.RGBA,type,null);
        const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GL contour reduction framebuffer incomplete');
        reduceTex.push(t);reduceFbo.push(f);reduceSizes.push([rw,rh]);
      }while(rw>1||rh>1);
      stateRead=0;stateWrite=1;gmaxRead=0;gmaxWrite=1;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    function prepareUniformData(){
      U.p0.fill(0);U.p1.fill(0);U.p2.fill(0);U.p3.fill(0);U.p4.fill(0);U.temporal.fill(0);U.lo.fill(0);U.hi.fill(0);U.los.fill(0);U.his.fill(0);U.blend.fill(0);U.heightParity.fill(0);U.lift.fill(0);U.ramps.fill(0);U.m0.fill(0);U.m1.fill(0);U.m2.fill(0);U.m3.fill(0);
      for(let i=0;i<layers.length;i++){
        const l=layers[i],k=i*4,iv=LIGHT?l.inkLight:l.ink,a=hex(iv[0]),b=hex(iv[1]),as=hexSrgb(iv[0]),bs=hexSrgb(iv[1]),L=l.light,n=Math.hypot(L[0],L[1],L[2]);
        U.p0[k]=l.span;U.p0[k+1]=l.gridSpace?1:0;U.p0[k+2]=l.bump;U.p0[k+3]=l.contrast;
        U.p1[k]=l.amb;U.p1[k+1]=l.hgt;U.p1[k+2]=l.dif;U.p1[k+3]=l.spec;
        U.p2[k]=l.shine;U.p2[k+1]=l.rim;U.p2[k+2]=l.rimPow;U.p2[k+3]=l.gamma;
        U.p3[k]=l.cutoff;U.p3[k+1]=l.dither;U.p3[k+2]=l.edges;U.p3[k+3]=l.edgeBoost;
        U.p4[k]=L[0]/n;U.p4[k+1]=L[1]/n;U.p4[k+2]=L[2]/n;U.p4[k+3]=l.shadedGrid?1:0;
        U.temporal[k]=l.persist;U.temporal[k+1]=l.lineSmooth;U.temporal[k+2]=l.lineHyst;U.temporal[k+3]=l.vote;
        U.lift[i]=l.edgeLift;U.ramps[i]=Math.min(28,(l.ramp||C.ramp).length);
        U.lo[k]=a[0];U.lo[k+1]=a[1];U.lo[k+2]=a[2];U.lo[k+3]=l.srgbBand?1:0;
        U.hi[k]=b[0];U.hi[k+1]=b[1];U.hi[k+2]=b[2];
        U.los[k]=as[0];U.los[k+1]=as[1];U.los[k+2]=as[2];
        U.his[k]=bs[0];U.his[k+1]=bs[1];U.his[k+2]=bs[2];
        const m=mattes[i];if(m){U.m0[k]=m.mode;U.m0[k+1]=m.cell;U.m0[k+2]=m.bed;U.m0[k+3]=m.depth;U.m1[k]=m.bedSteps;U.m1[k+1]=m.amp;U.m1[k+2]=m.contrast;U.m1[k+3]=m.speed;U.m2[k]=m.pitch;U.m2[k+1]=m.angle;U.m2[k+2]=m.duty;U.m3[k]=m._curve;U.m3[k+1]=m.floor;U.m3[k+2]=m.wobble;}
      }
      const bg=hexSrgb(C.bg);U.bg[0]=bg[0];U.bg[1]=bg[1];U.bg[2]=bg[2];
    }
    function configureStateUniforms(program,loc){
      gl.useProgram(program);gl.uniform2i(loc.grid,cols,rows);gl.uniform1fv(loc.blend,U.blend);gl.uniform1iv(loc.heightParity,U.heightParity);gl.uniform4fv(loc.p0,U.p0);gl.uniform4fv(loc.p1,U.p1);gl.uniform4fv(loc.p2,U.p2);gl.uniform4fv(loc.p3,U.p3);gl.uniform4fv(loc.p4,U.p4);gl.uniform4fv(loc.temporal,U.temporal);bindTexArray(HEIGHT_TEXTURE_UNIT,heightTex);gl.uniform1i(loc.heights,HEIGHT_TEXTURE_UNIT);
    }
    function configureStaticUniforms(){
      gl.useProgram(cellProgram);gl.uniform1i(cellLoc.layerCount,layers.length);gl.uniform1f(cellLoc.levels,C.levels);
      gl.uniform4fv(cellLoc.p3,U.p3);gl.uniform4fv(cellLoc.lo,U.lo);gl.uniform4fv(cellLoc.hi,U.hi);gl.uniform4fv(cellLoc.los,U.los);gl.uniform4fv(cellLoc.his,U.his);gl.uniform1fv(cellLoc.lift,U.lift);gl.uniform1iv(cellLoc.ramps,U.ramps);bindTex(4,blueTex);bindTex(5,rampTex);gl.uniform1i(cellLoc.blue,4);gl.uniform1i(cellLoc.rampMap,5);gl.uniform1i(cellLoc.state,7);
      configureStateUniforms(stateRawProgram,stateRawLoc);configureStateUniforms(stateFinalProgram,stateFinalLoc);
      gl.useProgram(paintProgram);gl.uniform1i(paintLoc.glyphCount,C._glyphs.length);gl.uniform1i(paintLoc.matteOn,mattes.some(Boolean)?1:0);gl.uniform3fv(paintLoc.bg,U.bg);gl.uniform4fv(paintLoc.m0,U.m0);gl.uniform4fv(paintLoc.m1,U.m1);gl.uniform4fv(paintLoc.m2,U.m2);gl.uniform4fv(paintLoc.m3,U.m3);
      bindTex(0,glyphTex);bindTex(1,bedTex);bindTex(2,atlasTex);bindTex(3,blueTex);gl.uniform1i(paintLoc.glyph,0);gl.uniform1i(paintLoc.bed,1);gl.uniform1i(paintLoc.atlasTex,2);gl.uniform1i(paintLoc.blue,3);
    }
    function configureSizeUniforms(){
      gl.useProgram(cellProgram);gl.uniform2i(cellLoc.grid,cols,rows);
      gl.useProgram(stateRawProgram);gl.uniform2i(stateRawLoc.grid,cols,rows);
      gl.useProgram(stateFinalProgram);gl.uniform2i(stateFinalLoc.grid,cols,rows);
      gl.useProgram(paintProgram);gl.uniform2i(paintLoc.grid,cols,rows);gl.uniform2f(paintLoc.viewport,cv.width,cv.height);gl.uniform2f(paintLoc.cell,adv*dpr,lineH*dpr);gl.uniform2f(paintLoc.atlas,C._atlas[0],C._atlas[1]);
    }
    function refreshMattes(){
      mattes=matteDisabled?layers.map(()=>null):layers.map((l,i)=>checkedMatte(l.matte,'layers['+i+'].matte') || checkedMatte(C.matte,'matte'));
      prepareUniformData();configureStaticUniforms();
    }
    function buildUI(){
      if(C.ui===false||window.self!==window.top||(!C.matte&&!C.matteDefault))return;
      if(C.matte)C.matte=Object.assign({},matteDefaults,C.matte);
      const M=()=>C.matte||(C.matte=Object.assign({},matteDefaults,C.matteDefault||{}));
      const bar=document.createElement('div');
      bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:9px 14px;font:300 11px/1.4 "Geist Mono",ui-monospace,monospace;letter-spacing:1px;color:#9a9a9a;'+(LIGHT?'background:rgba(251,251,251,.88);border-bottom:1px solid #e2e2e2;color:#4a4a4a;':'background:rgba(8,8,8,.86);border-bottom:1px solid #202020;')+'-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);user-select:none;';
      const gf=document.createElement('link');gf.rel='stylesheet';gf.href='https://fonts.googleapis.com/css2?family=Geist+Pixel&display=swap';document.head.appendChild(gf);
      const brand=document.createElement('a');brand.href='/';brand.textContent='asciara';brand.title='home';brand.style.cssText="font-family:'Geist Pixel','Geist Mono',ui-monospace,monospace;font-size:17px;letter-spacing:2px;color:"+(LIGHT?'#101010':'#f2f2f2')+';text-decoration:none;line-height:1;';bar.appendChild(brand);
      const gal=document.createElement('a');gal.href='/gallery.html';gal.textContent='gallery';gal.style.cssText='padding:4px 11px;border:1px solid '+(LIGHT?'#d0d0d0':'#2a2a2a')+';text-decoration:none;color:'+(LIGHT?'#4a4a4a':'#a8a8a8')+';cursor:pointer;';bar.appendChild(gal);
      const pick=document.createElement('select');pick.style.cssText='font:300 11px/1.4 "Geist Mono",ui-monospace,monospace;letter-spacing:1px;padding:4px 8px;border:1px solid '+(LIGHT?'#d0d0d0':'#2a2a2a')+';background:transparent;color:'+(LIGHT?'#303030':'#c8c8c8')+';cursor:pointer;outline:none;min-width:112px;';
      const here=location.pathname;
      for(const [group,items] of CATALOGUE){const og=document.createElement('optgroup');og.label=group;for(const [name,href] of items){const o=document.createElement('option');o.value=href;o.textContent=name;if(href===here)o.selected=true;og.appendChild(o);}pick.appendChild(og);}
      pick.onchange=()=>{const u=new URL(pick.value,location.origin);u.search=location.search;location.href=u.toString();};bar.appendChild(pick);
      const modes=document.createElement('span'),btns={};modes.style.cssText='display:flex;gap:0;';
      for(const m of ['off','field','noise','screen']){const b=document.createElement('a');b.textContent=m;b.href='#';b.style.cssText='padding:4px 11px;border:1px solid #2a2a2a;margin-left:-1px;text-decoration:none;color:#a8a8a8;cursor:pointer;';b.onclick=e=>{e.preventDefault();setMode(m);};btns[m]=b;modes.appendChild(b);}bar.appendChild(modes);
      const controls={};
      function slider(key,label,min,max,step){const wrap=document.createElement('label');wrap.style.cssText='display:flex;align-items:center;gap:7px;flex:0 0 auto;';const nm=document.createElement('span');nm.textContent=label;const inp=document.createElement('input');inp.type='range';inp.min=min;inp.max=max;inp.step=step;inp.style.cssText='width:clamp(56px,10vw,92px);accent-color:#8a8a8a;background:transparent;';const out=document.createElement('span');out.style.cssText='color:#e0e0e0;min-width:30px;text-align:right;';inp.oninput=()=>{M()[key]=+inp.value;out.textContent=inp.value;refreshMattes();sync(false);};wrap.append(nm,inp,out);bar.appendChild(wrap);controls[key]={wrap,inp,out};}
      slider('cell','cell',1,10,1);slider('amp','amp',0,140,2);slider('bed','bed',0,1,.02);slider('bedSteps','steps',2,20,1);slider('depth','depth',0,1,.02);slider('contrast','contr',0,1,.02);slider('speed','speed',0,.5,.01);slider('wobble','wob',0,1,.02);slider('floor','floor',0,1,.02);slider('pitch','pitch',1,16,1);slider('angle','angle',0,180,1);slider('duty','duty',0,1,.02);
      const spacer=document.createElement('span');spacer.style.cssText='flex:1 1 0;min-width:0;';bar.appendChild(spacer);
      const lightBtn=document.createElement('a');lightBtn.href='#';lightBtn.textContent=LIGHT?'dark':'light';lightBtn.title='switch the piece between dark and light mode';lightBtn.style.cssText='padding:4px 11px;border:1px solid #2a2a2a;text-decoration:none;color:#a8a8a8;cursor:pointer;';lightBtn.onclick=e=>{e.preventDefault();const u=new URL(location.href);if(LIGHT)u.searchParams.delete('light');else u.searchParams.set('light','');location.href=u.toString();};bar.appendChild(lightBtn);
      const copy=document.createElement('a');copy.href='#';copy.textContent='copy config';copy.style.cssText='padding:4px 11px;border:1px solid #2a2a2a;text-decoration:none;color:#a8a8a8;cursor:pointer;';copy.onclick=e=>{e.preventDefault();const m=M(),curve=typeof m.curve==='number'?m.curve:"'"+m.curve+"'";const line="matte: { mode: '"+m.mode+"', cell: "+m.cell+', depth: '+(+m.depth).toFixed(2)+', bed: '+(+m.bed).toFixed(2)+', bedSteps: '+m.bedSteps+', amp: '+m.amp+', contrast: '+(+m.contrast).toFixed(2)+', speed: '+(+m.speed).toFixed(2)+', wobble: '+(+m.wobble).toFixed(2)+', curve: '+curve+', floor: '+(+m.floor).toFixed(2)+(m.mode==='screen'?', pitch: '+m.pitch+', angle: '+m.angle+', duty: '+(+m.duty).toFixed(2):'')+' }';(navigator.clipboard?navigator.clipboard.writeText(line):Promise.reject()).then(()=>{copy.textContent='copied';setTimeout(()=>copy.textContent='copy config',1100);},()=>{copy.textContent=line;});};bar.appendChild(copy);
      const hide=document.createElement('a');hide.href='#';hide.textContent='hide';hide.style.cssText=copy.style.cssText;hide.onclick=e=>{e.preventDefault();bar.style.display='none';};bar.appendChild(hide);document.body.appendChild(bar);
      function setMode(m){if(m==='off'){C.matte=null;matteDisabled=true;}else{matteDisabled=false;M().mode=m;}refreshMattes();sync(true);}
      function sync(full){const on=!!C.matte,m=C.matte||{};for(const k of ['off','field','noise','screen']){const active=on?m.mode===k:k==='off';btns[k].style.color=active?'#ffffff':'#a8a8a8';btns[k].style.borderColor=active?'#5a5a5a':'#2a2a2a';btns[k].style.background=active?'#141414':'transparent';}controls.amp.wrap.style.display=on&&m.mode==='noise'?'flex':'none';controls.contrast.wrap.style.display=on&&m.mode==='noise'?'flex':'none';controls.speed.wrap.style.display=on&&m.mode==='noise'?'flex':'none';controls.wobble.wrap.style.display=on&&m.mode==='noise'?'flex':'none';controls.bed.wrap.style.display=on&&(m.mode==='field'||m.mode==='screen')?'flex':'none';controls.depth.wrap.style.display=on&&(m.mode==='field'||m.mode==='screen')?'flex':'none';controls.floor.wrap.style.display=on&&m.curve!=='flat'?'flex':'none';controls.pitch.wrap.style.display=on&&m.mode==='screen'?'flex':'none';controls.angle.wrap.style.display=on&&m.mode==='screen'?'flex':'none';controls.duty.wrap.style.display=on&&m.mode==='screen'?'flex':'none';controls.cell.wrap.style.display=on?'flex':'none';controls.bedSteps.wrap.style.display=on?'flex':'none';if(full&&on)for(const k of ['cell','amp','bed','bedSteps','depth','contrast','speed','wobble','floor','pitch','angle','duty']){controls[k].inp.value=m[k];controls[k].out.textContent=m[k];}const u=new URL(location.href);u.searchParams.set('matte',on?m.mode:'off');for(const [q,k] of [['cell','cell'],['amp','amp'],['bed','bed'],['steps','bedSteps'],['contr','contrast'],['speed','speed'],['wob','wobble'],['depth','depth'],['floor','floor'],['pitch','pitch'],['angle','angle'],['duty','duty']])if(on)u.searchParams.set(q,m[k]);else u.searchParams.delete(q);if(on)u.searchParams.set('curve',m.curve);else u.searchParams.delete('curve');history.replaceState(null,'',u);try{localStorage.setItem('asciara-matte',JSON.stringify(C.matte));}catch(e){}}
      sync(true);
    }
    function fit(){
      dpr=window.devicePixelRatio||1;W=window.innerWidth;H=window.innerHeight;cv.style.width=W+'px';cv.style.height=H+'px';cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
      fs=C.fontSize;
      for(;;){sctx.font=C.fontWeight+' '+fs+'px '+C.fontFamily;adv=sctx.measureText('M').width+C.pad;lineH=fs*1.06+C.pad;cols=Math.ceil(W/adv);rows=Math.ceil(H/lineH)+1;if(cols*rows<=C.maxCells||fs>=C.maxFontSize)break;fs++;}
      heightArgs.aspect=adv/lineH;
      heightTex=textureArray(gl,gl.R32F,gl.RED,gl.FLOAT);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.R32F,cols,rows,2*MAX_LAYERS,0,gl.RED,gl.FLOAT,null);
      for(let i=0;i<layers.length;i++){const l=layers[i];l._H=new Float32Array(cols*rows);l._heightParity=1;l._fieldAt=-Infinity;U.heightParity[i]=1;if(l.resize)l.resize(cols,rows);}
      fieldInitialized=false;lastRenderTime=-Infinity;lastStateTime=-Infinity;
      if(C.resize)C.resize(cols,rows);createCellBuffers();createStateBuffers();makeAtlas();if(!blueTex)makeBlue();prepareUniformData();configureStaticUniforms();configureSizeUniforms();
    }
    function addCpu(ms){cpuSum+=ms-cpuHistory[cpuAt];cpuHistory[cpuAt]=ms;cpuAt=(cpuAt+1)%STATS_SAMPLES;if(cpuCount<STATS_SAMPLES)cpuCount++;stats.cpuMs=cpuSum/cpuCount;}
    function addField(ms){fieldSum+=ms-fieldHistory[fieldAt];fieldHistory[fieldAt]=ms;fieldAt=(fieldAt+1)%STATS_SAMPLES;if(fieldCount<STATS_SAMPLES)fieldCount++;stats.fieldMs=fieldSum/fieldCount;}
    function addCell(ms){cellSum+=ms-cellHistory[cellAt];cellHistory[cellAt]=ms;cellAt=(cellAt+1)%STATS_SAMPLES;if(cellCount<STATS_SAMPLES)cellCount++;stats.gpuCellMs=cellSum/cellCount;}
    function addPaint(ms){paintSum+=ms-paintHistory[paintAt];paintHistory[paintAt]=ms;paintAt=(paintAt+1)%STATS_SAMPLES;if(paintCount<STATS_SAMPLES)paintCount++;stats.gpuPaintMs=paintSum/paintCount;}
    function pollTimers(){
      while(timer&&timerPending){
        const slot=timerSlots[timerRead];
        if(!gl.getQueryParameter(slot.cell,gl.QUERY_RESULT_AVAILABLE)||!gl.getQueryParameter(slot.paint,gl.QUERY_RESULT_AVAILABLE))break;
        if(!gl.getParameter(timer.GPU_DISJOINT_EXT)){addCell(gl.getQueryParameter(slot.cell,gl.QUERY_RESULT)/1000000);addPaint(gl.getQueryParameter(slot.paint,gl.QUERY_RESULT)/1000000);}
        slot.pending=false;timerRead=(timerRead+1)%TIMER_SLOTS;timerPending--;
      }
    }
    let lastRenderTime=-Infinity,lastStateTime=-Infinity,fieldInitialized=false;
    function updateHeight(i,t,initializing){
      const l=layers[i];
      if(!initializing)l._heightParity=1-l._heightParity;
      const Hf=l._H,scale=l.span/cols,dx=l.drift[0]*l.driftSpeed*t+.4*Math.cos(t*l.evolve),dy=l.drift[1]*l.driftSpeed*t+.4*Math.sin(t*l.evolve);
      if(l.shadedGrid)l.shadedGrid(Hf,cols,rows,t);
      else if(l.heightGrid){heightArgs.scale=scale;heightArgs.dx=dx;heightArgs.dy=dy;l.heightGrid(Hf,cols,rows,t,heightArgs);}
      else for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)Hf[y*cols+x]=l.height(x*scale+dx,y*scale*l.aspect+dy,t);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i*2+l._heightParity,cols,rows,1,gl.RED,gl.FLOAT,Hf);
      if(initializing)gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i*2+1-l._heightParity,cols,rows,1,gl.RED,gl.FLOAT,Hf);
      l._fieldAt=t;U.heightParity[i]=l._heightParity;
    }
    function initializeHeights(t){
      bindTexArray(HEIGHT_TEXTURE_UNIT,heightTex);
      for(let i=0;i<layers.length;i++){const l=layers[i];updateHeight(i,t,true);l._fieldAt=fieldFps?t-i/(layers.length*fieldFps):t;}
      fieldInitialized=true;return layers.length;
    }
    function updateAllHeights(t){
      bindTexArray(HEIGHT_TEXTURE_UNIT,heightTex);
      for(let i=0;i<layers.length;i++)updateHeight(i,t,false);
      return layers.length;
    }
    function updateDueHeights(t,maxUpdates){
      let updates=0;
      for(;updates<maxUpdates;updates++){
        let oldest=Infinity,target=-1;
        for(let i=0;i<layers.length;i++){const l=layers[i];if(t-l._fieldAt>=fieldPeriod&&l._fieldAt<oldest){oldest=l._fieldAt;target=i;}}
        if(target<0)break;
        if(updates===0)bindTexArray(HEIGHT_TEXTURE_UNIT,heightTex);
        updateHeight(target,t,false);
      }
      return updates;
    }
    function renderTemporalState(){
      gl.useProgram(stateRawProgram);gl.uniform1fv(stateRawLoc.blend,U.blend);gl.uniform1iv(stateRawLoc.heightParity,U.heightParity);bindTex(7,stateTex[stateRead]);gl.uniform1i(stateRawLoc.prev,7);
      gl.bindFramebuffer(gl.FRAMEBUFFER,stateWorkFbo);gl.viewport(0,0,cols,rows*MAX_LAYERS);
      for(let i=0;i<layers.length;i++){gl.viewport(0,i*rows,cols,rows);gl.uniform1i(stateRawLoc.layer,i);gl.drawArrays(gl.TRIANGLES,0,3);}

      let input=stateWorkTex,inputW=cols,inputRows=rows,channel=1;
      gl.useProgram(reduceProgram);gl.uniform1i(reduceLoc.input,7);
      for(let i=0;i<reduceTex.length;i++){
        const out=reduceSizes[i];bindTex(7,input);gl.bindFramebuffer(gl.FRAMEBUFFER,reduceFbo[i]);gl.viewport(0,0,out[0],out[1]*MAX_LAYERS);gl.uniform2i(reduceLoc.grid,inputW,inputRows);gl.uniform1i(reduceLoc.rows,inputRows);gl.uniform1i(reduceLoc.outRows,out[1]);gl.uniform1i(reduceLoc.channel,channel);gl.drawArrays(gl.TRIANGLES,0,3);input=reduceTex[i];inputW=out[0];inputRows=out[1];channel=0;
      }

      gl.useProgram(gmaxProgram);bindTex(7,input);bindTex(8,gmaxTex[gmaxRead]);gl.uniform1i(gmaxLoc.reduced,7);gl.uniform1i(gmaxLoc.previous,8);gl.bindFramebuffer(gl.FRAMEBUFFER,gmaxFbo[gmaxWrite]);gl.viewport(0,0,1,MAX_LAYERS);gl.drawArrays(gl.TRIANGLES,0,3);

      gl.useProgram(stateFinalProgram);gl.uniform1fv(stateFinalLoc.blend,U.blend);gl.uniform1iv(stateFinalLoc.heightParity,U.heightParity);bindTex(7,stateWorkTex);bindTex(8,stateTex[stateRead]);bindTex(9,gmaxTex[gmaxWrite]);gl.uniform1i(stateFinalLoc.raw,7);gl.uniform1i(stateFinalLoc.prev,8);gl.uniform1i(stateFinalLoc.gmax,9);
      gl.bindFramebuffer(gl.FRAMEBUFFER,stateFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,stateTex[stateWrite],0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      for(let i=0;i<layers.length;i++){gl.viewport(0,i*rows,cols,rows);gl.uniform1i(stateFinalLoc.layer,i);gl.drawArrays(gl.TRIANGLES,0,3);}
      [stateRead,stateWrite]=[stateWrite,stateRead];[gmaxRead,gmaxWrite]=[gmaxWrite,gmaxRead];

      gl.useProgram(cellProgram);bindTex(7,stateTex[stateRead]);gl.bindFramebuffer(gl.FRAMEBUFFER,cellFbo);gl.viewport(0,0,cols,rows);gl.drawArrays(gl.TRIANGLES,0,3);
    }
    function draw(t){
      const started=performance.now();pollTimers();
      const renderRate=lastRenderTime===-Infinity?0:1/(t-lastRenderTime),updateEveryFrame=!fieldFps||(renderRate>0&&fieldFps>=renderRate),wasInitialized=fieldInitialized;
      let updates=0,fieldStarted=0;
      if(!fieldInitialized){fieldStarted=performance.now();updates=initializeHeights(t);}
      else if(updateEveryFrame){fieldStarted=performance.now();updates=updateAllHeights(t);}
      else{fieldStarted=performance.now();updates=updateDueHeights(t,Math.min(layers.length,Math.max(1,Math.ceil(layers.length*fieldFps/60))));}
      if(updates)addField(performance.now()-fieldStarted);else stats.fieldMs=0;
      for(let i=0;i<layers.length;i++){const l=layers[i],blend=!wasInitialized||updateEveryFrame?1:clamp((t-l._fieldAt)*fieldFps,0,1);U.blend[i]=blend;}
      gl.bindVertexArray(vao);gl.disable(gl.BLEND);
      const stateDue=lastStateTime===-Infinity||!fieldFps||t-lastStateTime>=fieldPeriod;
      let slot=null;if(stateDue&&timer&&timerPending<TIMER_SLOTS){slot=timerSlots[timerWrite];if(!slot.pending)gl.beginQuery(timer.TIME_ELAPSED_EXT,slot.cell);else slot=null;}
      if(stateDue){renderTemporalState();lastStateTime=t;}if(slot)gl.endQuery(timer.TIME_ELAPSED_EXT);
      gl.useProgram(paintProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);gl.uniform1f(paintLoc.time,t);if(slot)gl.beginQuery(timer.TIME_ELAPSED_EXT,slot.paint);gl.drawArrays(gl.TRIANGLES,0,3);if(slot){gl.endQuery(timer.TIME_ELAPSED_EXT);slot.pending=true;timerWrite=(timerWrite+1)%TIMER_SLOTS;timerPending++;}
      lastRenderTime=t;addCpu(performance.now()-started);
    }
    window.addEventListener('resize',fit);fit();
    if(document.fonts){const probe=C.fontWeight+' '+C.fontSize+'px '+C.fontFamily;try{document.fonts.load(probe).then(fit);}catch(e){}if(document.fonts.ready)document.fonts.ready.then(fit);}
    function loop(now){draw(now/1000);requestAnimationFrame(loop);}requestAnimationFrame(loop);
    buildUI();
  }
  window.GL=run;
  window.NX=window.GL;
  run.noise=noise;run.fbm=fbm;run.warp=warp;run.hash=hash;run.smoothstep=smoothstep;run.mix=mix;run.sdTriangle=sdTriangle;run.LIGHT=LIGHT;
})();
