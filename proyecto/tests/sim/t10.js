const fs=require('fs');
const M=new Function(fs.readFileSync(__dirname+'/../../src/core_node.js','utf8')+';return {createWorld};')();
const w=M.createWorld(0.05);w.S.nsub=4;for(let i=0;i<60;i++)w.step(1/60);
const pos=w.pos,nv=w.nv;let cx=0,cz=0;for(let i=0;i<nv;i++){cx+=pos[3*i];cz+=pos[3*i+2];}cx/=nv;cz/=nv;
let near=[];for(let i=0;i<nv;i++)if(Math.hypot(pos[3*i]-cx,pos[3*i+2]-cz)<0.1)near.push(i);
const cols=new Float32Array(160*8);
const my=()=>near.reduce((a,i)=>a+pos[3*i+1],0)/near.length;
console.log('before',my().toFixed(3));
let y=-0.07;
for(let f=0;f<150;f++){y+=0.004;let n=0;for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){const o=n*8;cols[o]=cx+i*0.07;cols[o+1]=y;cols[o+2]=cz+j*0.07;cols[o+3]=0.05;cols[o+4]=cols[o];cols[o+5]=y-0.004;cols[o+6]=cols[o+2];n++;}w.setColliders(cols,n);w.step(1/60);}
console.log('palm top',(y+0.05).toFixed(3),'jelly centre y',my().toFixed(3));
w.setColliders(cols,0);for(let f=0;f<5;f++)w.step(1/60);
// debug: static big sphere under a vertex
const w3=M.createWorld(0.05);w3.S.nsub=4;for(let i=0;i<30;i++)w3.step(1/60);
const p3=w3.pos;let i0=near[0];const x=p3[3*i0],yv=p3[3*i0+1],z=p3[3*i0+2];
const c=new Float32Array(160*8);c.set([x,yv-0.02,z,0.1,x,yv-0.02,z]);w3.setColliders(c,1);
w3.step(1/60);console.log('vertex y before',yv.toFixed(3),'after',p3[3*i0+1].toFixed(3));
