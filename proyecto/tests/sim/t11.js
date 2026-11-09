const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.05);w.S.nsub=4;for(let i=0;i<60;i++)w.step(1/60);
const pos=w.pos,nv=w.nv;let cx=0,cz=0;for(let i=0;i<nv;i++){cx+=pos[3*i];cz+=pos[3*i+2];}cx/=nv;cz/=nv;
const near=[];for(let i=0;i<nv;i++)if(Math.hypot(pos[3*i]-cx,pos[3*i+2]-cz)<0.1)near.push(i);
console.log('near',near.length,'cx',cx.toFixed(2),'cz',cz.toFixed(2));
const cols=new Float32Array(160*8);let y=-0.07;
for(let f=0;f<150;f++){y+=0.004;let n=0;for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){const o=n*8;cols[o]=cx+i*0.07;cols[o+1]=y;cols[o+2]=cz+j*0.07;cols[o+3]=0.05;cols[o+4]=cols[o];cols[o+5]=y-0.004;cols[o+6]=cols[o+2];n++;}w.setColliders(cols,n);w.step(1/60);
if(f%25==0){const m=near.reduce((a,i)=>a+pos[3*i+1],0)/near.length;console.log(f,'palm',y.toFixed(3),'mean',m.toFixed(3),'n',n);}}
