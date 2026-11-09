const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
for (const c of [0.05,0.06]) {
  let t=Date.now(); const w=M.createWorld(c); const dt=Date.now()-t;
  w.skin(); const R=w.R,B=w.B;
  // rest fidelity
  let mx=0; for(let i=0;i<R.nv*3;i++) mx=Math.max(mx,Math.abs(R.pos[i]-R.rest[i]));
  let bad=0; for(let i=0;i<R.nv;i++){ if(!isFinite(R.nrm[3*i])) bad++; }
  console.log('cell',c,'build ms',dt,'lattice nv',w.nv,'render nv',R.nv,'tris',R.tri.length/3,'blob nv',B.nv,'tris',B.tri.length/3,'max rest err',mx.toFixed(4),'badnrm',bad);
  let t2=Date.now(); for(let i=0;i<50;i++){w.skin();} console.log(' skin+normals ms/frame',((Date.now()-t2)/50).toFixed(2));
}
