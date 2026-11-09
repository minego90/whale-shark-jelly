const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.06),S=w.S,p=w.pos,n=w.nv;
const fwd=()=>{let h=[0,0,0],t=[0,0,0],a=0,b=0;for(let v=0;v<n;v++){const x=w.L.rest[3*v];if(x<0.4){h[0]+=p[3*v];h[1]+=p[3*v+1];h[2]+=p[3*v+2];a++;}else if(x>2.45){t[0]+=p[3*v];t[1]+=p[3*v+1];t[2]+=p[3*v+2];b++;}}const x=h[0]/a-t[0]/b,y=h[1]/a-t[1]/b,z=h[2]/a-t[2]/b;return y/Math.hypot(x,y,z);};
const cy=()=>{let s=0;for(let i=0;i<n;i++)s+=p[3*i+1];return s/n;};
const o=[];let ms=0;
for(let t=0;t<30*60;t++){S.g+=(0.03-S.g)*0.04;S.drag+=(0.9-S.drag)*0.04;S.swim=Math.min(1,S.swim+1/60);
 if(t==10*60) S.swimH=1.6; if(t==20*60) S.swimH=0.7;
 const t0=Date.now(); w.step(1/60); ms+=Date.now()-t0; if(t%90==0)o.push(cy().toFixed(2)+'/'+fwd().toFixed(2));}
console.log(o.join(' ')); console.log('ms',ms/1800);
