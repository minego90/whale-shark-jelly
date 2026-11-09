# Step 3: quantize sdf.npy to bytes (value = round(sdf/sc*127)+128, clamped), deflate, base64 -> grid.b64
# Paste the result into parts/grid.js as GRID_B64 and keep GRID_META = { o: [-0.06,-0.02,-0.80], res: 0.011, n: [314,91,146], sc: 0.12 }
import numpy as np, zlib, base64
sdf = np.load('sdf.npy'); sc = 0.12
q = np.clip(np.round(sdf / sc * 127) + 128, 0, 255).astype(np.uint8)
open('grid.b64', 'w').write(base64.b64encode(zlib.compress(q.tobytes(), 9)).decode())
print('shape', sdf.shape, 'bytes', q.size)
