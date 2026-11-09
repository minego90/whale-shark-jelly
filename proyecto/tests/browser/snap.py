import sys,time,base64
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
out=sys.argv[1]; wait=float(sys.argv[2]); pre=sys.argv[3] if len(sys.argv)>3 else ''
w=int(sys.argv[4]) if len(sys.argv)>4 else 1000; h=int(sys.argv[5]) if len(sys.argv)>5 else 700
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=swiftshader','--use-webgpu-adapter=swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox'])
    pg=b.new_page(viewport={'width':w+340,'height':h})
    logs=[]
    pg.on('console',lambda m:logs.append(m.type+': '+m.text[:300]))
    pg.on('pageerror',lambda e:logs.append('PAGEERROR: '+str(e)[:300]))
    pg.goto('file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'../../dist/index.html'))+(sys.argv[7] if len(sys.argv)>7 else ''))
    time.sleep(wait)
    if pre: pg.evaluate(pre); time.sleep(float(sys.argv[6]) if len(sys.argv)>6 else 3)
    try:
      r=pg.evaluate('(async()=>{const s=await window.__jelly.snapshot();return {w:s.w,h:s.h,b:s.bytes}})()')
    except Exception as e:
      print('ERR',str(e)[:200]); print('\n'.join(logs[:40])); b.close(); sys.exit()
    arr=np.array(r['b'],dtype=np.uint8).reshape(r['h'],r['w'],4)
    Image.fromarray(arr[:,:,:3]).save(out); print('saved',out,r['w'],r['h'],'mean',arr[:,:,:3].mean())
    print('\n'.join(logs[:30])); b.close()
