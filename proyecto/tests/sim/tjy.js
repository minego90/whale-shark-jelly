const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);for(let i=0;i<120;i++)J.step(1/60);J.setSwim(true);
let ys=[],low=0,n=0;for(let t=0;t<60*60;t++){J.step(1/60);const c=J.centres();for(const p of c){n++;if(p[1]<0.4)low++;} if(t%300==0)ys.push(c.map(p=>p[1].toFixed(2)).join('/'));}
console.log(ys.join(' '));console.log('fraction near floor',(low/n).toFixed(2));
