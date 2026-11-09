const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.06);const S=w.S;S.nsub=3;
for(let i=0;i<40;i++)w.step(1/60);
S.g=0.03;S.drag=0.9;
const mode=process.argv[2]||'float';
if(mode==='swim'){S.swim=1;S.swimMix=1;S.swish=1;}
// flip the body 150 deg about its long axis and pitch 40 deg
const pos=w.pos,nv=w.nv;let cx=0,cy=0,cz=0;for(let i=0;i<nv;i++){cx+=pos[3*i];cy+=pos[3*i+1];cz+=pos[3*i+2];}cx/=nv;cy=cy/nv+0.8;cz/=nv;
const rot=(ax,ang)=>{const c=Math.cos(ang),s=Math.sin(ang);for(let i=0;i<nv;i++){let x=pos[3*i]-cx,y=pos[3*i+1]-cy,z=pos[3*i+2]-cz;
 if(ax==='x'){const y2=y*c-z*s,z2=y*s+z*c;y=y2;z=z2;}else{const z2=z*c-y*s,y2=z*s+y*c; /* about z */ const x2=x*c-y*s;y=x*s+y*c;x=x2;}
 pos[3*i]=x+cx;pos[3*i+1]=y+cy;pos[3*i+2]=z+cz;}};
rot('x',2.6);rot('z',0.7);
const upv=()=>{let d=[0,0,0],v=[0,0,0],nd=0,nv_=0;const R=w.L.rest;for(let i=0;i<nv;i++){const x=R[3*i],y=R[3*i+1];if(x>0.4&&x<1.7){if(y>0.2){d[0]+=pos[3*i];d[1]+=pos[3*i+1];d[2]+=pos[3*i+2];nd++;}else if(y<0.05){v[0]+=pos[3*i];v[1]+=pos[3*i+1];v[2]+=pos[3*i+2];nv_++;}}}
 return (d[1]/nd-v[1]/nv_)/Math.hypot(d[0]/nd-v[0]/nv_,d[1]/nd-v[1]/nv_,d[2]/nd-v[2]/nv_);};
for(let f=0;f<60*12;f++){S.swishPhase+=1/60*5.6;w.step(1/60);if(f%60==0)console.log(mode,(f/60)+'s upness',upv().toFixed(2));}
let bad=0;for(let i=0;i<pos.length;i++)if(!isFinite(pos[i]))bad++;console.log('nan',bad);
