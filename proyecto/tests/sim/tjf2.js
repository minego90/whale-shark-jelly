const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06); const J=M.createJellies(w); J.setSwim(true);
for(let i=0;i<200;i++){J.step(1/60);}
let t=process.hrtime.bigint(); for(let i=0;i<300;i++){J.step(1/60);J.fill();} console.log('jf ms/frame',Number(process.hrtime.bigint()-t)/1e6/300);
