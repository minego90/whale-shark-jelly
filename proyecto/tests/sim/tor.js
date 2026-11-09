const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);
const rep=l=>{J.fill();const I=J.inst;const c=J.centres()[0];let ys=[];for(let n=0;n<J.count;n++){const o=n*12;if(I[o+11]>=0.55&&n<J.count/3)ys.push(I[o+1]-c[1]);}console.log(l,'oral y rel centre min',Math.min(...ys).toFixed(2),'max',Math.max(...ys).toFixed(2));};
for(let i=0;i<180;i++)J.step(1/60); rep('limp');J.setSwim(true);for(let k=0;k<4;k++){for(let i=0;i<180;i++)J.step(1/60);rep('swim');}
