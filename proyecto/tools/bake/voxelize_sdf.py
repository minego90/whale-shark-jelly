import numpy as np, time
from scipy import ndimage as ndi
P=np.load('P.npy');T=np.load('T.npy')
s=0.68
S=np.stack([(2.3613-P[:,2])*s,(P[:,1]+0.82)*s,P[:,0]*s],1)  # a,y,z
res=0.011
o=np.array([-0.06,-0.02,-0.80]); sz=np.array([3.45,1.0,1.6])
n=np.ceil(sz/res).astype(int); print(n,n.prod())
tri=S[T]
e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0]
area=0.5*np.linalg.norm(np.cross(e1,e2),axis=1)
k=np.maximum(1,np.ceil(np.sqrt(area)/(res*0.4))).astype(int)
mark=np.zeros(n,bool)
def put(p):
    i=np.floor((p-o)/res).astype(int)
    ok=((i>=0)&(i<n)).all(1);i=i[ok];mark[i[:,0],i[:,1],i[:,2]]=True
for kk in np.unique(k):
    m=k==kk;t=tri[m]
    for a in range(kk+1):
        for b in range(kk+1-a):
            u=a/kk;v=b/kk
            put(t[:,0]*(1-u-v)+t[:,1]*u+t[:,2]*v)
print('marked',mark.sum())
md=ndi.binary_dilation(mark,iterations=2)
lab,nl=ndi.label(~md)
ext=lab==lab[0,0,0]
inside=ndi.binary_erosion(~ext,iterations=1)
print('inside',inside.sum(),'labels',nl)
din=ndi.distance_transform_edt(inside)*res
dout=ndi.distance_transform_edt(~inside)*res
sdf=(dout-din)-0.5*res
np.save('sdf.npy',sdf.astype(np.float32))
np.save('inside.npy',inside)
print(sdf.min(),sdf.max())
