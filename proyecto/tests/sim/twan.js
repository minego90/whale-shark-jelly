const fs=require('fs');const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld,createJellies};')();
const w=M.createWorld(0.06),J=M.createJellies(w);for(let i=0;i<120;i++)J.step(1/60);J.setSwim(true);
let prev=J.centres(),path=[0,0,0],mn=9,bb=[[9,-9],[9,-9],[9,-9]];
for(let t=0;t<60*60;t++){J.step(1/60);const c=J.centres();for(let j=0;j<3;j++){path[j]+=Math.hypot(c[j][0]-prev[j][0],c[j][1]-prev[j][1],c[j][2]-prev[j][2]);}
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)if(t>300)mn=Math.min(mn,Math.hypot(c[a][0]-c[b][0],c[a][1]-c[b][1],c[a][2]-c[b][2]));
 for(let k=0;k<3;k++){bb[k][0]=Math.min(bb[k][0],c[0][k]);bb[k][1]=Math.max(bb[k][1],c[0][k]);}prev=c;}
console.log('path m in 60s',path.map(x=>x.toFixed(1)).join(' '),'min dist',mn.toFixed(2),'jelly0 range x,y,z',bb.map(r=>r.map(x=>x.toFixed(1)).join('..')).join(' '),'vol',J.volumeRatio().map(x=>x.toFixed(2)).join(' '));
let bad=0;for(const v of J.pos)if(!isFinite(v))bad++;console.log('nan',bad);
