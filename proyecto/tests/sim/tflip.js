const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
function test(mode,ang){
 const w=M.createWorld(0.06), p=w.pos, n=w.nv, S=w.S;
 let cy=0,cz=0; for(let i=0;i<n;i++){cy+=p[3*i+1];cz+=p[3*i+2];} cy/=n;cz/=n;
 const c=Math.cos(ang),s=Math.sin(ang); for(let i=0;i<n;i++){const y=p[3*i+1]-cy,z=p[3*i+2]-cz; p[3*i+1]=cy+0.35+y*c-z*s; p[3*i+2]=cz+y*s+z*c;}
 const up=()=>{ // use lattice rest y>0.2 vs <0.05 like upright
   let a=[0,0,0],b=[0,0,0],na=0,nb=0; for(let v=0;v<n;v++){const x=w.L.rest[3*v],y=w.L.rest[3*v+1]; if(x>0.4&&x<1.7){ if(y>0.56){a[0]+=p[3*v];a[1]+=p[3*v+1];a[2]+=p[3*v+2];na++;} else if(y<0.38){b[0]+=p[3*v];b[1]+=p[3*v+1];b[2]+=p[3*v+2];nb++;}}}
   const x=a[0]/na-b[0]/nb,y=a[1]/na-b[1]/nb,z=a[2]/na-b[2]/nb; return y/Math.hypot(x,y,z);};
 const out=[];
 for(let t=0;t<12*60;t++){
  if(mode!=='floor'){S.g+=(0.03-S.g)*0.04;S.drag+=(0.9-S.drag)*0.04;}
  if(mode==='swim') S.swim=Math.min(1,S.swim+1/60);
  w.step(1/60); if(t%120==0) out.push(up().toFixed(2));
 }
 let bad=0; for(const v of p) if(!isFinite(v)) bad++;
 console.log(mode,ang.toFixed(2),'up over time:',out.join(' '),'nan',bad);
}
for(const m of ['floor','ocean','swim']) for(const a of [Math.PI,1.6]) test(m,a);
