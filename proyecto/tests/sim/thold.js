const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);J.setSwim(true);for(let i=0;i<600;i++)J.step(1/60);
const c0=J.centres();J.setSwim(false,false);
const run=(n,l)=>{for(let i=0;i<n;i++)J.step(1/60);const c=J.centres();console.log(l,c.map((p,j)=>Math.hypot(p[0]-c0[j][0],p[1]-c0[j][1],p[2]-c0[j][2]).toFixed(3)).join(' '),'y',c.map(p=>p[1].toFixed(2)).join('/'));};
run(300,'hold 5s drift');run(600,'hold 15s');J.setSwim(false,true);run(600,'swish 10s');J.setSwim(false,false);run(300,'still 5s');J.setSwim(true);run(300,'swim again');
