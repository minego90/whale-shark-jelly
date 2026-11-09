const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.05);w.S.nsub=4;
for(let i=0;i<60;i++)w.step(1/60);
const pos=w.pos,nv=w.nv;
const bb=()=>{let a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];for(let i=0;i<nv;i++)for(let k=0;k<3;k++){a[k]=Math.min(a[k],pos[3*i+k]);b[k]=Math.max(b[k],pos[3*i+k]);}return {a,b};};
const B=bb();console.log('bbox',B.a.map(x=>x.toFixed(2)),B.b.map(x=>x.toFixed(2)),'nv',nv);
// palm: big sphere row under the jelly, then sweep sideways
const cx=(B.a[0]+B.b[0])/2,cz=(B.a[2]+B.b[2])/2;
const cols=new Float32Array(160*8);
function palm(y,xo){let n=0;for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){const o=n*8;cols[o]=cx+xo+i*0.08;cols[o+1]=y;cols[o+2]=cz+j*0.08;cols[o+3]=0.06;cols[o+4]=cx+xo-0.0+i*0.08;cols[o+5]=y;cols[o+6]=cz+j*0.08;n++;}return n;}
// lift: palm rises from y=-0.2 ... start under jelly bottom
let y=B.a[1]-0.06;const t0=performance.now();
for(let f=0;f<120;f++){y+=0.004;const n=palm(y,0);w.setColliders(cols,n);w.step(1/60);}
const t1=performance.now();
const C=bb();console.log('after lift: jelly min y',C.a[1].toFixed(3),'palm top',(y+0.06).toFixed(3),'ms/frame',((t1-t0)/120).toFixed(2));
// two grabs
const v1=w.surfV[0],v2=w.surfV[Math.floor(w.surfV.length/2)];
w.setColliders(cols,0);
w.beginGrab(v1,[0,0,1],1);w.beginGrab(v2,[0,0,1],2);
console.log('grabs',w.S.grabs.size);
const c1=w.S.grabs.get(1).c0,c2=w.S.grabs.get(2).c0;
for(let f=0;f<60;f++){w.moveGrab([c1[0]-0.0,c1[1]+0.2,c1[2]],0,1);w.moveGrab([c2[0],c2[1]+0.2,c2[2]],0,2);w.step(1/60);}
const P=w.P?w.P(v1):null;console.log('v1 y',w.pos[3*v1+1].toFixed(2),'target',(c1[1]+0.2).toFixed(2),'v2 y',w.pos[3*v2+1].toFixed(2),'target',(c2[1]+0.2).toFixed(2));
w.endGrab(1);console.log('after end 1:',w.S.grabs.size);w.endGrab(-1);console.log(w.S.grabs.size, w.S.grab);
let bad=0;for(let i=0;i<pos.length;i++)if(!isFinite(pos[i]))bad++;console.log('nan',bad);
{const w2=M.createWorld(0.05);w2.S.nsub=4;for(let i=0;i<30;i++)w2.step(1/60);const a=performance.now();for(let i=0;i<60;i++)w2.step(1/60);console.log('baseline ms/frame',((performance.now()-a)/60).toFixed(2));
// vertex rise check above palm
}
