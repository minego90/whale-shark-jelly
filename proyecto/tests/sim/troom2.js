const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies,ROOM};')();
M.ROOM.planes=[{o:[4,0,0],n:[-1,0,0],u:[0,0,1],v:[0,1,0],e:[-20,20,-20,20],th:2},{o:[0,3,0],n:[0,-1,0],u:[1,0,0],v:[0,0,1],e:[-20,20,-20,20],th:2}];M.ROOM.virt=false;
const w=M.createWorld(0.06),J=M.createJellies(w);J.setSwim(true);
for(let i=1;i<w.nv*3;i+=3){w.vel[i-1]+=10;w.vel[i]+=8;}
let mx=-9,my=0;for(let t=0;t<240;t++){w.step(1/60);J.step(1/60);for(let i=0;i<w.nv;i++){mx=Math.max(mx,w.pos[3*i]);my=Math.max(my,w.pos[3*i+1]);}}
console.log('shark max x',mx.toFixed(2),'(wall 4) max y',my.toFixed(2),'(ceiling 3) vol',w.volumeRatio().toFixed(2));
