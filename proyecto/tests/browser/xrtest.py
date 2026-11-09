import sys,time,json
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
INIT = r"""
(() => {
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const persp=(fy,asp,n,f)=>{const t=1/Math.tan(fy/2);return [t/asp,0,0,0,0,t,0,0,0,0,f/(n-f),-1,0,0,f*n/(n-f),0];};
const tr=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
window.__log=[]; window.__sel={};
class FakeBinding{ constructor(s,d){this.d=d;} createProjectionLayer(o){return {fmt:o.colorFormat};}
  getViewSubImage(layer,view){ if(!this.tex){this.tex=this.d.createTexture({size:[512,512,2],format:layer.fmt,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC|GPUTextureUsage.TEXTURE_BINDING}); window.__tex=this.tex; window.__dev=this.d;}
    const li=view.eye==='left'?0:1; return {colorTexture:this.tex, getViewDescriptor:()=>({dimension:'2d',baseArrayLayer:li,arrayLayerCount:1}), viewport:{x:0,y:0,width:512,height:512}}; } }
window.XRGPUBinding=FakeBinding;
const hands=()=>{const m=new Map(); ['wrist','index-finger-tip','thumb-tip','middle-finger-tip'].forEach((n,i)=>m.set(n,{name:n,i})); return m;};
const ctrl={targetRaySpace:{k:'ray'},hand:null,handedness:'right'};
const hand={targetRaySpace:{k:'hray'},hand:hands(),handedness:'left'};
window.__mode='ar';
const handlers={};
const session={
  addEventListener:(n,f)=>{(handlers[n]=handlers[n]||[]).push(f);},
  updateRenderState(){}, renderState:{depthNear:0.1},
  requestReferenceSpace:async n=>({n}),
  requestHitTestSource:async o=>({cancel(){}, sp:o.space}),
  inputSources:[ctrl,hand], end(){ (handlers.end||[]).forEach(f=>f()); },
  requestAnimationFrame(cb){ window.__cb=cb; return 1; }
};
window.__session=session; window.__handlers=handlers;
const eyeOf=(x)=>({eye:x<0?'left':'right', projectionMatrix:new Float32Array(persp(1.7,1,0.1,100)), transform:{position:{x:x*0.03,y:1.5,z:0}, inverse:{matrix:new Float32Array(tr(-x*0.03,-1.5,0))}}});
window.__frame={
  getViewerPose:()=>({transform:{matrix:new Float32Array(tr(0,1.5,0)),position:{x:0,y:1.5,z:0}},views:[eyeOf(-1),eyeOf(1)]}),
  getPose:(sp)=>{ // right controller points at the board / table; hand ray at table
    const m=new Float32Array(I);
    if(sp.k==='ray'){ // origin (0.3,1.2,-0.3) looking at (0.4,0.75,-0.8)
      const o=[0.3,1.2,-0.3], t=window.__rayTarget||[0.4,0.75,-0.8]; let d=[t[0]-o[0],t[1]-o[1],t[2]-o[2]]; const l=Math.hypot(...d); d=d.map(x=>x/l);
      m[8]=-d[0];m[9]=-d[1];m[10]=-d[2]; m[12]=o[0];m[13]=o[1];m[14]=o[2]; }
    else { const o=[-0.2,1.1,-0.2], t=[-0.1,0.7,-0.8]; let d=[t[0]-o[0],t[1]-o[1],t[2]-o[2]]; const l=Math.hypot(...d); d=d.map(x=>x/l); m[8]=-d[0];m[9]=-d[1];m[10]=-d[2]; m[12]=o[0];m[13]=o[1];m[14]=o[2]; }
    return {transform:{matrix:m}};},
  getHitTestResults:(h)=>[{getPose:()=>({transform:{matrix:new Float32Array(tr(window.__hit?window.__hit[0]:0.1, 0.72, window.__hit?window.__hit[2]:-0.85))}})}],
  getJointPose:(j)=>{const b=window.__pj||[-0.1,0.8,-0.75];return {transform:{position:{x:b[0]+0.01*j.i,y:b[1]+0.003*j.i,z:b[2]}},radius:0.006};},
};
Object.defineProperty(navigator,'xr',{configurable:true,value:{ isSessionSupported:async m=>true, requestSession:async(m,o)=>{window.__log.push('session '+m+' '+JSON.stringify(o)); window.__mode=m; return session;} }});
})();
"""
out=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox'])
    pg=b.new_page(viewport={'width':1200,'height':700})
    logs=[]
    pg.on('console',lambda m:logs.append(m.type+': '+m.text[:300]))
    pg.on('pageerror',lambda e:logs.append('PAGEERROR: '+str(e)[:400]))
    pg.add_init_script(INIT)
    import os; pg.goto('file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'../../dist/index.html'))+'#norender,gpu')
    time.sleep(3)
    print('bAR disabled?', pg.evaluate("document.getElementById('bAR').disabled"), pg.evaluate("document.getElementById('vrNote').textContent")[:80])
    pg.evaluate("document.getElementById('bAR').click()"); time.sleep(2)
    print(pg.evaluate("JSON.stringify(window.__log)"))
    def run(n,t0=0):
        pg.evaluate("(a)=>{const [n,t0]=a; for(let i=0;i<n;i++){ window.__cb(t0+i*16, window.__frame); }}",[n,t0])
    run(40,1000); time.sleep(1)
    def grab(name):
        r=pg.evaluate("""(async()=>{const d=window.__dev,t=window.__tex;const bpr=512*4;const rb=d.createBuffer({size:bpr*512,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const e=d.createCommandEncoder();e.copyTextureToBuffer({texture:t,origin:[0,0,0]},{buffer:rb,bytesPerRow:bpr},[512,512,1]);d.queue.submit([e.finish()]);await rb.mapAsync(GPUMapMode.READ);const a=Array.from(new Uint8Array(rb.getMappedRange()));rb.unmap();return a;})()""")
        arr=np.array(r,dtype=np.uint8).reshape(512,512,4)
        rgb=arr[:,:,:3].astype(float); al=arr[:,:,3:4].astype(float)/255
        yy=np.mgrid[0:512,0:512][0]; room=np.stack([150+30*(yy/512),125+25*(yy/512),100+20*(yy/512)],-1)
        Image.fromarray(np.clip(rgb+(1-al)*room,0,255).astype(np.uint8)).save(name); print('saved',name,'alpha mean',arr[:,:,3].mean())
    grab(out+'_place.png')
    # confirm placement with the controller trigger (ray not on the board)
    pg.evaluate("window.__rayTarget=[0.5,0.7,-1.0]")
    pg.evaluate("(()=>{const f=window.__frame; (window.__handlers.selectstart||[]).forEach(h=>h({frame:f,inputSource:window.__session.inputSources[0]})); (window.__handlers.selectend||[]).forEach(h=>h({frame:f,inputSource:window.__session.inputSources[0]}));})()")
    run(60,3000); time.sleep(1)
    grab(out+'_play.png')
    pg.evaluate("window.__pj=[0.10,0.735,-0.85]")
    # pinch with the hand close to the jelly -> direct grab, then move the hand
    pg.evaluate("(()=>{const f=window.__frame; (window.__handlers.selectstart||[]).forEach(h=>h({frame:f,inputSource:window.__session.inputSources[1]}));})()")
    pg.evaluate("window.__pj=[0.10,0.80,-0.85]"); run(40,5000)
    print('grab active:', pg.evaluate("!!window.__jelly.world().S.grab"))
    pg.evaluate("(()=>{const f=window.__frame; (window.__handlers.selectend||[]).forEach(h=>h({frame:f,inputSource:window.__session.inputSources[1]}));})()")
    run(10,6000)
    grab(out+'_after.png')
    print('\n'.join(logs[:25])); b.close()
