const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06); const J=M.createJellies(w);
// closed-mesh check
const T=J.tri, ec=new Map(); const nT=J.tris;
for(let t=0;t<nT;t++){ const a=T[3*t],b=T[3*t+1],c=T[3*t+2]; for(const [x,y] of [[a,b],[b,c],[c,a]]){ const k=x+','+y; ec.set(k,(ec.get(k)||0)+1);} }
let open=0,dup=0; for(const [k,v] of ec){ const [x,y]=k.split(','); if(v>1)dup++; if(!ec.has(y+','+x)) open++; }
console.log('verts/jelly',J.nv/J.n,'tris',nT,'open edges',open,'dup dir edges',dup,'vol ratio',J.volumeRatio().map(x=>x.toFixed(3)).join(' '));
let nan=0;
const run=(sec,label)=>{ for(let i=0;i<sec*60;i++){ w.step(1/60); J.step(1/60);} const c=J.centres(); let bad=0; for(let i=0;i<J.pos.length;i++) if(!isFinite(J.pos[i])) bad++;
 console.log(label,'centres',c.map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' | '),'vol',J.volumeRatio().map(x=>x.toFixed(2)).join(' '),'nan',bad); };
run(3,'limp 3s');
J.setSwim(true);
let t0=Date.now(); run(10,'swim 10s'); console.log('ms/frame',((Date.now()-t0)/600).toFixed(2));
run(20,'swim 30s'); run(30,'swim 60s');
let mn=9; for(let i=0;i<600;i++){ w.step(1/60); J.step(1/60); const c=J.centres(); for(let a=0;a<3;a++)for(let b=a+1;b<3;b++) mn=Math.min(mn,Math.hypot(c[a][0]-c[b][0],c[a][1]-c[b][1],c[a][2]-c[b][2])); }
console.log('min pair dist',mn.toFixed(2)); console.log('inst',J.fill());
