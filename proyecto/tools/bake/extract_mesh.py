# Step 1: extract all triangles of the Sketchfab glTF (scene.gltf + scene.bin) into P.npy (vertices) and T.npy (triangles)
# usage: python3 extract_mesh.py /path/to/unzipped_model_dir
import json, sys, os, numpy as np
d = sys.argv[1] if len(sys.argv) > 1 else '.'
g = json.load(open(os.path.join(d, 'scene.gltf'))); b = open(os.path.join(d, 'scene.bin'), 'rb').read()
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    x = np.frombuffer(b, dt, a['count'] * nc, off); return x.reshape(a['count'], nc) if nc > 1 else x
Ps, Ts, base = [], [], 0
for m in g['meshes']:
    pr = m['primitives'][0]; p = acc(pr['attributes']['POSITION']).astype(np.float64); i = acc(pr['indices']).astype(np.int64).reshape(-1, 3)
    Ps.append(p); Ts.append(i + base); base += len(p)
P = np.concatenate(Ps); T = np.concatenate(Ts)
np.save('P.npy', P.astype(np.float32)); np.save('T.npy', T.astype(np.int32 if T.max() < 2**31 else np.int64))
print('P', P.shape, 'T', T.shape)
