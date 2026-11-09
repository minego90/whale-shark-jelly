const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createKelp};')();
const w=M.createWorld(0.06);for(let i=0;i<30;i++)w.step(1/60);
const K=M.createKelp(w);let t0=performance.now();
for(let f=0;f<600;f++){K.step(1/60);}
console.log('ms/frame',((performance.now()-t0)/600).toFixed(2));
const n=K.fill();let bad=0,maxy=0,miny=9;for(let i=0;i<n*12;i++)if(!isFinite(K.inst[i]))bad++;
for(let i=0;i<n;i++){maxy=Math.max(maxy,K.inst[12*i+1]);miny=Math.min(miny,K.inst[12*i+1]);}
console.log('inst',n,'nan',bad,'y',miny.toFixed(2),maxy.toFixed(2));
// tip positions of strand 0
console.log([0,1,2].map(i=>K.inst.slice(12*(i*8+7),12*(i*8+7)+3).map(v=>v.toFixed(2)).join(',')).join(' | '));
