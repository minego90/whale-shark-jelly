import numpy as np,sys
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
P=np.load('P.npy');T=np.load('T.npy')
def render(yaw,pitch,out,zmin=1.2):
    keep=P[T].mean(1)[:,2]>zmin
    t=T[keep]
    cy,sy=np.cos(yaw),np.sin(yaw);cp,sp=np.cos(pitch),np.sin(pitch)
    R1=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]);R2=np.array([[1,0,0],[0,cp,-sp],[0,sp,cp]])
    Q=P@R1.T@R2.T
    tri=Q[t];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.linalg.norm(n,axis=1)[:,None]+1e-12
    vis=n[:,2]>0  # camera looks down -z? view dir +z toward camera
    order=np.argsort(tri[:,:,2].mean(1))
    sh=np.clip(n[:,0]*0.3+n[:,1]*0.5+n[:,2]*0.8,0.05,1)
    fig=plt.figure(figsize=(8,6));ax=fig.add_subplot(111)
    pc=PolyCollection(tri[order][:,:,:2],facecolors=[(s,s,s) for s in sh[order]],edgecolors='none')
    ax.add_collection(pc);ax.set_aspect('equal');ax.autoscale();ax.axis('off')
    fig.savefig(out,dpi=90)
render(0,0,'f1.png')       # front (from +z)
render(0.7,0.35,'f2.png')  # 3/4
