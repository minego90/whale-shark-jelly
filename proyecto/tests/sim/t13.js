const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createKrill};')();
const w=M.createWorld(0.06);const S=w.S;S.nsub=3;const K=M.createKrill(w);
for(let i=0;i<40;i++)w.step(1/60);
const sm=(a,b,x)=>{const t=Math.min(Math.max((x-a)/(b-a),0),1);return t*t*(3-2*t);};
const cen=()=>{let x=0,y=0,z=0;for(let i=0;i<w.nv;i++){x+=w.pos[3*i];y+=w.pos[3*i+1];z+=w.pos[3*i+2];}return [x/w.nv,y/w.nv,z/w.nv];};
S.g=0.03;S.drag=0.9;S.swim=1;S.swimMix=1;S.swish=1;K.gs=0.02;K.dr=1.1;
const c0=cen();K.spawn(110,c0);let gT=-1,cool=0;let t0=performance.now();
for(let f=0;f<60*70;f++){const dt=1/60;
 S.swishPhase+=dt*2*Math.PI*0.9;K.level=S.swimH;
 S.hunt=null;
 if(K.n){const mf=w.mouthFrame(),nr=K.nearest(mf.f[0],mf.f[1],mf.f[2],3.2);if(nr){const k=nr.k;S.hunt=[K.p[3*k],K.p[3*k+1],K.p[3*k+2]];
  const out=-((K.p[3*k]-mf.f[0])*mf.e[0]+(K.p[3*k+1]-mf.f[1])*mf.e[1]+(K.p[3*k+2]-mf.f[2])*mf.e[2]);cool-=dt;if(gT<0&&nr.d<0.95&&out>0.02&&cool<=0){gT=0;cool=1;}}}
 let jaw=0,steer=0;if(gT>=0){const t=gT;jaw=sm(0,0.55,t)*(1-sm(1.05,1.5,t));steer=sm(0.1,0.5,t)*(1-sm(1.4,1.9,t));gT+=dt;if(gT>2.5)gT=-1;}
 S.jaw=jaw;w.step(dt);K.step(dt,steer);
 if(f>1200&&f<3000&&f%90==0){const mf=w.mouthFrame();const nr=K.nearest(mf.f[0],mf.f[1],mf.f[2],9);console.log((f/60).toFixed(0),'mouth',mf.f.map(v=>v.toFixed(2)).join(','),'nearest d',nr?nr.d.toFixed(2):'-','hunt',S.hunt?S.hunt.map(v=>v.toFixed(2)).join(','):'-','jaw',S.jaw.toFixed(2),'gT',gT.toFixed(1));}
 if(f%600==0){const c=cen();console.log((f/60).toFixed(0)+'s eaten',K.eaten,'left',K.n,'c',c.map(v=>v.toFixed(2)).join(','),'hunt',S.hunt?S.hunt.map(v=>v.toFixed(2)).join(','):'-');}}
console.log('ms/frame',((performance.now()-t0)/4200).toFixed(1));
