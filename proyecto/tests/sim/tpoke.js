const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);J.setSwim(true);for(let i=0;i<300;i++)J.step(1/60);J.setSwim(false,false);for(let i=0;i<60;i++)J.step(1/60);
const c=J.centres()[0];const r=0.06; // fingertip ~8 mm at scale 0.14
const CB=new Float32Array(8*8);let x=c[0]-0.5;const sp=0.12; // fast poke: 0.12 units per frame (~1 m/s real)
let maxPush=0;
for(let f=0;f<10;f++){const nx=x+sp;CB.set([nx,c[1]+0.03,c[2],r,x,c[1]+0.03,c[2],0]);w.setColliders(CB,1);J.step(1/60);x=nx;const cc=J.centres()[0];maxPush=Math.max(maxPush,cc[0]-c[0]);}
w.setColliders(CB,0);
console.log('finger travelled',(x-(c[0]-0.5)).toFixed(2),'jelly carried in x by',maxPush.toFixed(3),'glow',J.rest4.slice(3,4)[0].toFixed(2));
