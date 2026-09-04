/* field.js — shade a height grid into a 0..1 brightness buffer via surface normals (the billow lighting),
   so each background concept only has to define its MOTION (the height field), not the lighting.
   Usage:  litShade(H, buf, cols, rows, { light:[x,y,z], bump, contrast, amb, hgt, dif }) */
(function () {
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
})();
