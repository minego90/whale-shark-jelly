const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);for(let i=0;i<60;i++)J.step(1/60);
const c=J.centres()[0];const CB=new Float32Array(8*8);CB.set([c[0],c[1]+0.05,c[2],0.15,c[0],c[1]+0.05,c[2],0]);w.setColliders(CB,1);
const mx=()=>{let m=0,n=0;for(let i=0;i<J.rest4.length/4;i++){const g=J.rest4[i*4+3];m=Math.max(m,g);if(g>0.3)n++;}return m.toFixed(2)+' n>0.3='+n;};
for(let k=0;k<6;k++){for(let i=0;i<10;i++)J.step(1/60);console.log('t',((k+1)*10/60).toFixed(2),mx()); if(k==1)w.setColliders(CB,0);}
for(let i=0;i<120;i++)J.step(1/60);console.log('after 2s',mx());
