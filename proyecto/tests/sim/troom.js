const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies,ROOM};')();
const w=M.createWorld(0.06),J=M.createJellies(w);J.setSwim(true);for(let i=0;i<60;i++){w.step(1/60);J.step(1/60);}
// throw jelly 0 hard outward and up via its grab
const c=J.centres()[0];const h=J.near(c,0.5);J.grab('t',h);for(let i=0;i<20;i++){J.move('t',[c[0]+12,c[1]+9,c[2]]);J.step(1/60);}J.release('t');
// throw the shark: give velocity
for(let i=1;i<w.nv*3;i+=3){w.vel[i-1]+=14;w.vel[i]+=10;}
let mx=0,my=0;for(let t=0;t<300;t++){w.step(1/60);J.step(1/60);for(const p of J.centres()){mx=Math.max(mx,Math.hypot(p[0]-1.5,p[2]));my=Math.max(my,p[1]);}
 for(let i=0;i<w.nv;i++){mx=Math.max(mx,Math.hypot(w.pos[3*i]-1.5,w.pos[3*i+2]));my=Math.max(my,w.pos[3*i+1]);}}
let bad=0;for(const v of w.pos)if(!isFinite(v))bad++;for(const v of J.pos)if(!isFinite(v))bad++;
console.log('max radius',mx.toFixed(2),'(R',M.ROOM.R,') max height',my.toFixed(2),'(H',M.ROOM.H,') nan',bad);
