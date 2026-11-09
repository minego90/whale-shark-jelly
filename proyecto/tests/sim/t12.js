const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.06);const S=w.S;S.nsub=3;
for(let i=0;i<40;i++)w.step(1/60);
S.g=0.03;S.drag=0.9;S.swim=1;S.swimMix=1;S.swish=1;
const pos=w.pos,nv=w.nv;
const cen=()=>{let x=0,y=0,z=0;for(let i=0;i<nv;i++){x+=pos[3*i];y+=pos[3*i+1];z+=pos[3*i+2];}return [x/nv,y/nv,z/nv];};
const c0=cen();console.log('start',c0.map(v=>v.toFixed(2)));
let maxd=0,t0=performance.now();
for(let f=0;f<60*40;f++){S.swishPhase+=1/60*2*Math.PI*0.9;w.step(1/60);
 if(f%300==0){const c=cen();const dx=c[0]-c0[0],dz=c[2]-c0[2];maxd=Math.max(maxd,Math.hypot(dx,dz));
 // head/tail dir, bend measure: centroid offset from chord mid
 let hx=0,hz=0,tx=0,tz=0,nh=0,nt=0;for(let v=0;v<nv;v++){const x=w.L.rest[3*v];if(x<0.4){hx+=pos[3*v];hz+=pos[3*v+2];nh++;}else if(x>2.45){tx+=pos[3*v];tz+=pos[3*v+2];nt++;}}
 hx/=nh;hz/=nh;tx/=nt;tz/=nt;const fx=hx-tx,fz=hz-tz,fl=Math.hypot(fx,fz);const mx=(hx+tx)/2,mz=(hz+tz)/2;
 const off=[c[0]-mx,c[2]-mz];const leftx=fz/fl,leftz=-fx/fl; const offLeft=off[0]*leftx+off[1]*leftz;
 console.log((f/60).toFixed(0)+'s c',c.map(v=>v.toFixed(2)).join(','),'heading',(Math.atan2(fz,fx)*57.3).toFixed(0),'offLeft',offLeft.toFixed(3),'bend',S.bend.toFixed(3));}}
console.log('maxdist from start',maxd.toFixed(2),'ms/frame',((performance.now()-t0)/2400).toFixed(1));
let bad=0;for(let i=0;i<pos.length;i++)if(!isFinite(pos[i]))bad++;console.log('nan',bad);
