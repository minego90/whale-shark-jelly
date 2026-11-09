const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);
for(let i=0;i<120;i++)J.step(1/60);
const c=J.centres()[0]; const h=J.pick([c[0],3,c[2]],[0,-1,0]); console.log('pick',h);
const g=J.grab('d',h); for(let i=0;i<120;i++){J.move('d',[g[0],g[1]+0.8,g[2]]);J.step(1/60);} console.log('lifted centre y',J.centres()[0][1].toFixed(2),'vol',J.volumeRatio()[0].toFixed(2));
J.release('d'); for(const f of [0,1]){J.setParams(f,0.35); for(let i=0;i<120;i++)J.step(1/60); console.log('firm',f,'vol',J.volumeRatio().map(x=>x.toFixed(2)).join(' '));}
let bad=0;for(const v of J.pos) if(!isFinite(v))bad++; console.log('nan',bad);
