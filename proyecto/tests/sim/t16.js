const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createKelp};')();
const w=M.createWorld(0.06);for(let i=0;i<30;i++)w.step(1/60);
const K=M.createKelp(w);for(let f=0;f<120;f++)K.step(1/60);
const c=K.pick(null,null,0.3,[K.root(0)[0],0.3,K.root(0)[1]]);console.log('pick',c);
const r0=K.root(0);K.move(0,r0[0]+0.5,r0[1]);for(let f=0;f<120;f++)K.step(1/60);console.log(r0,K.root(0));
// float hold
w.S.g=0.03;w.S.drag=0.9;w.S.swim=0;
let y=(()=>{let s=0;for(let i=1;i<w.nv*3;i+=3)s+=w.pos[i];return s/w.nv})();console.log('y0',y.toFixed(2));
for(let f=0;f<900;f++){w.step(1/60);if(f%300==299){let s=0;for(let i=1;i<w.nv*3;i+=3)s+=w.pos[i];console.log('y',(s/w.nv).toFixed(2))}}
